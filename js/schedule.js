// schedule.js - ET-first, timezone-proof, hostLinks updated

// -------------------------------------------------------------
// DATA URL
// -------------------------------------------------------------
const DATA_URL = "https://script.google.com/macros/s/AKfycbyxanGFzAWbQV4Fso__LJh5eOb4GDjBYHx6sK79FTu3ww6z0sYs603UbQeEr-aKRoK7/exec";

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
  "think fast!": "https://www.youtube.com/playlist?list=PLz8YL4HVC87X9I54nPFBYLnJs4nKVs4zI",
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
  "sparkle": "https://twitch.tv/Sparkle"
};

// -------------------------------------------------------------
// Load schedule data
// -------------------------------------------------------------
async function loadSchedule() {
  const res = await fetch(`${DATA_URL}?t=${Date.now()}`);
  const data = await res.json();
  return data;
}

// -------------------------------------------------------------
// Time / ET helpers
// -------------------------------------------------------------
function getEasternParts(utcInput) {
  if (!utcInput) return null;
  const d = utcInput instanceof Date ? utcInput : new Date(utcInput);
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

function buildDateKeyFromParts(parts) {
  if (!parts) return "Invalid Date";
  const yyyy = String(parts.year).padStart(4, "0");
  const mm = String(parts.month).padStart(2, "0");
  const dd = String(parts.day).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatTimeAsET(utcDate) {
  if (!utcDate) return "";
  const d = utcDate instanceof Date ? utcDate : new Date(utcDate);
  if (isNaN(d)) return "";
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/New_York"
  });
}

function formatNavbarPartsFromUtc(utcDate) {
  if (!utcDate) return { dayName: "", monthDay: "" };
  const d = utcDate instanceof Date ? utcDate : new Date(utcDate);
  if (isNaN(d)) return { dayName: "", monthDay: "" };
  return {
    dayName: d.toLocaleDateString("en-US", { weekday: "long", timeZone: "America/New_York" }),
    monthDay: d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })
  };
}

// -------------------------------------------------------------
// Estimate helpers
// -------------------------------------------------------------
function parseEstimatePartsFromTimestamp(raw) {
  if (!raw) return { h: 0, m: 0, s: 0 };
  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    let h = d.getUTCHours() - 5; // adjust 5 hours
    const m = d.getUTCMinutes();
    const s = d.getUTCSeconds();
    while (h < 0) h += 24;
    return { h, m, s };
  }
  const parts = String(raw).trim().split(":").map(Number);
  if (parts.length === 3) return { h: parts[0], m: parts[1], s: parts[2] };
  if (parts.length === 2) return { h: 0, m: parts[0], s: parts[1] };
  return { h: 0, m: 0, s: 0 };
}

function formatDurationA(h, m, s) {
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
  return names.map(name => {
    const url = hostLinks[name.toLowerCase()] || "#";
    return `<a href="${url}" target="_blank" class="runner-pill">${name}</a>`;
  }).join(" ");
}

// -------------------------------------------------------------
// Main rendering
// -------------------------------------------------------------
async function renderSchedule() {
  const rows = await loadSchedule();
  if (!Array.isArray(rows)) return;

  const byDate = {};
  rows.forEach(r => {
    const rawShowDate = r["Show Date"];
    if (!rawShowDate) return;

    const etParts = getEasternParts(rawShowDate);
    const dateKey = buildDateKeyFromParts(etParts);
    const { dayName, monthDay } = formatNavbarPartsFromUtc(rawShowDate);

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

  Object.keys(byDate).sort().forEach(dateKey => {
    const dayBlock = document.createElement("div");
    dayBlock.className = "day-block";
    dayBlock.id = "day-" + dateKey.replace(/\//g, "-");
    dayBlock.innerHTML = `<div class='day-title'>${byDate[dateKey].dayName}, ${byDate[dateKey].monthDay}</div>`;

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
      .sort((a, b) => new Date(groups[a][0]["Show Start (Eastern)"]) - new Date(groups[b][0]["Show Start (Eastern)"]))
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
        const firstStart = new Date(firstRun["Show Start (Eastern)"]);
        const showTime = formatTimeAsET(firstStart);

        info.style.display = "flex";
        info.style.flexDirection = "column";
        info.style.alignItems = "center";

        // get host URL from hostLinks (lowercase)
		const hostUrl = hostLinks[hostName.toLowerCase()] || "https://www.twitch.tv/gamesdonequick";

		info.innerHTML = `
		  <a class="show-time" href="${hostUrl}" target="_blank">${showTime}</a>
		  <span class="show-subtitle">Hosted by: ${renderRunners(hostName)}</span>
		`;

		const showTimeEl = clone.querySelector(".show-time");
		showTimeEl.addEventListener("click", e => e.stopPropagation());


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

        let baseTime = new Date(firstStart.getTime());

        groups[key].forEach((run, i) => {
          if (i > 0) baseTime = new Date(baseTime.getTime() + 10 * 60 * 1000);
          run._computedStart = new Date(baseTime.getTime());
          baseTime = new Date(baseTime.getTime() + parseEstimateToMs(run["Estimate"]));
        });

        groups[key].forEach(run => {
          const runTemplate = document.getElementById("run-template");
          const runClone = document.importNode(runTemplate.content, true);
          const runRow = runClone.querySelector(".run-row");
          runRow.style.gridTemplateColumns = "2fr 1fr 1fr 2fr";

          const startDiv = document.createElement("div");
          startDiv.className = "run-start";
          startDiv.textContent = formatTimeAsET(run._computedStart);
          runRow.insertBefore(startDiv, runRow.children[1]);

          runClone.querySelector(".game").textContent = run["Game"] || "";
          runClone.querySelector(".category").textContent = run["Category"] || "";
          runClone.querySelector(".estimate").textContent = formatEstimateString(run["Estimate"]);
          runClone.querySelector(".runner").innerHTML = renderRunners(run["Runners"], run["Runner Stream"]);

          runRow.addEventListener("click", e => {
            if (e.target.closest(".runner")) return;
            const runDateKey = buildDateKeyFromParts(getEasternParts(run["Show Date"]));
            const todayKey = buildDateKeyFromParts(getEasternParts(new Date()));
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

  // Scroll to today or nearest past day
  (function scrollToCurrentOrPastDay() {
    const todayKey = buildDateKeyFromParts(getEasternParts(new Date()));
    const sortedDateKeys = Object.keys(byDate).sort();
    if (!sortedDateKeys.length) return;
    const chosen = sortedDateKeys.includes(todayKey)
      ? todayKey
      : [...sortedDateKeys].reverse().find(d => d <= todayKey) || sortedDateKeys[0];
    const el = document.getElementById("day-" + chosen.replace(/\//g, "-"));
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      highlightDay(chosen);
    }
  })();
}

// -------------------------------------------------------------
// Kick off
// -------------------------------------------------------------
renderSchedule().catch(err => console.error("renderSchedule error:", err));
