const DATA_URL = "https://script.google.com/macros/s/AKfycbyxanGFzAWbQV4Fso__LJh5eOb4GDjBYHx6sK79FTu3ww6z0sYs603UbQeEr-aKRoK7/exec"

// -------------------------------------------------------------
// Load data
// -------------------------------------------------------------
async function loadSchedule() {
  const response = await fetch(`${DATA_URL}?t=${Date.now()}`);
  const data = await response.json();
  return data;
}

// -------------------------------------------------------------
// Formatting functions
// -------------------------------------------------------------
function formatRunStart(d) {
  if (!d) return "";
  const dateObj = d instanceof Date ? d : new Date(d);
  if (isNaN(dateObj)) return "";
  return dateObj.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function renderRunners(runnerNames = "", runnerStreams = "") {
  if (!runnerNames) return "";
  const names = String(runnerNames).split(",").map(s => s.trim()).filter(Boolean);
  const streams = String(runnerStreams || "").split(",").map(s => s.trim());
  return names.map((name, i) => {
    let url = streams[i] || "#";
    if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;
    return `<a href="${url}" target="_blank" class="runner-pill">${name}</a>`;
  }).join(" ");
}

function resolveLogo(showName) {
  if (!showName) return "Logos/GDQ Logo.png";
  const formattedName = showName.replace(/[/\\?%*:|"<>]/g, "");
  return `Logos/${formattedName}.png`;
}

// -------------------------------------------------------------
// Estimate helpers
// -------------------------------------------------------------
function parseEstimate(raw) {
  if (!raw) return "0:00:00";
  const d = new Date(raw);
  if (isNaN(d)) return "0:00:00";

  let h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const s = d.getUTCSeconds();

  h -= 5; // subtract extra offset
  if (h < 0) h += 24;

  return `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function parseEstimateToMs(raw) {
  if (!raw) return 0;
  const parts = String(raw).split(":").map(Number);
  if (parts.length === 3) return parts[0]*3600000 + parts[1]*60000 + parts[2]*1000;
  if (parts.length === 2) return parts[0]*3600000 + parts[1]*60000;
  return 0;
}

function addDurationToDate(date, ms) {
  return new Date(date.getTime() + ms);
}

// -------------------------------------------------------------
// Parse UTC to Eastern Time
// -------------------------------------------------------------
function toEastern(utcRaw) {
  if (!utcRaw) return null;
  const utcDate = new Date(utcRaw);
  if (isNaN(utcDate)) return null;
  // Convert to ET using locale string in America/New_York
  return new Date(utcDate.toLocaleString("en-US", { timeZone: "America/New_York" }));
}

// -------------------------------------------------------------
// Render schedule
// -------------------------------------------------------------
async function renderSchedule() {
  const rows = await loadSchedule();
  const byDate = {};

  // Group rows by Eastern Time Show Date
  rows.forEach(r => {
    const rawDate = r["Show Date"];
    if (!rawDate) return;

    const dateET = toEastern(rawDate);
    const dateKey = dateET.toISOString().split("T")[0];
    const dayName = dateET.toLocaleDateString("en-US", { weekday: "long", timeZone: "America/New_York" });
    const monthDay = dateET.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });

    if (!byDate[dateKey]) byDate[dateKey] = { rows: [], dayName, monthDay };
    byDate[dateKey].rows.push(r);
  });

  const navContainer = document.getElementById("schedule-nav");
  const container = document.getElementById("schedule");
  container.innerHTML = "";
  [...navContainer.querySelectorAll("button")].forEach(b => b.remove());
  const dayButtons = {};

  // Create navbar
  Object.keys(byDate).sort().forEach(dateKey => {
    const btn = document.createElement("button");
    btn.className = "nav-day-btn";
    const dayDiv = document.createElement("div");
    dayDiv.textContent = byDate[dateKey].dayName;
    dayDiv.className = "day-name";
    const monthDiv = document.createElement("div");
    monthDiv.textContent = byDate[dateKey].monthDay;
    monthDiv.className = "month-day";
    btn.appendChild(dayDiv);
    btn.appendChild(monthDiv);
    btn.onclick = () => {
      const dayDiv = document.getElementById("day-" + dateKey.replace(/\//g, "-"));
      if (dayDiv) dayDiv.scrollIntoView({ behavior: "smooth", block: "start" });
      highlightDay(dateKey);
    };
    navContainer.appendChild(btn);
    dayButtons[dateKey] = btn;
  });

  function highlightDay(dateKey) {
    Object.keys(dayButtons).forEach(d => dayButtons[d].classList.remove("active"));
    if (dayButtons[dateKey]) dayButtons[dateKey].classList.add("active");
  }

  // Render each day
  Object.keys(byDate).sort().forEach(dateKey => {
    const dayDiv = document.createElement("div");
    dayDiv.className = "day-block";
    dayDiv.id = "day-" + dateKey.replace(/\//g, "-");
    dayDiv.innerHTML = `<div class='day-title'>${byDate[dateKey].dayName}, ${byDate[dateKey].monthDay}</div>`;

    const runs = byDate[dateKey].rows;
    const groups = {};

    // Group runs by Show Name
    runs.forEach(run => {
      const key = `${run["Show"] || ""}|${dateKey}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(run);
    });

    // Render shows sorted by first run start time
    Object.keys(groups)
      .sort((a, b) => {
        const startA = toEastern(groups[a][0]["Show Start (Eastern)"]).getTime();
        const startB = toEastern(groups[b][0]["Show Start (Eastern)"]).getTime();
        return startA - startB;
      })
      .forEach(key => {
        const [showName, _] = key.split("|");
        const showTemplate = document.getElementById("show-template");
        const clone = document.importNode(showTemplate.content, true);
        const img = clone.querySelector(".show-logo");
        img.src = resolveLogo(showName);
        img.onerror = () => { img.src = "Logos/GDQ Logo.png"; };
        const info = clone.querySelector(".show-info");

        const firstRun = groups[key][0];
        const startDateObj = toEastern(firstRun["Show Start (Eastern)"]);

        info.innerHTML = `
          <span class="show-time">${formatRunStart(startDateObj)}</span>
          <span class="show-subtitle">Hosted by: ${firstRun["Host"] || "TBA"}</span>
        `;
        info.style.display = "flex";
        info.style.flexDirection = "column";
        info.style.alignItems = "center";

        const header = clone.querySelector(".show-header");
        header.style.display = "grid";
        header.style.gridTemplateColumns = "120px 1fr";
        header.style.justifyContent = "center";
        header.style.alignItems = "center";

        const runHeader = document.createElement("div");
        runHeader.className = "run-header-row";
        runHeader.style.gridTemplateColumns = "2fr 1fr 1fr 2fr";
        runHeader.innerHTML = `
          <div>Game Info</div>
          <div>Estimated Start Time</div>
          <div>Estimate</div>
          <div>Runner(s)</div>
        `;
        clone.querySelector(".run-container").appendChild(runHeader);

        // Compute run start times
        let baseTime = startDateObj;
        groups[key].forEach((run, i) => {
          if (i > 0) baseTime = new Date(baseTime.getTime() + 600000); // 10 min setup
          run._computedStart = new Date(baseTime);
          const durationMs = parseEstimateToMs(parseEstimate(run["Estimate"]));
          baseTime = addDurationToDate(baseTime, durationMs);
        });

        // Render runs
        groups[key].forEach(run => {
          const runTemplate = document.getElementById("run-template");
          const runClone = document.importNode(runTemplate.content, true);
          const runRow = runClone.querySelector(".run-row");
          runRow.style.gridTemplateColumns = "2fr 1fr 1fr 2fr";

          const startDiv = document.createElement("div");
          startDiv.className = "run-start";
          startDiv.textContent = formatRunStart(run._computedStart);
          runRow.insertBefore(startDiv, runRow.children[1]);

          runClone.querySelector(".game").textContent = run["Game"] || "";
          runClone.querySelector(".category").textContent = run["Category"] || "";
          runClone.querySelector(".estimate").textContent = parseEstimate(run["Estimate"]);
          runClone.querySelector(".runner").innerHTML = renderRunners(run["Runners"], run["Runner Stream"]);

          runRow.addEventListener("click", (e) => {
            if (e.target.closest(".runner")) return;
            const runDate = toEastern(run["Show Date"]);
            const today = toEastern(new Date()); today.setHours(0,0,0,0);
            const url = runDate >= today
              ? "https://www.twitch.tv/gamesdonequick"
              : "https://www.twitch.tv/gamesdonequick/videos?filter=archives&sort=time";
            window.open(url, "_blank");
          });

          clone.querySelector(".run-container").appendChild(runClone);
        });

        dayDiv.appendChild(clone);
      });

    container.appendChild(dayDiv);
  });

  // Scroll to today or nearest past day
  (function scrollToCurrentOrPastDay() {
    const now = toEastern(new Date());
    const sortedDates = Object.keys(byDate)
      .map(d => ({ key: d, date: toEastern(d) }))
      .sort((a,b) => a.date - b.date);

    let target = sortedDates.find(d => isSameDay(d.date, now));
    if (!target) {
      const past = sortedDates.filter(d => d.date <= now);
      target = past.length ? past[past.length - 1] : sortedDates[0];
    }
    if (target) {
      const dayDiv = document.getElementById("day-" + target.key.replace(/\//g, "-"));
      if (dayDiv) dayDiv.scrollIntoView({ behavior: "smooth", block: "start" });
      highlightDay(target.key);
    }

    function isSameDay(a, b) {
      return a.getFullYear() === b.getFullYear() &&
             a.getMonth() === b.getMonth() &&
             a.getDate() === b.getDate();
    }
  })();
}

renderSchedule();
