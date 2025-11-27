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
// DST-aware Eastern offset for a given date
// -------------------------------------------------------------
function getEasternOffset(date) {
  // Returns offset in hours: -5 for EST, -4 for EDT
  const nyTime = new Date(date).toLocaleString("en-US", { timeZone: "America/New_York" });
  const d = new Date(nyTime);
  const offsetMinutes = d.getTimezoneOffset(); // minutes behind UTC
  return -offsetMinutes / 60;
}

// Convert Eastern → UTC → target GMT offset
function adjustFromEastern(rawDate, targetOffset) {
  if (!rawDate) return null;
  const d = new Date(rawDate);
  const easternOffset = getEasternOffset(d); // EST or EDT
  const utcTime = d.getTime() - easternOffset * 3600 * 1000;
  return new Date(utcTime + targetOffset * 3600 * 1000);
}

// -------------------------------------------------------------
// Formatting functions
// -------------------------------------------------------------
function formatShowDate(rawDate, offsetHours = 0) {
  const d = adjustFromEastern(rawDate, offsetHours);
  if (!d) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatShowStart(rawStart, offsetHours = 0) {
  const d = adjustFromEastern(rawStart, offsetHours);
  if (!d) return "";
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

  return names
    .map((name, i) => {
      let url = streams[i] || "#";
      if (!/^https?:\/\//i.test(url)) url = "https://" + url;
      return `<a href="${url}" target="_blank" class="runner-pill">${name}</a>`;
    })
    .join(" ");
}

// -------------------------------------------------------------
// Resolve logo URL
// -------------------------------------------------------------
function resolveLogo(showName) {
  const formattedName = showName.replace(/[/\\?%*:|"<>]/g, "");
  const path = `Logos/${formattedName}.png`;
  return path;
}

// -------------------------------------------------------------
// Build GMT dropdown (−12 to +14)
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
// Render schedule
// -------------------------------------------------------------
async function renderSchedule() {
  const rows = await loadSchedule();
  const byDate = {};

  rows.forEach(r => {
    const adjustedDate = formatShowDate(r["Show Date"], forcedGMTOffset);
    if (!byDate[adjustedDate]) byDate[adjustedDate] = [];
    byDate[adjustedDate].push(r);
  });

  const dayButtons = {};
  const today = new Date();
  today.setHours(0,0,0,0);
  let initialDate = null;

  [...navContainer.querySelectorAll("button")].forEach(b => b.remove());

  Object.keys(byDate).sort().forEach(date => {
    const btn = document.createElement("button");
    btn.textContent = date;
    btn.className = "nav-day-btn";
    btn.onclick = () => {
      const dayDiv = document.getElementById("day-" + date.replace(/\//g, "-"));
      if (dayDiv) dayDiv.scrollIntoView({ behavior: "smooth", block: "start" });
      highlightDay(date);
    };
    navContainer.insertBefore(btn, tzSelectWrapper);
    dayButtons[date] = btn;

    const day = new Date(date);
    if (!initialDate || (day.getTime() <= today.getTime() && day.getTime() > new Date(initialDate).getTime())) {
      initialDate = date;
    }
  });

  function highlightDay(date) {
    Object.keys(dayButtons).forEach(d => dayButtons[d].classList.remove("active"));
    if (dayButtons[date]) dayButtons[date].classList.add("active");
  }

  if (initialDate) {
    const dayDiv = document.getElementById("day-" + initialDate.replace(/\//g, "-"));
    if (dayDiv) {
      dayDiv.scrollIntoView({ behavior: "auto", block: "start" });
      highlightDay(initialDate);
    }
  }

  const container = document.getElementById("schedule");
  container.innerHTML = "";

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

        const groupDiv = document.createElement("div");
        groupDiv.className = "show-group";

        const logoPath = resolveLogo(showName);
        const fallbackLogo = "Logos/GDQ Logo.png";

        const adjustedTime = formatShowStart(rawStart, forcedGMTOffset);

        groupDiv.innerHTML = `
          <div class="show-header">
            <img src="${logoPath}" onerror="this.onerror=null;this.src='${fallbackLogo}'" alt="Logo for ${showName}" class="show-logo">
            <div class="show-info">
              <span class="show-time">${adjustedTime}</span>
              <span class="show-subtitle">Hosted by: ${hostName || "TBA"}</span>
            </div>
          </div>
        `;

        groups[key].forEach(run => {
          const row = document.createElement("div");
          row.className = "run-row";
          row.innerHTML = `
            <div>
              <div class="game">${run["Game"]}</div>
              <div class="category">${run["Category"]}</div>
            </div>
            <div class="estimate">${formatEstimate(run["Estimate"])}</div>
            <div class="runner">${renderRunners(run["Runners"], run["Runner Stream"])}</div>
          `;
          groupDiv.appendChild(row);
        });

        dayDiv.appendChild(groupDiv);
      });

    container.appendChild(dayDiv);
  });
}

renderSchedule();
