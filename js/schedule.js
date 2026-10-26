// data from spreadsheet
const DATA_URL = "https://script.google.com/macros/s/AKfycbzTPAKMSYPkY5PJSuxRYSDOHPvn1544IE4sox3HgdbcuSY_9iVcHHNygjUHp_njuYE1cA/exec";

// localStorage key for the last-good copy of the schedule JSON
const CACHE_KEY = "gdq-hotfix-schedule-v1";

// Eastern by default (replaced by the visitor's timezone on load if it's in the list)
let selectedTimezone = "America/New_York";

// Parsed rows with start times precomputed (see setRows). Null until data arrives.
let scheduleRows = null;
let activeDayKey = null;

// -------------------------------------------------------------
// Start the network request immediately, while the rest of the
// page is still being parsed. Apps Script is the slowest part of
// the load, so every millisecond it can start earlier counts.
// -------------------------------------------------------------
async function fetchFresh() {
  const res = await fetch(`${DATA_URL}?t=${Date.now()}`);
  if (!res.ok) throw new Error("HTTP " + res.status);
  const text = await res.text();
  const rows = JSON.parse(text);
  if (!Array.isArray(rows)) throw new Error("Unexpected data format");
  return { text, rows };
}
const freshPromise = fetchFresh();
freshPromise.catch(() => {}); // handled in init(); avoids an unhandled-rejection warning

function readCache() {
  try { return localStorage.getItem(CACHE_KEY); } catch (e) { return null; }
}
function writeCache(text) {
  try { localStorage.setItem(CACHE_KEY, text); } catch (e) { /* storage full/blocked: ignore */ }
}

// Show names and showrunner names
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
// Field parsers
//
// Show Date:  "2026-03-15T04:00:00.000Z" → midnight ET (EDT: UTC-4 → 04:00Z)
//             "2026-03-01T05:00:00.000Z" → midnight ET (EST: UTC-5 → 05:00Z)
//
// Show Start: "1899-12-30T18:00:00.000Z" → time-only serial.
//             Google Sheets ALWAYS encodes these with UTC-5 (EST) baked in,
//             regardless of what date the show falls on.
//             So 18:00Z - 5 = 13:00 ET (1 PM Eastern) always.
//
// Estimate:   "1899-12-30T07:15:00.000Z" → duration serial.
//             Also ALWAYS encoded with UTC-5 (EST) baked in by Sheets.
//             So 07:15Z - 5 = 2h15m always.
//             This is a fixed duration, NOT a clock time — DST never applies.
// -------------------------------------------------------------

function parseShowDate(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d) ? null : d;
}

function parseShowStart(raw) {
  if (!raw) return { h: 0, m: 0 };
  const d = new Date(raw);
  if (isNaN(d)) return { h: 0, m: 0 };
  let h = d.getUTCHours() - 5; // always 5 — Sheets serials are always UTC-5 encoded
  const m = d.getUTCMinutes();
  if (h < 0) h += 24;
  return { h, m };
}

function parseEstimate(raw) {
  if (!raw) return { h: 0, m: 0, s: 0 };
  const d = new Date(raw);
  if (isNaN(d)) return { h: 0, m: 0, s: 0 };
  let h = d.getUTCHours() - 5; // always 5 — Sheets serials are always UTC-5 encoded
  const m = d.getUTCMinutes();
  const s = d.getUTCSeconds();
  if (h < 0) h += 24;
  return { h, m, s };
}

function estimateToMs(raw) {
  const { h, m, s } = parseEstimate(raw);
  return (h * 3600 + m * 60 + s) * 1000;
}

