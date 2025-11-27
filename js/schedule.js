const DATA_URL = "https://script.google.com/macros/s/AKfycbz-aJuovNQ-0_W-2lgbDZK4Erwnlu1vD8H1yNp7Dzpd3G7HlVUkfiOVIa3ZxF6-Q4sX/exec?t=" + new Date().getTime();

// -------------------------------------------------------------
// Initial GMT offset based on user's local time
// -------------------------------------------------------------
let forcedGMTOffset = new Date().getTimezoneOffset() / -60; // in hours

// -------------------------------------------------------------
// Load data
// -------------------------------------------------------------
async function loadSchedule() {
  const response = await fetch(DATA_URL);
  const data = await response.json();
  return data;
}

// -------------------------------------------------------------
// Time formatting (DST-aware Eastern time)
// -------------------------------------------------------------
function formatShowDate(rawDate, offsetHours = 0) {
  if (!rawDate) return "";
  const d = new Date(rawDate);
  d.setHours(d.getHours() + offsetHours);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatShowStart(rawStart, offsetHours = 0) {
  if (!rawStart) return "";
  const d = new Date(rawStart);
  d.setHours(d.getHours() + offsetHours);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
}

function formatEstimate(rawEstimate) {
  if (!rawEstimate) return "";
  const d = new Date(rawEstimate);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`;
}

function renderRunners(runnerNames, runnerStreams) {
  const names = runnerNames.split(",").map(s => s.trim());
  const streams = runnerStreams.split(",").map(s => s.trim());
  return names.map((name, i) => {
    let url = streams[i] || "#";
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    return `<a href="${url}" target="_blank" class="runner-pill">${name}</a>`;
  }).join(" ");
}

// -------------------------------------------------------------
// Resolve logo URL
// -------------------------------------------------------------
function resolveLogo(showName) {
  const formattedName = showName.replace(/[/\\?%*:|"<>]/g, "");
  return `Logos/${formattedName}.png`;
}

// -------------------------------------------------------------
// GMT dropdown
// -------------------------------------------------------------
const navContainer = document.getElementById("schedule-nav");
navContainer.style.display = "flex";
navContainer.style.justifyContent = "center";
navContainer.style.alignItems = "center";
navContainer.style.gap = "10px";

const tzSelectWrapper = document.createElement("div");
tzSelectWrapper.style.marginLeft = "20px";
tzSelectWrapper.style.display = "flex";
tzSelectWrapper.style.alignItems = "center";
tzSelectWrapper.innerHTML = `
  <label style="font-size:0.8rem; color:#fff; cursor:pointer;">
    Timezone (GMT offset):
    <select id="timezone-select"></select>
  </label>
`;
navContainer.appendChild(tzSelectWrapper);

const tzSelect = document.getElementById("timezone-select");
for (let i = -12; i <= 14; i++) {
  const opt = document.createElement("option");
  opt.value = i;
  opt.textContent = i >= 0 ? `GMT+${i}` : `GMT${i}`;
  tzSelect.appendChild(opt);
}
tzSelect.value = forcedGMTOffset;

tzSelect.addEventListener("change", () => {
  forcedGMTOffset = parseInt(tzSelect.value);
  renderSchedule();
});

// -------------------------------------------------------------
// Render schedule with templates
// -------------------------------------------------------------
async function renderSchedule() {
  const rows = await loadSchedule();
  const byDate = {};

  // Group by adjusted date
  rows.forEach(r => {
    const adjustedDate = formatShowDate(r["Show Date"], forcedGMTOffset);
    if (!byDate[adjustedDate]) byDate[adjustedDate] = [];
    byDate[adjustedDate].push(r);
  });

  const container = document.getElementById("schedule");
  container.innerHTML = "";

  const showTemplate = document.getElementById("show-template");
  const runTemplate = document.getElementById("run-template");

  Object.keys(byDate).sort().forEach(date => {
    const dayDiv = document.createElement("div");
    dayDiv.className = "day-block";
    dayDiv.id = "day-" + date.replace(/\//g, "-");
    dayDiv.innerHTML = `<div class='day-title'>${date}</div>`;

    const runs = byDate[date];
    const groups = {};

    runs.forEach(run => {
      const key = `${run["Show Start (Eastern)"]}|${run["Show"]}|${run["Host"]}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(run);
    });

    Object.keys(groups)
      .sort((a, b) => new Date(a.split("|")[0]) - new Date(b.split("|")[0]))
      .forEach(key => {
        const [rawStart, showName, hostName] = key.split("|");

        const clone = document.importNode(showTemplate.content, true);
        const logoPath = resolveLogo(showName);
        const fallbackLogo = "Logos/GDQ Logo.png";

        const img = clone.querySelector(".show-logo");
        img.src = logoPath;
        img.onerror = () => { img.src = fallbackLogo; };

        clone.querySelector(".show-time").textContent = formatShowStart(rawStart, forcedGMTOffset);
        clone.querySelector(".show-subtitle").textContent = "Hosted by: " + (hostName || "TBA");

        groups[key].forEach(run => {
          const runClone = document.importNode(runTemplate.content, true);
          runClone.querySelector(".game").textContent = run["Game"];
          runClone.querySelector(".category").textContent = run["Category"];
          runClone.querySelector(".estimate").textContent = formatEstimate(run["Estimate"]);
          runClone.querySelector(".runner").innerHTML = renderRunners(run["Runners"], run["Runner Stream"]);
          clone.querySelector(".run-container").appendChild(runClone);
        });

        dayDiv.appendChild(clone);
      });

    container.appendChild(dayDiv);
  });
}

renderSchedule();
