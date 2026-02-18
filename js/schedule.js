// schedule.js - timezone-aware, DST-safe, pulls only needed parts from each field

// -------------------------------------------------------------
// DATA URL
// -------------------------------------------------------------
const DATA_URL = "https://script.google.com/macros/s/AKfycbyxanGFzAWbQV4Fso__LJh5eOb4GDjBYHx6sK79FTu3ww6z0sYs603UbQeEr-aKRoK7/exec";

// -------------------------------------------------------------
// Selected timezone (default ET, updated by dropdown)
// -------------------------------------------------------------
let selectedTimezone = "America/New_York";

// -------------------------------------------------------------
// Data cache — fetched once, re-used on every timezone change.
// Set to null to force a fresh fetch (e.g. when Apply is clicked).
// -------------------------------------------------------------
let cachedRows = null;

// -------------------------------------------------------------
// Hardcoded links
// -------------------------------------------------------------
const showLinks = {
  "creature corner": "https://youtube.com/playlist?list=PLz8YL4HVC87UKC3XkXFvdtBUSWEY3yUQf&si=jBRc0S240tx8E49Y",
  "crosshair": "https://youtube.com/playlist?list=PLz8YL4HVC87VcaUDbDWdEbWFEq5VsV6d1&si=bPlmWBGWF7daDQBu",
  "do all the things": "https://www.youtube.com/playlist?list=PLz8YL4HVC87WNnWalkZ1_Y0Akj7XWW4Vw",
  "express lane": "https://www.youtube.com/playlist?list=PLz8YL4HVC87V34Lpnb_pZfAeWD7x621Bd",
  "fast travel": "https://www.youtube.com/watch?v=SrWGCa3ySjs",
  "game masters": "https://www.youtube.com/playlist?list=PLz8YL4HVC87XLYlt1uzi27QHHmayv3oGS",
  "hidden heroes": "https://youtube.com/playlist?list=PLz8YL4HVC87WjPar_Eq90pvlG2DTPhSYX&si=TNH8UfeZz1oqTbzl",
  "make your own victory": "https://youtube.com/playlist?list=PLz8YL4HVC87XcumtO80kwUxENXbyqZef0&si=9TDZsWN0PshWRblS",
  "out of the box": "https://youtube.com/playlist?list=PLz8YL4HVC87WaX9WEEyn66SFc92Z9UdUi&si=JolFPAxGQ4zMdknD",
  "parallel universe": "https://www.youtube.com/playlist?list=PLz8YL4HVC87V6qlkU5tHzXQRSw0vPmTau",
  "passion project": "https://www.youtube.com/playlist?list=PLz8YL4HVC87UBkPm9UtoEkAr8pJPgkXMD",
  "perilous paths": "https://www.youtube.com/playlist?list=PLz8YL4HVC87UHCbLaUJrsFSHHKlQQ6l5o",
  "random number generation": "https://www.youtube.com/playlist?list=PLz8YL4HVC87WvvILEYCszbneK4sp1eU8K",
  "speedruns from the crypt": "https://www.youtube.com/playlist?list=PLz8YL4HVC87X6rZMXsh-EW663t7zTnxNG",
  "the scenic route": "https://www.youtube.com/watch?v=AWPTBpfYD0Q",
  "think fast": "https://www.youtube.com/playlist?list=PLz8YL4HVC87X9I54nPFBYLnJs4nKVs4zI",
  "dnd": "https://awnnetwork.org/"
};

const hostLinks = {
  "satanherself": "https://twitch.tv/SatanIsntHerself",
  "danejerus": "https://twitch.tv/danejerus",
  "mr_shasta": "https://twitch.tv/Mr_Shasta",
  "asuka424": "https://twitch.tv/Asuka424",
  "nickrpgreen": "https://twitch.tv/NickRPGreen",
  "kiara_tv": "https://twitch.tv/Kiara_TV",
  "anarchy": "https://twitch.tv/anarchyasf",
  "quacksilver": "https://twitch.tv/QuacksilverPlays",
  "ateatree": "https://twitch.tv/ateatree",
  "helix": "https://twitch.tv/Helix13_",
  "ambercyprian": "https://twitch.tv/AmberCyprian",
  "queuety": "https://twitch.tv/Queuety",
  "skybilz": "https://twitch.tv/Skybilz",
  "ecdycis": "https://twitch.tv/Ecdycis",
  "ozmourn": "https://twitch.tv/Ozmourn",
  "swooce": "https://twitch.tv/swooce19",
  "jyggy": "https://twitch.tv/jyggy",
  "churchnsarge": "https://twitch.tv/ChurchnSarge",
  "sparkle": "https://twitch.tv/Sparkle"
};

