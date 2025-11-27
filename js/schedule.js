const DATA_URL = "https://script.google.com/macros/s/AKfycbz-aJuovNQ-0_W-2lgbDZK4Erwnlu1vD8H1yNp7Dzpd3G7HlVUkfiOVIa3ZxF6-Q4sX/exec?t=" + new Date().getTime();

// User GMT offset in hours
let forcedGMTOffset = new Date().getTimezoneOffset() / -60;

// Load data
async function loadSchedule() {
  const response = await fetch(DATA_URL);
  return await response.json();
}

// Helper: Eastern offset with DST
function getEasternOffset(date) {
  // US DST: 2nd Sunday Mar → 1st Sunday Nov
  const year = date.getFullYear();
  const dstStart = new Date(year, 2, 14); // Mar 14 = 2nd Sunday approx
  dstStart.setDate(14 - dstStart.getDay() + 0); // move to Sunday
  const dstEnd = new Date(year, 10, 7); // Nov 7 = 1st Sunday approx
  dstEnd.setDate(7 - dstEnd.getDay() + 0); // move to Sunday
  return (date >= dstStart && date < dstEnd) ? -4 : -5; // EDT = -4, EST = -5
}

// Convert Eastern → UTC → user GMT
function toUserTime(rawDate, gmtOffset) {
  const d = new Date(rawDate); // raw Eastern time
  const estOffset = getEasternOffset(d);
  d.setHours(d.getHours() - estOffset); // to UTC
  d.setHours(d.getHours() + gmtOffset); // apply user GMT offset
  return d;
}

// Format functions
function formatShowDate(rawDate) {
  if (!rawDate) return "";
  return toUserTime(rawDate, forcedGMTOffset).toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatShowStart(rawDate) {
  if (!rawDate) return "";
  const d = toUserTime(rawDate, forcedGMTOffset);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
}

function formatEstimate(rawEstimate) {
  if (!rawEstimate) return "";
  const d = new Date(rawEstimate);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`;
}

function renderRunners(names, streams) {
  const n = names.split(",").map(s=>s.trim());
  const s = streams.split(",").map(s=>s.trim());
  return n.map((name,i)=>{
    let url = s[i]||"#";
    if(!/^https?:\/\//i.test(url)) url = "https://"+url;
    return `<a href="${url}" target="_blank" class="runner-pill">${name}</a>`;
  }).join(" ");
}

function resolveLogo(showName) {
  const formatted = showName.replace(/[/\\?%*:|"<>]/g,"");
  return `Logos/${formatted}.png`;
}

// GMT dropdown
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
for(let i=-12;i<=14;i++){
  const opt = document.createElement("option");
  opt.value=i;
  opt.textContent=i>=0?`GMT+${i}`:`GMT${i}`;
  tzSelect.appendChild(opt);
}
tzSelect.value = forcedGMTOffset;
tzSelect.addEventListener("change", ()=>{
  forcedGMTOffset = parseInt(tzSelect.value);
  renderSchedule();
});

// Render schedule
async function renderSchedule() {
  const rows = await loadSchedule();
  const byDate = {};

  // Group by adjusted date
  rows.forEach(r=>{
    const date = formatShowDate(r["Show Date"]);
    if(!byDate[date]) byDate[date]=[];
    byDate[date].push(r);
  });

  // Navbar buttons
  [...navContainer.querySelectorAll("button")].forEach(b=>b.remove());
  const dayButtons = {};
  const today = new Date(); today.setHours(0,0,0,0);
  let initialDate = null;

  Object.keys(byDate).sort().forEach(date=>{
    const btn = document.createElement("button");
    btn.textContent=date;
    btn.className="nav-day-btn";
    btn.onclick=()=>{ document.getElementById("day-"+date.replace(/\//g,"-")).scrollIntoView({behavior:"smooth",block:"start"}); highlightDay(date); };
    navContainer.insertBefore(btn,tzSelectWrapper);
    dayButtons[date]=btn;
    if(!initialDate || new Date(date)<=today) initialDate=date;
  });

  function highlightDay(date){
    Object.keys(dayButtons).forEach(d=>dayButtons[d].classList.remove("active"));
    if(dayButtons[date]) dayButtons[date].classList.add("active");
  }

  if(initialDate){
    const div=document.getElementById("day-"+initialDate.replace(/\//g,"-"));
    if(div){ div.scrollIntoView({behavior:"auto",block:"start"}); highlightDay(initialDate); }
  }

  // Build schedule
  const container = document.getElementById("schedule");
  container.innerHTML="";
  Object.keys(byDate).sort().forEach(date=>{
    const dayDiv = document.createElement("div");
    dayDiv.className="day-block";
    dayDiv.id="day-"+date.replace(/\//g,"-");
    dayDiv.innerHTML=`<div class='day-title'>${date}</div>`;

    const runs = byDate[date];
    const groups = {};
    runs.forEach(run=>{
      const key = `${run["Show Start (Eastern)"]}|${run["Show"]}|${run["Host"]}`;
      if(!groups[key]) groups[key]=[];
      groups[key].push(run);
    });

    Object.keys(groups).sort((a,b)=>new Date(a.split("|")[0])-new Date(b.split("|")[0])).forEach(key=>{
      const [rawStart, showName, hostName]=key.split("|");
      const groupDiv = document.createElement("div");
      groupDiv.className="show-group";

      const logoPath = resolveLogo(showName);
      const fallbackLogo = "Logos/GDQ Logo.png";

      groupDiv.innerHTML=`
        <div class="show-header">
          <img src="${logoPath}" onerror="this.onerror=null;this.src='${fallbackLogo}'" class="show-logo" alt="${showName}">
          <div class="show-info">
            <span class="show-time">${formatShowStart(rawStart)}</span>
            <span class="show-subtitle">Hosted by: ${hostName||"TBA"}</span>
          </div>
        </div>
      `;

      groups[key].forEach(run=>{
        const row = document.createElement("div");
        row.className="run-row";
        row.innerHTML=`
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