function formatEstimateString(raw) {
  const { h, m, s } = parseEstimate(raw);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * buildShowStartUtc(showDateRaw, showStartRaw)
 *
 * Show Date  → which Eastern calendar day the show is on.
 * Show Start → the Eastern wall-clock time (e.g. 1 PM).
 *
 * These are combined as an Eastern WALL-CLOCK time and converted to UTC using
 * the offset that is actually in effect at that moment. (Adding "13 hours" to
 * midnight ET is wrong on the day DST ends/starts, because that day is 25/23
 * hours long: Nov 1 midnight is still EDT but 1 PM is already EST.)
 */
function buildShowStartUtc(showDateRaw, showStartRaw) {
  const dateD = parseShowDate(showDateRaw);
  if (!dateD) return null;

  // Read the Eastern calendar date. Sampling 12h after the Sheets "midnight" keeps
  // us safely inside the intended day even if the date arrives as 04:00Z or 05:00Z.
  const p = getFmt("etParts", ET_TZ).formatToParts(new Date(dateD.getTime() + 12 * 3600 * 1000));
  const g = t => Number(p.find(x => x.type === t).value);

  const { h, m } = parseShowStart(showStartRaw);
  return new Date(easternWallClockToUtcMs(g("year"), g("month"), g("day"), h, m));
}

const ET_TZ = "America/New_York";

// Eastern offset from UTC (in ms, negative) in effect at a given UTC instant
function getEtOffsetMs(utcMs) {
  const p = getFmt("etParts", ET_TZ).formatToParts(new Date(utcMs));
  const g = t => Number(p.find(x => x.type === t).value);
  const wallAsUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return wallAsUtc - Math.floor(utcMs / 1000) * 1000;
}

// Convert an Eastern wall-clock date/time to a real UTC timestamp (DST-aware).
// Two passes so the offset is looked up at the right instant near a transition.
function easternWallClockToUtcMs(year, month, day, hour, minute) {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const first = guess - getEtOffsetMs(guess);
  return guess - getEtOffsetMs(first);
}

// Parse everything that doesn't depend on the selected timezone ONCE per data load,
// instead of on every timezone change.
function setRows(rows) {
  rows.forEach(r => {
    r._showStartUtc = buildShowStartUtc(r["Show Date"], r["Show Start (Eastern)"]);
    r._estMs = estimateToMs(r["Estimate"]);
    r._estStr = formatEstimateString(r["Estimate"]);
  });
  scheduleRows = rows;
}

// -------------------------------------------------------------
// Timezone display helpers
// Intl.DateTimeFormat is expensive to construct, so build each
// (kind, timezone) formatter once and reuse it.
// -------------------------------------------------------------
const FORMAT_OPTS = {
  dateKey:  { year: "numeric", month: "2-digit", day: "2-digit" },
  weekday:  { weekday: "long" },
  monthDay: { month: "short", day: "numeric" },
  time:     { hour: "numeric", minute: "2-digit", hour12: true },
  etParts:  { year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" }
};
const fmtCache = new Map();
function getFmt(kind, tz) {
  const key = kind + "|" + tz;
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { ...FORMAT_OPTS[kind], timeZone: tz });
    fmtCache.set(key, f);
  }
  return f;
}

function toValidDate(utcDate) {
  if (!utcDate) return null;
  const d = utcDate instanceof Date ? utcDate : new Date(utcDate);
  return isNaN(d) ? null : d;
}

