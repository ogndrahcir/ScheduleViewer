// schedule.js - full rewrite (ET-first, timezone-proof)

// DATA URL
const DATA_URL = "https://script.google.com/macros/s/AKfycbyxanGFzAWbQV4Fso__LJh5eOb4GDjBYHx6sK79FTu3ww6z0sYs603UbQeEr-aKRoK7/exec";

// -----------------------------
// Load data
// -----------------------------
async function loadSchedule() {
  const res = await fetch(`${DATA_URL}?t=${Date.now()}`);
  const data = await res.json();
  return data;
}

// -----------------------------
// Time / ET helpers
// -----------------------------
// Use Intl.DateTimeFormat.formatToParts to extract ET wall-clock components
function getEasternParts(utcInput) {
  if (!utcInput) return null;
  const d = (utcInput instanceof Date) ? utcInput : new Date(utcInput);
  if (isNaN(d)) return null;

  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  const parts = fmt.formatToParts(d);
  const get = (t) => Number(parts.find(p => p.type === t)?.value || 0);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second")
  };
}

// Build a YYYY-MM-DD key from ET parts
function buildDateKeyFromParts(parts) {
  if (!parts) return "Invalid Date";
  const yyyy = String(parts.year).padStart(4, "0");
  const mm = String(parts.month).padStart(2, "0");
  const dd = String(parts.day).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Format a UTC Date object as ET time string (e.g. "7:00 PM")
function formatTimeAsET(utcDate) {
  if (!utcDate) return "";
  const d = (utcDate instanceof Date) ? utcDate : new Date(utcDate);
  if (isNaN(d)) return "";
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/New_York"
  });
}

// Format an ET date (full display like "Saturday, December 13, 2025")
function formatDateDisplayFromUtc(utcDate) {
  if (!utcDate) return "";
  const d = (utcDate instanceof Date) ? utcDate : new Date(utcDate);
  if (isNaN(d)) return "";
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York"
  });
}

// Format small navbar parts from a UTC date
function formatNavbarPartsFromUtc(utcDate) {
  if (!utcDate) return { dayName: "", monthDay: "" };
  const d = (utcDate instanceof Date) ? utcDate : new Date(utcDate);
  if (isNaN(d)) return { dayName: "", monthDay: "" };
  return {
    dayName: d.toLocaleDateString("en-US", { weekday: "long", timeZone: "America/New_York" }),
    monthDay: d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })
  };
}

// -----------------------------
// Estimate (duration) helpers
// Estimates are stored as UTC timestamps (e.g. 1899-12-30T06:00:00.000Z)
// but are 5 hours too large. Subtract 5 hours to get the real duration.
// Format choice A: H:MM:SS (hours not zero-padded)
// -----------------------------
function parseEstimatePartsFromTimestamp(raw) {
  if (!raw) return { h: 0, m: 0, s: 0 };

  // If raw is a timestamp parse it with Date and take UTC parts
  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    let h = d.getUTCHours();
    const m = d.getUTCMinutes();
    const s = d.getUTCSeconds();

    // subtract 5 hours (as requested)
    h = h - 5;

    // Normalize (for durations we want positive values)
    // If h < 0, wrap by adding 24 until >=0
    while (h < 0) h += 24;

    return { h, m, s };
  }

  // Fallback: parse strings like "H:MM:SS" or "MM:SS"
  const str = String(raw).trim();
  const parts = str.split(":").map(p => Number(p));
  if (parts.length === 3 && parts.every(p => !isNaN(p))) return { h: parts[0], m: parts[1], s: parts[2] };
  if (parts.length === 2 && parts.every(p => !isNaN(p))) return { h: 0, m: parts[0], s: parts[1] };
  return { h: 0, m: 0, s: 0 };
}

