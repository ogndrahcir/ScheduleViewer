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
function formatShowDateForDisplay(rawDate) {
  if (!rawDate) return "";
  const d = new Date(rawDate);
  const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
  return d.toLocaleDateString("en-US", options);
}

function formatShowDateForNavbar(rawDate) {
  if (!rawDate) return "";
  const d = new Date(rawDate);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
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

// -------------------------------------------------------------
// Resolve logo URL
// -------------------------------------------------------------
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
    const date = formatShowDateForNavbar(r["Show Date"]);
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(r);
  });

  const navContainer = document.getElementById("schedule-nav");
  const container = document.getElementById("schedule");
  container.innerHTML = "";

  // Build navbar buttons (keep MM/DD/YYYY format)
  const dayButtons = {};
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
    navContainer.appendChild(btn);
    dayButtons[date] = btn;
  });

  function highlightDay(date) {
    Object.keys(dayButtons).forEach(d => dayButtons[d].classList.remove("active"));
    if (dayButtons[date]) dayButtons[date].classList.add("active");
  }

  // Render each day
  Object.keys(byDate).sort().forEach(date => {
    const dayDiv = document.createElement("div");
    dayDiv.className = "day-block";
    dayDiv.id = "day-" + date.replace(/\//g, "-");
    dayDiv.innerHTML = `<div class='day-title'>${formatShowDateForDisplay(date)}</div>`;

    const runs = byDate[date];
    const groups = {};

    // Group by show start + show + host
    runs.forEach(run => {
      const key = `${run["Show Start (Eastern)"]}|${run["Show"]}|${run["Host"]}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(run);
    });

    Object.keys(groups)
      .sort((a,b) => new Date(a.split("|")[0]) - new Date(b.split("|")[0]))
      .forEach(key => {
        const [rawStart, showName, hostName] = key.split("|");
        const showTemplate = document.getElementById("show-template");
        const clone = document.importNode(showTemplate.content, true);

        // Set logo
        const img = clone.querySelector(".show-logo");
        img.src = resolveLogo(showName);
        img.onerror = () => { img.src = "Logos/GDQ Logo.png"; };

        // Layout: logo left, time top right, host bottom right
        const info = clone.querySelector(".show-info");
        info.innerHTML = `
          <span class="show-time">${formatShowStart(rawStart)}</span>
          <span class="show-subtitle">Hosted by: ${hostName || "TBA"}</span>
        `;
        info.style.display = "flex";
        info.style.flexDirection = "column";
        info.style.alignItems = "center";

        clone.querySelector(".show-header").style.display = "grid";
        clone.querySelector(".show-header").style.gridTemplateColumns = "120px 1fr";
        clone.querySelector(".show-header").style.justifyContent = "center";
        clone.querySelector(".show-header").style.alignItems = "center";
        clone.querySelector(".show-time").style.color = "#ffffff";

        // Add sticky header row for runs
        const runHeader = document.createElement("div");
        runHeader.className = "run-header-row";
        runHeader.innerHTML = `
          <div class="game">Game Info</div>
          <div class="estimate">Estimate</div>
          <div class="runner">Runner(s)</div>
        `;
        clone.querySelector(".run-container").appendChild(runHeader);

        // Add runs
        groups[key].forEach(run => {
          const runTemplate = document.getElementById("run-template");
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
