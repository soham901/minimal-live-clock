const RING_MODES = ["off", "hour", "chunk", "day"];
// Chunks of the day (6 hours each)
const CHUNKS = [
  { start: 0,  name: "Night" },
  { start: 6,  name: "Morning" },
  { start: 12, name: "Afternoon" },
  { start: 18, name: "Evening" },
];

const state = {
  seconds: localStorage.getItem("clock.seconds") === "1",
  ring: RING_MODES.includes(localStorage.getItem("clock.ring")) ? localStorage.getItem("clock.ring") : "off",
};

const $ = (id) => document.getElementById(id);
const stage = $("stage"), timeEl = $("time"), labelEl = $("label"), dateEl = $("date"), bar = $("bar");
const btnSeconds = $("btnSeconds"), btnRing = $("btnRing"), btnFull = $("btnFull");

const CIRC = 2 * Math.PI * 48;
bar.style.strokeDasharray = CIRC;

const pad = (n) => String(n).padStart(2, "0");

function ringProgress(now) {
  const h = now.getHours(), m = now.getMinutes(), s = now.getSeconds(), ms = now.getMilliseconds();
  const secOfDay = h * 3600 + m * 60 + s + ms / 1000;
  if (state.ring === "hour") {
    const left = 60 - m - (s > 0 ? 1 : 0);
    return { p: (m * 60 + s) / 3600, label: `${left} min left this hour` };
  }
  if (state.ring === "chunk") {
    const c = [...CHUNKS].reverse().find((c) => h >= c.start);
    const p = (secOfDay - c.start * 3600) / (6 * 3600);
    return { p, label: `${c.name} · ${Math.floor(p * 100)}%` };
  }
  if (state.ring === "day") {
    const p = secOfDay / 86400;
    return { p, label: `Day · ${Math.floor(p * 100)}%` };
  }
  return null;
}

function render() {
  const now = new Date();
  const h24 = now.getHours();
  const h12 = h24 % 12 || 12;
  const ampm = h24 < 12 ? "AM" : "PM";

  let html = `${h12}<span class="colon">:</span>${pad(now.getMinutes())}`;
  if (state.seconds) html += `<span class="sec"><span class="colon">:</span>${pad(now.getSeconds())}</span>`;
  html += `<span class="ampm">${ampm}</span>`;
  timeEl.innerHTML = html;

  const r = ringProgress(now);
  if (r) {
    bar.style.strokeDashoffset = CIRC * (1 - r.p);
    labelEl.textContent = r.label;
  }
  dateEl.textContent = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const mp = (now - monthStart) / (monthEnd - monthStart);
  $("monthFill").style.width = `${mp * 100}%`;
  $("month").title = `${now.toLocaleDateString(undefined, { month: "long" })} · ${Math.floor(mp * 100)}%`;
  document.title = `${h12}:${pad(now.getMinutes())} ${ampm}`;

  if (brbOn) {
    brbMeta.textContent = `${h12}:${pad(now.getMinutes())} ${ampm}`;
    document.title = `BRB · ${document.title}`;
  }
}

// BRB screen
const btnBrb = $("btnBrb"), brbMsg = $("brbMsg"), brbMeta = $("brbMeta");
const DEFAULT_MSG = "Be right back";
let brbOn = false;
brbMsg.textContent = localStorage.getItem("clock.brbMsg") || DEFAULT_MSG;
brbMsg.addEventListener("input", () => localStorage.setItem("clock.brbMsg", brbMsg.textContent.trim()));
brbMsg.addEventListener("blur", () => { if (!brbMsg.textContent.trim()) brbMsg.textContent = DEFAULT_MSG; });
brbMsg.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); brbMsg.blur(); } });
function toggleBrb() {
  brbOn = !brbOn;
  document.body.classList.toggle("brb-on", brbOn);
  btnBrb.setAttribute("aria-pressed", brbOn);
  if (brbOn && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  render();
}
btnBrb.onclick = toggleBrb;

function applyState() {
  stage.classList.toggle("with-seconds", state.seconds);
  stage.classList.toggle("with-ring", state.ring !== "off");
  btnSeconds.setAttribute("aria-pressed", state.seconds);
  const names = { off: "Off", hour: "Hour", chunk: "Part of day", day: "Day" };
  btnRing.firstChild.textContent = `Ring: ${names[state.ring]}`;
  localStorage.setItem("clock.seconds", state.seconds ? "1" : "0");
  localStorage.setItem("clock.ring", state.ring);
  render();
}

function toggleSeconds() { state.seconds = !state.seconds; applyState(); }
function cycleRing() {
  state.ring = RING_MODES[(RING_MODES.indexOf(state.ring) + 1) % RING_MODES.length];
  applyState();
}
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.();
}

btnSeconds.onclick = toggleSeconds;
btnRing.onclick = cycleRing;
btnFull.onclick = toggleFullscreen;
document.addEventListener("dblclick", (e) => { if (!e.target.closest(".controls, .brb-msg")) toggleFullscreen(); });
document.addEventListener("fullscreenchange", () => {
  btnFull.firstChild.textContent = document.fullscreenElement ? "Exit fullscreen" : "Fullscreen";
});
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.target === brbMsg) return;
  const k = e.key.toLowerCase();
  if (k === "b") toggleBrb();
  else if (k === "f") toggleFullscreen();
  else if (k === "s") toggleSeconds();
  else if (k === "r") cycleRing();
});

// Dock: reveal controls only when the pointer nears the bottom edge (tap to toggle on touch)
const dock = document.querySelector(".controls");
let dockTimer;
function setDock(open) {
  clearTimeout(dockTimer);
  if (open) document.body.classList.add("dock-open");
  else dockTimer = setTimeout(() => document.body.classList.remove("dock-open"), 400);
}
document.addEventListener("mousemove", (e) => {
  setDock(e.clientY > window.innerHeight - 120 || dock.contains(e.target));
});
document.addEventListener("mouseleave", () => setDock(false));
document.addEventListener("touchstart", (e) => {
  if (!dock.contains(e.target)) setDock(!document.body.classList.contains("dock-open"));
}, { passive: true });

// Hide cursor when idle
let idleTimer;
function wake() {
  document.body.classList.remove("idle");
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => document.body.classList.add("idle"), 2500);
}
["mousemove", "mousedown", "touchstart", "keydown"].forEach((ev) => document.addEventListener(ev, wake, { passive: true }));
wake();

// Tick aligned to the start of each second
function tick() {
  render();
  setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
}
applyState();
tick();
