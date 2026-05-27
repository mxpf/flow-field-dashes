const canvas = document.querySelector("#art");
const ctx = canvas.getContext("2d");

const controls = {
  pauseButton: document.querySelector("#pauseButton"),
  randomizeButton: document.querySelector("#randomizeButton"),
  exportButton: document.querySelector("#exportButton"),
  exportSvgButton: document.querySelector("#exportSvgButton"),
  presetName: document.querySelector("#presetName"),
  savePresetButton: document.querySelector("#savePresetButton"),
  sharePresetButton: document.querySelector("#sharePresetButton"),
  presetSelect: document.querySelector("#presetSelect"),
  loadPresetButton: document.querySelector("#loadPresetButton"),
  deletePresetButton: document.querySelector("#deletePresetButton"),
  presetStatus: document.querySelector("#presetStatus"),
  pattern: document.querySelector("#pattern"),
  speed: document.querySelector("#speed"),
  easing: document.querySelector("#easing"),
  fieldPull: document.querySelector("#fieldPull"),
  waveScale: document.querySelector("#waveScale"),
  density: document.querySelector("#density"),
};

const state = {
  paused: false,
  seed: Math.random() * 1000,
  time: 0,
  lastTimestamp: 0,
};

const TAU = Math.PI * 2;
const SIZE = 1400;
const PRESET_KEY = "flow-field-dashes-presets";
const CONFIG_KEYS = ["pattern", "speed", "easing", "fieldPull", "waveScale", "density"];

function value(id) {
  return Number(controls[id].value);
}

function readPresets() {
  try {
    return JSON.parse(localStorage.getItem(PRESET_KEY)) || [];
  } catch {
    return [];
  }
}

function writePresets(presets) {
  localStorage.setItem(PRESET_KEY, JSON.stringify(presets));
}

function collectConfig() {
  return {
    seed: state.seed,
    time: state.time,
    controls: Object.fromEntries(CONFIG_KEYS.map((key) => [key, controls[key].value])),
  };
}

function applyConfig(config) {
  if (!config || typeof config !== "object") {
    return;
  }

  if (Number.isFinite(config.seed)) {
    state.seed = config.seed;
  }

  if (Number.isFinite(config.time)) {
    state.time = config.time;
  }

  if (config.controls && typeof config.controls === "object") {
    CONFIG_KEYS.forEach((key) => {
      if (config.controls[key] !== undefined) {
        controls[key].value = config.controls[key];
      }
    });
  }
}