// -------------------------------------------------------------
// Load schedule data (fetches once, then uses cache).
// -------------------------------------------------------------
async function loadSchedule() {
  if (cachedRows) return cachedRows;
  const res = await fetch(`${DATA_URL}?t=${Date.now()}`);
  cachedRows = await res.json();
  return cachedRows;
}

// -------------------------------------------------------------
// DST-aware Eastern offset detection
//
// Returns the number of hours ET is behind UTC on a given date.
//   EST (winter): 5
//   EDT (summer): 4
//
// We ask Intl.DateTimeFormat what hour it is in New York for a
// given UTC moment, then compare to the actual UTC hour.
// This is fully DST-aware and correct for any date.
// -------------------------------------------------------------
function getEasternOffsetHours(dateForContext) {
  const d = dateForContext instanceof Date ? dateForContext : new Date(dateForContext);
  // Use noon UTC on the show date to avoid any midnight edge cases
  const noon = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0));
  const utcHour = noon.getUTCHours(); // always 12
  const etHour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      hour12: false
    }).format(noon)
  );
  let offset = utcHour - etHour;
  if (offset > 12) offset -= 24; // handle any wrap
  return offset; // 5 for EST, 4 for EDT
}

// -------------------------------------------------------------
// Field parsers
//
// All three fields come from Google Sheets as ISO timestamps in UTC.
// Sheets stores Eastern times with a baked-in offset — but that offset
// changes on DST boundaries. We detect the correct offset per date
// instead of hardcoding -5.
//
// Show Date:  "2026-02-17T05:00:00.000Z" → midnight ET (EST: UTC-5 → 05:00Z)
//             "2026-03-15T04:00:00.000Z" → midnight ET (EDT: UTC-4 → 04:00Z)
// Show Start: "1899-12-31T00:00:00.000Z" → time-only serial (7 PM ET in winter = 00:00Z)
//             "1899-12-31T23:00:00.000Z" → time-only serial (7 PM ET in summer = 23:00Z)
// Estimate:   "1899-12-30T08:10:00.000Z" → 3:10:00 in winter
//             "1899-12-30T07:10:00.000Z" → 3:10:00 in summer
// -------------------------------------------------------------

/**
 * parseShowDate(raw)
 * Returns a Date representing midnight ET on the show date.
 * The UTC value from Sheets is already the correct moment.
 */
function parseShowDate(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d) ? null : d;
}

/**
 * parseShowStart(raw, offsetHours)
 * Extracts the ET time-of-day from the Sheets time serial.
 * offsetHours = 5 for EST, 4 for EDT.
 * Returns { h, m } in ET.
 */
function parseShowStart(raw, offsetHours) {
  if (!raw) return { h: 0, m: 0 };
  const d = new Date(raw);
  if (isNaN(d)) return { h: 0, m: 0 };
  let h = d.getUTCHours() - offsetHours;
  const m = d.getUTCMinutes();
  if (h < 0) h += 24;
  return { h, m };
}

/**
 * parseEstimate(raw, offsetHours)
 * Extracts the duration from the Sheets time serial.
 * offsetHours = 5 for EST, 4 for EDT.
 * Returns { h, m, s } as a duration.
 */
function parseEstimate(raw, offsetHours) {
  if (!raw) return { h: 0, m: 0, s: 0 };
  const d = new Date(raw);
  if (isNaN(d)) return { h: 0, m: 0, s: 0 };
  let h = d.getUTCHours() - offsetHours;
  const m = d.getUTCMinutes();
  const s = d.getUTCSeconds();
  if (h < 0) h += 24;
  return { h, m, s };
}

function estimateToMs(raw, offsetHours) {
  const { h, m, s } = parseEstimate(raw, offsetHours);
  return (h * 3600 + m * 60 + s) * 1000;
}

function formatEstimateString(raw, offsetHours) {
  const { h, m, s } = parseEstimate(raw, offsetHours);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * buildShowStartUtc(showDateRaw, showStartRaw)
 * Combines Show Date (date) + Show Start (time) into a real UTC timestamp.
 * Automatically detects whether the show date is in EST or EDT.
 */
function buildShowStartUtc(showDateRaw, showStartRaw) {
  const dateD = parseShowDate(showDateRaw);
  if (!dateD) return null;

  // Detect the correct ET offset for this specific show date
  const offsetHours = getEasternOffsetHours(dateD);

  const { h, m } = parseShowStart(showStartRaw, offsetHours);
  const etMidnightMs = dateD.getTime(); // midnight ET as UTC ms
  const showStartUtcMs = etMidnightMs + (h * 60 + m) * 60 * 1000;
  return new Date(showStartUtcMs);
}

// -------------------------------------------------------------
// Timezone display helpers
// -------------------------------------------------------------

function getDateKeyInZone(utcDate, tz) {
  if (!utcDate) return "Invalid Date";
  const d = utcDate instanceof Date ? utcDate : new Date(utcDate);
  if (isNaN(d)) return "Invalid Date";
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = fmt.formatToParts(d);
  const get = (t) => parts.find(p => p.type === t)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function getDayLabelInZone(utcDate, tz) {
  if (!utcDate) return { dayName: "", monthDay: "" };
  const d = utcDate instanceof Date ? utcDate : new Date(utcDate);
  if (isNaN(d)) return { dayName: "", monthDay: "" };
  return {
    dayName: d.toLocaleDateString("en-US", { weekday: "long", timeZone: tz }),
    monthDay: d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: tz })
  };
}

