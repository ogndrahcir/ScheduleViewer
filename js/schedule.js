const DATA_URL = "https://script.google.com/macros/s/AKfycbz-aJuovNQ-0_W-2lgbDZK4Erwnlu1vD8H1yNp7Dzpd3G7HlVUkfiOVIa3ZxF6-Q4sX/exec?t=" + new Date().getTime();

async function loadSchedule() {
  const response = await fetch(DATA_URL);
  const data = await response.json();
  return data;
}

function formatShowDate(rawDate) {
  if (!rawDate) return "";
  const d = new Date(rawDate);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/New_York" });
}

function formatShowStart(rawStart) {
  if (!rawStart) return "";
  const d = new Date(rawStart);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "America/New_York" });
}

function formatEstimate(rawEstimate) {
  if (!rawEstimate) return "";
  const d = new Date(rawEstimate);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
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

async function renderSchedule() {
  const rows = await loadSchedule();
  const byDate = {};

  rows.forEach(r => {
    const adjustedDate = formatShowDate(r["Show Date"]);
    if (!byDate[adjustedDate]) byDate[adjustedDate] = [];
    byDate[adjustedDate].push(r);
  });

  const container = document.getElementById("schedule");
  container.innerHTML = "";

  const navContainer = document.getElementById("schedule-nav");
  [...navContainer.querySelectorAll("button")].forEach(b => b.remove());
  const dayButtons = {};

  const today = new Date();
  today.setHours(0,0,0,0);
  let initialDate = null;

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

  Object.keys(byDate).sort().forEach(date => {
    const dayDiv = document.createElement("div");
    dayDiv.className = "day-block";
    dayDiv.id = "day-" + date.replace(/\//g, "-");
    const dateObj = new Date(date);
    const formattedDate = dateObj.toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    dayDiv.innerHTML = `<div class='day-title'>${formattedDate}</div>`;


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

        const clone = document.importNode(document.getElementById("show-template").content, true);

        const img = clone.querySelector(".show-logo");
        img.src = resolveLogo(showName);
        img.onerror = () => { img.src = "Logos/GDQ Logo.png"; };

        clone.querySelector(".show-time").textContent = formatShowStart(rawStart);
        clone.querySelector(".show-subtitle").textContent = "Hosted by: " + (hostName || "TBA");

        groups[key].forEach(run => {
          const runClone = document.importNode(document.getElementById("run-template").content, true);
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