function encodeConfig(config) {
  return btoa(JSON.stringify(config))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function decodeConfig(encoded) {
  const padded = encoded + "=".repeat((4 - (encoded.length % 4)) % 4);
  return JSON.parse(atob(padded.replaceAll("-", "+").replaceAll("_", "/")));
}

function setPresetStatus(message) {
  controls.presetStatus.textContent = message;
}

function renderPresetOptions() {
  const presets = readPresets();
  controls.presetSelect.replaceChildren();

  if (presets.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No saved presets";
    controls.presetSelect.append(option);
    return;
  }

  presets.forEach((preset) => {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = preset.name;
    controls.presetSelect.append(option);
  });
}

function getSelectedPreset() {
  return readPresets().find((preset) => preset.id === controls.presetSelect.value);
}

function noiseLike(x, y, t) {
  const s = state.seed;
  return (
    Math.sin(x * 1.7 + y * 0.42 + t * 1.25 + s) +
    Math.cos(y * 1.55 - x * 0.36 - t * 0.72 + s * 0.37) +
    Math.sin((x + y) * 0.88 + t * 0.9 + s * 0.13)
  );
}

function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function mixAngles(a, b, amount) {
  return a + normalizeAngle(b - a) * amount;
}

function easedTime(t) {
  const easing = value("easing");
  const slowPulse = Math.sin(t * 0.82 + state.seed) * 0.42;
  const driftPulse = Math.sin(t * 1.73 + state.seed * 0.23) * 0.18;
  const breath = Math.sin(Math.sin(t * 0.46) * Math.PI) * 0.28;

  return t + (slowPulse + driftPulse + breath) * easing;
}

function flowAngle(nx, ny, t) {
  const stream = Math.sin(ny * 7.6 + t * 1.45 + state.seed) * 0.72;
  const crossCurrent = Math.sin((nx * 3.8 - ny * 2.15) - t * 1.05) * 0.34;
  const curl = Math.atan2(ny + 0.18, nx - 0.34) * 0.28;
  const localTurbulence = noiseLike(nx * 1.35, ny * 1.35, t) * 0.13;

  return stream + crossCurrent + curl * value("fieldPull") + localTurbulence;
}

function radialAngle(nx, ny, t) {
  const radius = Math.hypot(nx, ny);
  const rotation = t * 0.55;
  const theta = Math.atan2(ny, nx) + rotation;
  const spokes = 12;
  const spokeSnap = Math.round((theta / TAU) * spokes) * (TAU / spokes);
  const pulse = Math.sin(radius * 12.5 - t * 4.3 + state.seed) * 0.62;
  const twist = radius * (1.08 + Math.sin(t * 0.8) * 0.36);
  const shimmer = Math.sin(theta * spokes + radius * 4.5 + t * 3.2) * 0.28;
  const spokeStrength = 0.35 + Math.sin(t * 1.4) * 0.18;

  return mixAngles(
    theta - rotation + twist + pulse + shimmer,
    spokeSnap - rotation + pulse,
    spokeStrength * value("fieldPull") * 0.45,
  );
}

function ringAngle(nx, ny, t) {
  const distance = Math.hypot(nx, ny);
  const tangent = Math.atan2(ny, nx) + Math.PI / 2;
  const ripple = Math.sin(distance * 14 - t * 2.4 + state.seed) * 0.74;

  return tangent + ripple * value("fieldPull");
}

function waveAngle(nx, ny, t) {
  const primary = Math.sin(nx * 7.2 + t * 2.2 + state.seed) * 0.85;
  const secondary = Math.sin((nx + ny * 0.74) * 5.4 - t * 1.55) * 0.42;
  const carrier = Math.PI / 2 + Math.sin(ny * 2.2 + t * 0.35) * 0.18;

  return carrier + (primary + secondary) * value("fieldPull");
}

function vortexAngle(nx, ny, t) {
  const distance = Math.hypot(nx, ny);
  const orbit = Math.atan2(ny, nx) + Math.PI / 2;
  const inwardPull = Math.sin(distance * 8 - t * 2.1) * 0.52;
  const wobble = noiseLike(nx * 1.5, ny * 1.5, t) * 0.18;

  return orbit + inwardPull * value("fieldPull") + wobble;
}

function fieldAngle(x, y, t) {
  const nx = (x / SIZE - 0.5) * value("waveScale");
  const ny = (y / SIZE - 0.5) * value("waveScale");
  const mode = controls.pattern.value;

  if (mode === "radial") {
    return radialAngle(nx, ny, t);
  }

  if (mode === "rings") {
    return ringAngle(nx, ny, t);
  }

  if (mode === "waves") {
    return waveAngle(nx, ny, t);
  }

  if (mode === "vortex") {
    return vortexAngle(nx, ny, t);
  }

  return flowAngle(nx, ny, t);
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  gradient.addColorStop(0, "#e5e8e8");
  gradient.addColorStop(1, "#d0d4d4");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SIZE, SIZE);
}

function getDashGeometry(t) {
  const columns = value("density");
  const rows = columns;
  const margin = 120;
  const gap = (SIZE - margin * 2) / (columns - 1);
  const dashLength = gap * 0.82;
  const lineWidth = Math.max(5, gap * 0.12);
  const segments = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const x = margin + col * gap;
      const y = margin + row * gap;
      const bend = Math.sin(row * 0.26 + t * 0.38) * 8;
      const angle = fieldAngle(x + bend, y, t);
      const half = dashLength / 2;
      const dx = Math.cos(angle) * half;
      const dy = Math.sin(angle) * half;

      segments.push({
        x1: x - dx,
        y1: y - dy,
        x2: x + dx,
        y2: y + dy,
      });
    }
  }

  return { lineWidth, segments };
}