function formatTimeInZone(utcDate, tz) {
  if (!utcDate) return "";
  const d = utcDate instanceof Date ? utcDate : new Date(utcDate);
  if (isNaN(d)) return "";
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: tz
  });
}

// -------------------------------------------------------------
// Utilities
// -------------------------------------------------------------
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

function renderHost(hostNames = "") {
  if (!hostNames) return "";
  const names = String(hostNames).split(",").map(s => s.trim()).filter(Boolean);
  return names.map(name => {
    const url = hostLinks[name.toLowerCase()] || "#";
    return `<a href="${url}" target="_blank" class="runner-pill">${name}</a>`;
  }).join(" ");
}

// -------------------------------------------------------------
// Timezone label helpers
// -------------------------------------------------------------
function getTzLabel(tz) {
  const labels = {
    "America/New_York":    "All Times Eastern",
    "America/Chicago":     "All Times Central",
    "America/Denver":      "All Times Mountain",
    "America/Los_Angeles": "All Times Pacific",
    "America/Anchorage":   "All Times Alaska",
    "Pacific/Honolulu":    "All Times Hawaii",
    "Europe/London":       "All Times London",
    "Europe/Paris":        "All Times Central Europe",
    "Europe/Helsinki":     "All Times Eastern Europe",
    "Asia/Tokyo":          "All Times Japan",
    "Australia/Sydney":    "All Times Sydney",
    "UTC":                 "All Times UTC"
  };
  return labels[tz] || "All Times " + tz;
}

function updateTzLabels() {
  const label = getTzLabel(selectedTimezone);
  const h1span = document.getElementById("tz-label");
  if (h1span) h1span.textContent = label;
  const navspan = document.getElementById("tz-label-nav");
  if (navspan) navspan.textContent = label + "!";
}