function getDateKeyInZone(utcDate, tz) {
  const d = toValidDate(utcDate);
  if (!d) return "Invalid Date";
  const parts = getFmt("dateKey", tz).formatToParts(d);
  const get = (t) => parts.find(p => p.type === t)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function getDayLabelInZone(utcDate, tz) {
  const d = toValidDate(utcDate);
  if (!d) return { dayName: "", monthDay: "" };
  return {
    dayName: getFmt("weekday", tz).format(d),
    monthDay: getFmt("monthDay", tz).format(d)
  };
}

function formatTimeInZone(utcDate, tz) {
  const d = toValidDate(utcDate);
  return d ? getFmt("time", tz).format(d) : "";
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
// Main rendering (synchronous — data is already in scheduleRows)
//   autoScroll: jump to today's (or the latest past) day
//   smooth:     animate that jump (off for the very first paint)
// A background refresh passes autoScroll:false so it never yanks
// the page out from under someone who is already reading.
// -------------------------------------------------------------
function renderSchedule({ autoScroll = true, smooth = true } = {}) {
  if (!scheduleRows) return;

  const navContainer = document.getElementById("schedule-nav");
  const container = document.getElementById("schedule");
  if (!navContainer || !container) return;

  const prevScrollY = window.scrollY;
  const tz = selectedTimezone;

  // Group rows by day in the selected timezone
  const byDate = {};
  scheduleRows.forEach(r => {
    if (!r._showStartUtc) return;
    const dateKey = getDateKeyInZone(r._showStartUtc, tz);
    if (!byDate[dateKey]) {
      const { dayName, monthDay } = getDayLabelInZone(r._showStartUtc, tz);
      byDate[dateKey] = { rows: [], dayName, monthDay };
    }
    byDate[dateKey].rows.push(r);
  });

  const sortedDateKeys = Object.keys(byDate).sort();
  const dayButtons = {};

  function highlightDay(dateKey) {
    activeDayKey = dateKey;
    Object.keys(dayButtons).forEach(k => dayButtons[k].classList.remove("active"));
    if (dayButtons[dateKey]) dayButtons[dateKey].classList.add("active");
  }

  // ---- Day nav buttons ----
  const navFrag = document.createDocumentFragment();
  sortedDateKeys.forEach(dateKey => {
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

    navFrag.appendChild(btn);
    dayButtons[dateKey] = btn;
  });

  // ---- Day blocks ----
  const showTemplate = document.getElementById("show-template");
  const runTemplate = document.getElementById("run-template");
  const frag = document.createDocumentFragment();

  sortedDateKeys.forEach(dateKey => {
    const dayBlock = document.createElement("div");
    dayBlock.className = "day-block";
    dayBlock.id = "day-" + dateKey;

    const { dayName, monthDay } = byDate[dateKey];
    dayBlock.innerHTML = `<div class='day-title'>${dayName}, ${monthDay}</div>`;

    const groups = {};
    byDate[dateKey].rows.forEach(run => {
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
        const clone = document.importNode(showTemplate.content, true);

        const img = clone.querySelector(".show-logo");
        img.loading = "lazy";
        img.decoding = "async";
        img.onerror = () => { img.onerror = null; img.src = "Logos/GDQ Logo.png"; };
        img.src = resolveLogo(showName);
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
        const showTime = formatTimeInZone(firstStart, tz);

        info.style.display = "flex";
        info.style.flexDirection = "column";
        info.style.alignItems = "center";

        info.innerHTML = `
          <a class="show-time" href="https://www.twitch.tv/gamesdonequick" target="_blank">${showTime}</a>
          <span class="show-subtitle">Hosted by: ${renderHost(hostName)}</span>
        `;

        const header = clone.querySelector(".show-header");
        header.style.display = "grid";
        header.style.gridTemplateColumns = "120px 1fr";
        header.style.justifyContent = "center";
        header.style.alignItems = "center";

        const runContainer = clone.querySelector(".run-container");
        const runHeader = document.createElement("div");
        runHeader.className = "run-header-row";
        runHeader.style.gridTemplateColumns = "2fr 1fr 1fr 2fr";
        runHeader.innerHTML = `
          <div>Game Info</div>
          <div>Estimated Start Time</div>
          <div>Estimate</div>
          <div>Runner(s)</div>
        `;
        runContainer.appendChild(runHeader);

        // 6 minutes in between runs
        let runningTime = firstStart.getTime();
        groups[key].forEach((run, i) => {
          if (i > 0) runningTime += 6 * 60 * 1000;
          run._computedStart = new Date(runningTime);
          runningTime += run._estMs;
        });

        groups[key].forEach(run => {
          const runClone = document.importNode(runTemplate.content, true);
          const runRow = runClone.querySelector(".run-row");
          runRow.style.gridTemplateColumns = "2fr 1fr 1fr 2fr";
          // Read by the single delegated click handler (see DOMContentLoaded below)
          runRow.dataset.start = run._computedStart.getTime();

          const startDiv = document.createElement("div");
          startDiv.className = "run-start";
          startDiv.textContent = formatTimeInZone(run._computedStart, tz);
          runRow.insertBefore(startDiv, runRow.children[1]);

          runClone.querySelector(".game").textContent = run["Game"] || "";
          runClone.querySelector(".category").textContent = run["Category"] || "";
          runClone.querySelector(".estimate").textContent = run._estStr;
          runClone.querySelector(".runner").innerHTML = renderRunners(run["Runners"], run["Runner Stream"]);

          runContainer.appendChild(runClone);
        });

        dayBlock.appendChild(clone);
      });

    frag.appendChild(dayBlock);
  });

  // One DOM swap each for nav and schedule
  navContainer.replaceChildren(navFrag);
  container.replaceChildren(frag);

  // ---- Scroll handling ----
  if (!sortedDateKeys.length) return;
  if (autoScroll) {
    const todayKey = getDateKeyInZone(new Date(), tz);
    const chosen = sortedDateKeys.includes(todayKey)
      ? todayKey
      : [...sortedDateKeys].reverse().find(d => d <= todayKey) || sortedDateKeys[0];
    const el = document.getElementById("day-" + chosen);
    if (el) {
      el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
      highlightDay(chosen);
    }
  } else {
    window.scrollTo(0, prevScrollY);
    if (activeDayKey) highlightDay(activeDayKey);
  }
}

// -------------------------------------------------------------
// Load: show cached data instantly, then swap in fresh data
// -------------------------------------------------------------
async function init() {
  const cachedText = readCache();
  let hadCache = false;

  if (cachedText) {
    try {
      setRows(JSON.parse(cachedText));
      renderSchedule({ smooth: false });
      hadCache = true;
    } catch (e) {
      console.warn("Ignoring bad schedule cache", e);
    }
  }

  try {
    const fresh = await freshPromise;
    writeCache(fresh.text);
    // Only re-render if something actually changed (or there was nothing on screen)
    if (!hadCache || fresh.text !== cachedText) {
      setRows(fresh.rows);
      renderSchedule(hadCache ? { autoScroll: false } : { smooth: false });
    }
  } catch (err) {
    console.error("Schedule load error:", err);
    if (!hadCache) {
      document.getElementById("schedule").textContent =
        "Couldn't load the schedule right now. Please refresh in a moment.";
    }
  }
}

// -------------------------------------------------------------
// Wiring + initial render
// -------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  const select = document.getElementById("tz-select");

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

  // Dropdown change: re-render with already-loaded data in the new timezone
  select.addEventListener("change", () => {
    selectedTimezone = select.value;
    updateTzLabels();
    renderSchedule();
  });

  // One click listener for every run row (instead of one per row)
  document.getElementById("schedule").addEventListener("click", e => {
    const row = e.target.closest(".run-row");
    if (!row || e.target.closest(".runner")) return;
    const start = Number(row.dataset.start);
    const runDateKey = getDateKeyInZone(new Date(start), selectedTimezone);
    const todayKey = getDateKeyInZone(new Date(), selectedTimezone);
    const url = runDateKey >= todayKey
      ? "https://www.twitch.tv/gamesdonequick"
      : "https://www.twitch.tv/gamesdonequick/videos?filter=archives&sort=time";
    window.open(url, "_blank");
  });

  updateTzLabels();
  init();
});