function drawDashes(t) {
  const { lineWidth, segments } = getDashGeometry(t);

  ctx.strokeStyle = "#030504";
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "butt";

  for (const segment of segments) {
    ctx.beginPath();
    ctx.moveTo(segment.x1, segment.y1);
    ctx.lineTo(segment.x2, segment.y2);
    ctx.stroke();
  }
}

function render(timestamp = 0) {
  const delta = Math.min(48, timestamp - state.lastTimestamp || 16);
  state.lastTimestamp = timestamp;

  if (!state.paused) {
    state.time += (delta / 1000) * value("speed");
  }

  drawBackground();
  drawDashes(easedTime(state.time));
  requestAnimationFrame(render);
}

function randomize() {
  state.seed = Math.random() * 1000;
  state.time = Math.random() * TAU;
}

function exportPng() {
  const link = document.createElement("a");
  link.download = "flow-field-dashes.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function formatNumber(number) {
  return Number(number.toFixed(2));
}

function exportSvg() {
  const { lineWidth, segments } = getDashGeometry(easedTime(state.time));
  const lines = segments
    .map(
      (segment) =>
        `<line x1="${formatNumber(segment.x1)}" y1="${formatNumber(segment.y1)}" x2="${formatNumber(segment.x2)}" y2="${formatNumber(segment.y2)}" />`,
    )
    .join("\n    ");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e5e8e8" />
      <stop offset="1" stop-color="#d0d4d4" />
    </linearGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#bg)" />
  <g stroke="#030504" stroke-width="${formatNumber(lineWidth)}" stroke-linecap="butt">
    ${lines}
  </g>
</svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  const link = document.createElement("a");
  link.download = "flow-field-dashes.svg";
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

function savePreset() {
  const name = controls.presetName.value.trim() || `Pattern ${new Date().toLocaleString()}`;
  const presets = readPresets();
  const id = globalThis.crypto?.randomUUID?.() || String(Date.now());
  const preset = { id, name, config: collectConfig() };

  writePresets([...presets, preset]);
  renderPresetOptions();
  controls.presetSelect.value = id;
  setPresetStatus(`Saved "${name}".`);
}

function loadPreset() {
  const preset = getSelectedPreset();

  if (!preset) {
    setPresetStatus("Choose a saved preset first.");
    return;
  }

  applyConfig(preset.config);
  controls.presetName.value = preset.name;
  setPresetStatus(`Loaded "${preset.name}".`);
}

function deletePreset() {
  const preset = getSelectedPreset();

  if (!preset) {
    setPresetStatus("Choose a saved preset first.");
    return;
  }

  writePresets(readPresets().filter((item) => item.id !== preset.id));
  renderPresetOptions();
  setPresetStatus(`Deleted "${preset.name}".`);
}

async function sharePreset() {
  const url = new URL(window.location.href);
  url.searchParams.set("config", encodeConfig(collectConfig()));

  try {
    await navigator.clipboard.writeText(url.toString());
    setPresetStatus("Share URL copied.");
  } catch {
    window.prompt("Share URL", url.toString());
    setPresetStatus("Share URL ready.");
  }
}

function loadConfigFromUrl() {
  const config = new URLSearchParams(window.location.search).get("config");

  if (!config) {
    return;
  }

  try {
    applyConfig(decodeConfig(config));
    setPresetStatus("Loaded shared configuration.");
  } catch {
    setPresetStatus("Shared configuration could not be loaded.");
  }
}

controls.pauseButton.addEventListener("click", () => {
  state.paused = !state.paused;
  controls.pauseButton.textContent = state.paused ? "Play" : "Pause";
});

controls.randomizeButton.addEventListener("click", randomize);
controls.exportButton.addEventListener("click", exportPng);
controls.exportSvgButton.addEventListener("click", exportSvg);
controls.savePresetButton.addEventListener("click", savePreset);
controls.loadPresetButton.addEventListener("click", loadPreset);
controls.deletePresetButton.addEventListener("click", deletePreset);
controls.sharePresetButton.addEventListener("click", sharePreset);

renderPresetOptions();
loadConfigFromUrl();
render();