// -------------------------------------------------------------
// Main rendering
// -------------------------------------------------------------
async function renderSchedule() {
  const rows = await loadSchedule();
  if (!Array.isArray(rows)) return;

  // Pre-process: build correct UTC timestamps using DST-aware offset per row
  rows.forEach(r => {
    r._showStartUtc = buildShowStartUtc(r["Show Date"], r["Show Start (Eastern)"]);
    // Store the offset so estimate parsing uses the same value
    r._etOffset = r._showStartUtc
      ? getEasternOffsetHours(parseShowDate(r["Show Date"]))
      : 5;
  });

  const byDate = {};
  rows.forEach(r => {
    if (!r._showStartUtc) return;
    const dateKey = getDateKeyInZone(r._showStartUtc, selectedTimezone);
    const { dayName, monthDay } = getDayLabelInZone(r._showStartUtc, selectedTimezone);
    if (!byDate[dateKey]) byDate[dateKey] = { rows: [], dayName, monthDay };
    byDate[dateKey].rows.push(r);
  });

  const navContainer = document.getElementById("schedule-nav");
  const container = document.getElementById("schedule");
  if (!navContainer || !container) return;

  container.innerHTML = "";
  [...navContainer.querySelectorAll("button")].forEach(b => b.remove());
  const dayButtons = {};

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
      const el = document.getElementById("day-" + dateKey);
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

  Object.keys(byDate).sort().forEach(dateKey => {
    const dayBlock = document.createElement("div");
    dayBlock.className = "day-block";
    dayBlock.id = "day-" + dateKey;

    const { dayName, monthDay } = byDate[dateKey];
    dayBlock.innerHTML = `<div class='day-title'>${dayName}, ${monthDay}</div>`;

    const runs = byDate[dateKey].rows;
    const groups = {};

    runs.forEach(run => {
      const show = run["Show"] || "";
      const host = run["Host"] || "TBA";
      const key = `${show}|${host}|${dateKey}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(run);
    });

    Object.keys(groups)
      .sort((a, b) => groups[a][0]._showStartUtc - groups[b][0]._showStartUtc)
      .forEach(key => {
        const [showName, hostName] = key.split("|");
        const showTemplate = document.getElementById("show-template");
        const clone = document.importNode(showTemplate.content, true);

        const img = clone.querySelector(".show-logo");
        img.src = resolveLogo(showName);
        img.onerror = () => { img.src = "Logos/GDQ Logo.png"; };
        const showUrl = showLinks[showName.toLowerCase()];
        if (showUrl) {
          const parent = img.parentNode;
          const a = document.createElement("a");
          a.href = showUrl;
          a.target = "_blank";
          parent.replaceChild(a, img);
          a.appendChild(img);
        }

        const info = clone.querySelector(".show-info");
        const firstRun = groups[key][0];
        const firstStart = firstRun._showStartUtc;
        const showTime = formatTimeInZone(firstStart, selectedTimezone);

        info.style.display = "flex";
        info.style.flexDirection = "column";
        info.style.alignItems = "center";

        info.innerHTML = `
          <a class="show-time" href="https://www.twitch.tv/gamesdonequick" target="_blank">${showTime}</a>
          <span class="show-subtitle">Hosted by: ${renderHost(hostName)}</span>
        `;

        const showTimeEl = clone.querySelector(".show-time");
        if (showTimeEl) showTimeEl.addEventListener("click", e => e.stopPropagation());

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

        let runningTime = firstStart.getTime();
        groups[key].forEach((run, i) => {
          if (i > 0) runningTime += 10 * 60 * 1000;
          run._computedStart = new Date(runningTime);
          runningTime += estimateToMs(run["Estimate"], run._etOffset);
        });

        groups[key].forEach(run => {
          const runTemplate = document.getElementById("run-template");
          const runClone = document.importNode(runTemplate.content, true);
          const runRow = runClone.querySelector(".run-row");
          runRow.style.gridTemplateColumns = "2fr 1fr 1fr 2fr";

          const startDiv = document.createElement("div");
          startDiv.className = "run-start";
          startDiv.textContent = formatTimeInZone(run._computedStart, selectedTimezone);
          runRow.insertBefore(startDiv, runRow.children[1]);

          runClone.querySelector(".game").textContent = run["Game"] || "";
          runClone.querySelector(".category").textContent = run["Category"] || "";
          runClone.querySelector(".estimate").textContent = formatEstimateString(run["Estimate"], run._etOffset);
          runClone.querySelector(".runner").innerHTML = renderRunners(run["Runners"], run["Runner Stream"]);

          runRow.addEventListener("click", e => {
            if (e.target.closest(".runner")) return;
            const runDateKey = getDateKeyInZone(run._computedStart, selectedTimezone);
            const todayKey = getDateKeyInZone(new Date(), selectedTimezone);
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

  (function scrollToCurrentOrPastDay() {
    const todayKey = getDateKeyInZone(new Date(), selectedTimezone);
    const sortedDateKeys = Object.keys(byDate).sort();
    if (!sortedDateKeys.length) return;
    const chosen = sortedDateKeys.includes(todayKey)
      ? todayKey
      : [...sortedDateKeys].reverse().find(d => d <= todayKey) || sortedDateKeys[0];
    const el = document.getElementById("day-" + chosen);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      highlightDay(chosen);
    }
  })();
}

// -------------------------------------------------------------
// Timezone dropdown wiring + initial render
// -------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  const select = document.getElementById("tz-select");
  const btn = document.getElementById("tz-refresh");
  const tzBar = document.getElementById("tz-bar");
  const tzSpacer = document.getElementById("tz-spacer");

  // Pin the bar to the bottom of the viewport on load
  tzBar.classList.add("pinned");
  tzSpacer.style.display = "block";

  // Auto-detect user's timezone and pre-select it if it's in the list
  try {
    const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    for (const opt of select.options) {
      if (opt.value === userTz) {
        opt.selected = true;
        break;
      }
    }
    selectedTimezone = select.value;
  } catch (e) {
    // Fall back to ET if detection fails
  }

  // Dropdown change: re-render with cached data in new timezone
  select.addEventListener("change", () => {
    selectedTimezone = select.value;
    updateTzLabels();
    renderSchedule();
  });

  // Apply button: unpin the bar, clear cache for fresh fetch, re-render
  btn.addEventListener("click", () => {
    tzBar.classList.remove("pinned");
    tzSpacer.style.display = "none";
    cachedRows = null;
    selectedTimezone = select.value;
    updateTzLabels();
    renderSchedule();
  });

  updateTzLabels();

  // Initial render — after selectedTimezone is set
  renderSchedule().catch(err => console.error("renderSchedule error:", err));
});
