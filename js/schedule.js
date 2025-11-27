const DATA_URL = "https://script.google.com/macros/s/AKfycbz-aJuovNQ-0_W-2lgbDZK4Erwnlu1vD8H1yNp7Dzpd3G7HlVUkfiOVIa3ZxF6-Q4sX/exec?t=" + new Date().getTime();

// -------------------------------------------------------------
// Load data
// -------------------------------------------------------------
async function loadSchedule() {
  const response = await fetch(DATA_URL);
  const data = await response.json();
  return data;
}

// -------------------------------------------------------------
// Formatting functions
// -------------------------------------------------------------
function formatShowDate(rawDate) {
  if (!rawDate) return "";
  const d = new Date(rawDate);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function formatShowStart(rawStart) {
  if (!rawStart) return "";
  const d = new Date(rawStart);
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

function resolveLogo(showName) {
  const formattedName = showName.replace(/[/\\?%*:|"<>]/g, "");
  return `Logos/${formattedName}.png`;
}

// -------------------------------------------------------------
// Render schedule
// -------------------------------------------------------------
async function renderSchedule() {
  const rows = await loadSchedule();
  const byDate = {};

  // Group rows by date
  rows.forEach(r => {
    const adjustedDate = formatShowDate(r["Show Date"]);
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
    dayDiv.id = "day-" + date.replace(/\s+/g, "-");
    dayDiv.innerHTML = `<div class='day-title'>${date}</div>`;

    const runs = byDate[date];

    // Group by show
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

        // Logo
        const img = clone.querySelector(".show-logo");
        img.src = resolveLogo(showName);
        img.onerror = () => { img.src = "Logos/GDQ Logo.png"; };

        // Time + Host
        clone.querySelector(".show-time").textContent = formatShowStart(rawStart);
        clone.querySelector(".show-subtitle").textContent = "Hosted by: " + (hostName || "TBA");

        const runContainer = clone.querySelector(".run-container");

        // Append a single header row per show
        const headerRow = document.createElement("div");
        headerRow.className = "run-header-row";
        headerRow.innerHTML = `
          <div class="game">Game Info</div>
          <div class="estimate">Estimate</div>
          <div class="runner">Runner</div>
        `;
        runContainer.appendChild(headerRow);

        // Append actual runs
        groups[key].forEach(run => {
          const runClone = document.importNode(runTemplate.content, true);
          runClone.querySelector(".game").textContent = `${run["Game"]} (${run["Category"]})`;
          runClone.querySelector(".estimate").textContent = formatEstimate(run["Estimate"]);
          runClone.querySelector(".runner").innerHTML = renderRunners(run["Runners"], run["Runner Stream"]);
          runContainer.appendChild(runClone);
        });

        dayDiv.appendChild(clone);
      });

    container.appendChild(dayDiv);
  });
}

renderSchedule();
