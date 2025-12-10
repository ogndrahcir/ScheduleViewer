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
function formatShowDateForDisplay(rawDate) {
  if (!rawDate) return "";
  const d = new Date(rawDate);
  const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
  return d.toLocaleDateString("en-US", options);
}

function formatShowDateForNavbar(rawDate) {
  if (!rawDate) return { dayName: "", monthDay: "" };
  const d = new Date(rawDate);
  const dayName = d.toLocaleDateString("en-US", { weekday: "long" });
  const monthDay = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return { dayName, monthDay };
}

function formatShowStart(rawStart) {
  if (!rawStart) return "";
  const d = new Date(rawStart);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
}

function formatEstimate(rawEstimate) {
  if (!rawEstimate) return "";
  const d = rawEstimate;
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
// Helpers
// -------------------------------------------------------------
function parseEstimateToMs(raw) {
  if (!raw) return 0;
  const d = raw;
  return (
    d.getHours() * 3600000 +
    d.getMinutes() * 60000 +
    d.getSeconds() * 1000
  );
}

function formatRunStart(d) {
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
}

// -------------------------------------------------------------
// Render schedule
// -------------------------------------------------------------
async function renderSchedule() {
  const rows = await loadSchedule();
  const byDate = {};

  // Group rows by date
  rows.forEach(r => {
    const { dayName, monthDay } = formatShowDateForNavbar(r["Show Date"]);
    const dateKey = r["Show Date"];
    if (!byDate[dateKey]) byDate[dateKey] = { rows: [], dayName, monthDay };
    byDate[dateKey].rows.push(r);
  });

  const navContainer = document.getElementById("schedule-nav");
  const container = document.getElementById("schedule");
  container.innerHTML = "";

  [...navContainer.querySelectorAll("button")].forEach(b => b.remove());

  const dayButtons = {};

  // Navbar buttons
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
    dayDiv.innerHTML = `<div class='day-title'>${formatShowDateForDisplay(dateKey)}</div>`;

    const runs = byDate[dateKey].rows;
    const groups = {};

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

        const img = clone.querySelector(".show-logo");
        img.src = resolveLogo(showName);
        img.onerror = () => { img.src = "Logos/GDQ Logo.png"; };

        const info = clone.querySelector(".show-info");
        info.innerHTML = `
          <span class="show-time">${formatShowStart(rawStart)}</span>
          <span class="show-subtitle">Hosted by: ${hostName || "TBA"}</span>
        `;
        info.style.display = "flex";
        info.style.flexDirection = "column";
        info.style.alignItems = "center";

        const header = clone.querySelector(".show-header");
        header.style.display = "grid";
        header.style.gridTemplateColumns = "120px 1fr";
        header.style.justifyContent = "center";
        header.style.alignItems = "center";

        // ---------------------------------------------------
        // FIXED 4-column header
        // ---------------------------------------------------
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

        // ---------------------------------------------------
        // Calculate run start times WITH 10-minute setup (2nd+)
        // ---------------------------------------------------
		let baseTime = new Date(rawStart);

		groups[key].forEach((run, i) => {
		  if (i > 0) baseTime = new Date(baseTime.getTime() + 600000); // add 10 min setup

		  run._computedStart = new Date(baseTime);

		  const estimateMs = parseEstimateToMs(run["Estimate"]);
		  baseTime = new Date(baseTime.getTime() + estimateMs); // add run duration
		});

        // ---------------------------------------------------
        // Render runs (4-column grid)
        // ---------------------------------------------------
        groups[key].forEach(run => {
          const runTemplate = document.getElementById("run-template");
          const runClone = document.importNode(runTemplate.content, true);
          const runRow = runClone.querySelector(".run-row");

          runRow.style.gridTemplateColumns = "2fr 1fr 1fr 2fr";

          // New start time column
          const startDiv = document.createElement("div");
          startDiv.className = "run-start";
          startDiv.textContent = formatRunStart(run._computedStart);
          runRow.insertBefore(startDiv, runRow.children[1]);

          runClone.querySelector(".game").textContent = run["Game"];
          runClone.querySelector(".category").textContent = run["Category"];
          runClone.querySelector(".estimate").textContent = formatEstimate(run["Estimate"]);
          runClone.querySelector(".runner").innerHTML = renderRunners(run["Runners"], run["Runner Stream"]);

          runRow.addEventListener("click", (e) => {
            if (e.target.closest(".runner")) return;

            const runDate = new Date(run["Show Date"]);
            const today = new Date();
            today.setHours(0,0,0,0);

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
    const now = new Date();
    const sortedDates = Object.keys(byDate)
      .map(d => ({ key: d, date: new Date(d) }))
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