function formatDurationA(h, m, s) {
  // format A: H:MM:SS (no forced leading 0 on hours)
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function parseEstimateToMs(raw) {
  const p = parseEstimatePartsFromTimestamp(raw);
  return (p.h * 3600000) + (p.m * 60000) + (p.s * 1000);
}

function formatEstimateString(raw) {
  const p = parseEstimatePartsFromTimestamp(raw);
  return formatDurationA(p.h, p.m, p.s);
}

// -----------------------------
// Small utilities
// -----------------------------
function resolveLogo(showName) {
  if (!showName) return "Logos/GDQ Logo.png";
  const name = String(showName).replace(/[/\\?%*:|"<>]/g, "");
  return `Logos/${name}.png`;
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

// -----------------------------
// Main rendering
// -----------------------------
async function renderSchedule() {
  const rows = await loadSchedule();
  if (!Array.isArray(rows)) {
    console.error("Expected array from API, got:", rows);
    return;
  }

  // Group by ET date key (YYYY-MM-DD)
  const byDate = {};

  rows.forEach(r => {
    const rawShowDate = r["Show Date"];
    if (!rawShowDate) return;

    // Derive ET parts for the Show Date so grouping is by ET date, not raw UTC
    const etPartsForShowDate = getEasternParts(rawShowDate);
    const dateKey = buildDateKeyFromParts(etPartsForShowDate);
    const { dayName, monthDay } = formatNavbarPartsFromUtc(rawShowDate);

    if (!byDate[dateKey]) byDate[dateKey] = { rows: [], dayName, monthDay };
    byDate[dateKey].rows.push(r);
  });

  const navContainer = document.getElementById("schedule-nav");
  const container = document.getElementById("schedule");
  if (!navContainer || !container) {
    console.error("Missing #schedule-nav or #schedule element in DOM");
    return;
  }

  // Clear previous
  container.innerHTML = "";
  [...navContainer.querySelectorAll("button")].forEach(b => b.remove());
  const dayButtons = {};

  // Build navbar buttons
  Object.keys(byDate).sort().forEach(dateKey => {
    const btn = document.createElement("button");
    btn.className = "nav-day-btn";

    const dayDiv = document.createElement("div");
    dayDiv.className = "day-name";
    dayDiv.textContent = byDate[dateKey].dayName;

    const monthDiv = document.createElement("div");
    monthDiv.className = "month-day";
    monthDiv.textContent = byDate[dateKey].monthDay;

    btn.appendChild(dayDiv);
    btn.appendChild(monthDiv);

    btn.addEventListener("click", () => {
      const el = document.getElementById("day-" + dateKey.replace(/\//g, "-"));
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      highlightDay(dateKey);
    });

    navContainer.appendChild(btn);
    dayButtons[dateKey] = btn;
  });

  function highlightDay(dateKey) {
    Object.keys(dayButtons).forEach(k => dayButtons[k].classList.remove("active"));
    if (dayButtons[dateKey]) dayButtons[dateKey].classList.add("active");
  }

  // Render each day block
  Object.keys(byDate).sort().forEach(dateKey => {
    const dayBlock = document.createElement("div");
    dayBlock.className = "day-block";
    dayBlock.id = "day-" + dateKey.replace(/\//g, "-");
    dayBlock.innerHTML = `<div class='day-title'>${byDate[dateKey].dayName}, ${byDate[dateKey].monthDay}</div>`;

    const runs = byDate[dateKey].rows;

    // Group runs by Show so multiple runs for same show are in same block
    const groups = {};
    runs.forEach(run => {
      const key = `${run["Show"] || ""}|${dateKey}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(run);
    });

    // Sort groups (shows) by their first run's start time (actual UTC instant)
    Object.keys(groups)
      .sort((a, b) => {
        const aFirst = groups[a][0]["Show Start (Eastern)"];
        const bFirst = groups[b][0]["Show Start (Eastern)"];
        const aDate = new Date(aFirst);
        const bDate = new Date(bFirst);
        return aDate - bDate;
      })
      .forEach(key => {
        const [showName] = key.split("|");
        const showTemplate = document.getElementById("show-template");
        const clone = document.importNode(showTemplate.content, true);

        const img = clone.querySelector(".show-logo");
        img.src = resolveLogo(showName);
        img.onerror = () => { img.src = "Logos/GDQ Logo.png"; };

        const info = clone.querySelector(".show-info");
        const firstRun = groups[key][0];
        const firstStartUtcInstant = new Date(firstRun["Show Start (Eastern)"]); // parse UTC instant
        // show-time display in ET:
        const showTime = formatTimeAsET(firstStartUtcInstant);

        info.innerHTML = `
          <span class="show-time">${showTime}</span>
          <span class="show-subtitle">Hosted by: ${firstRun["Host"] || "TBA"}</span>
        `;
        info.style.display = "flex";
        info.style.flexDirection = "column";
        info.style.alignItems = "center";

        // header columns
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

        // Compute run start times:
        // baseTime is an actual UTC instant for the first run start.
        let baseTime = new Date(firstStartUtcInstant.getTime());

        groups[key].forEach((run, i) => {
          if (i > 0) {
            // add 10 minute setup between runs
            baseTime = new Date(baseTime.getTime() + (10 * 60 * 1000));
          }
          // computed start is the current baseTime (actual instant)
          run._computedStart = new Date(baseTime.getTime());
          // add the run's duration (parsed from Estimate) to baseTime
          const durationMs = parseEstimateToMs(run["Estimate"]);
          baseTime = new Date(baseTime.getTime() + durationMs);
        });

        // Render each run row
        groups[key].forEach(run => {
          const runTemplate = document.getElementById("run-template");
          const runClone = document.importNode(runTemplate.content, true);
          const runRow = runClone.querySelector(".run-row");
          runRow.style.gridTemplateColumns = "2fr 1fr 1fr 2fr";

          // Start column (formatted in ET)
          const startDiv = document.createElement("div");
          startDiv.className = "run-start";
          startDiv.textContent = formatTimeAsET(run._computedStart);
          runRow.insertBefore(startDiv, runRow.children[1]);

          runClone.querySelector(".game").textContent = run["Game"] || "";
          runClone.querySelector(".category").textContent = run["Category"] || "";
          runClone.querySelector(".estimate").textContent = formatEstimateString(run["Estimate"]);
          runClone.querySelector(".runner").innerHTML = renderRunners(run["Runners"], run["Runner Stream"]);

          runRow.addEventListener("click", (e) => {
            if (e.target.closest(".runner")) return;
            // decide twitch url depending on whether run date (ET) is today or future
            const runDateParts = getEasternParts(run["Show Date"]);
            if (!runDateParts) {
              window.open("https://www.twitch.tv/gamesdonequick", "_blank");
              return;
            }
            const runDateKey = buildDateKeyFromParts(runDateParts);
            // compute today's ET date key
            const todayParts = getEasternParts(new Date());
            const todayKey = buildDateKeyFromParts(todayParts);

            const url = runDateKey >= todayKey
              ? "https://www.twitch.tv/gamesdonequick"
              : "https://www.twitch.tv/gamesdonequick/videos?filter=archives&sort=time";
            window.open(url, "_blank");
          });

          clone.querySelector(".run-container").appendChild(runClone);
        });

        dayBlock.appendChild(clone);
      });

    container.appendChild(dayBlock);
  });

  // Scroll to today or nearest past day (ET)
  (function scrollToCurrentOrPastDay() {
    const todayParts = getEasternParts(new Date());
    const todayKey = buildDateKeyFromParts(todayParts);

    const sortedDateKeys = Object.keys(byDate).sort();
    if (sortedDateKeys.length === 0) return;

    // If today's key exists, pick that; otherwise pick nearest past day or earliest day
    if (sortedDateKeys.includes(todayKey)) {
      const el = document.getElementById("day-" + todayKey.replace(/\//g, "-"));
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        highlightDay(todayKey);
      }
      return;
    }

    // find last date <= todayKey
    let chosen = null;
    for (let i = sortedDateKeys.length - 1; i >= 0; i--) {
      if (sortedDateKeys[i] <= todayKey) {
        chosen = sortedDateKeys[i];
        break;
      }
    }
    if (!chosen) chosen = sortedDateKeys[0];

    const el = document.getElementById("day-" + chosen.replace(/\//g, "-"));
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      highlightDay(chosen);
    }
  })();
}

// Kick off:
renderSchedule().catch(err => console.error("renderSchedule error:", err));
