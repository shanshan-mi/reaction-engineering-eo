const PRECOMPUTED_ROOT = "./precomputed";

const scenarioSelect = document.getElementById("scenarioSelect");
const fieldSelect = document.getElementById("fieldSelect");
const alphaRange = document.getElementById("alphaRange");
const phiRange = document.getElementById("phiRange");
const alphaValue = document.getElementById("alphaValue");
const phiValue = document.getElementById("phiValue");
const heatmapCaption = document.getElementById("heatmapCaption");
const profileCaption = document.getElementById("profileCaption");
const metricsGrid = document.getElementById("metricsGrid");

let appState = {
  rootManifest: null,
  scenarioManifests: new Map(),
  alphaCaseCache: new Map(),
  currentScenario: null,
  currentAlphaIndex: 0,
  currentPhiIndex: 0,
};

function formatNumber(value, digits = 2) {
  return Number(value).toFixed(digits);
}

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return response.json();
}

function buildDiskField(radialGrid, radialValues, size = 121) {
  const axis = Array.from({ length: size }, (_, i) => -1 + (2 * i) / (size - 1));
  const z = axis.map((y) =>
    axis.map((x) => {
      const r = Math.sqrt(x * x + y * y);
      if (r > 1) return null;
      const clamped = Math.min(Math.max(r, radialGrid[0]), radialGrid[radialGrid.length - 1]);
      return interpolate1D(radialGrid, radialValues, clamped);
    }),
  );
  return { axis, z };
}

function interpolate1D(x, y, xq) {
  if (xq <= x[0]) return y[0];
  if (xq >= x[x.length - 1]) return y[y.length - 1];
  let i = 0;
  while (i < x.length - 1 && x[i + 1] < xq) i += 1;
  const t = (xq - x[i]) / (x[i + 1] - x[i]);
  return y[i] * (1 - t) + y[i + 1] * t;
}

function metricCard(label, value) {
  const div = document.createElement("div");
  div.className = "metric";
  div.innerHTML = `
    <span class="metric-label">${label}</span>
    <span class="metric-value">${value}</span>
  `;
  return div;
}

function getScenarioManifest() {
  return appState.scenarioManifests.get(appState.currentScenario);
}

function getAlphaValues() {
  return getScenarioManifest().alpha_values;
}

function getPhiValues() {
  return getScenarioManifest().phi_values;
}

function getCurrentAlpha() {
  return getAlphaValues()[appState.currentAlphaIndex];
}

function getCurrentPhi() {
  return getPhiValues()[appState.currentPhiIndex];
}

async function ensureAlphaCasesLoaded(alphaValueNumeric) {
  const key = `${appState.currentScenario}:${alphaValueNumeric}`;
  if (appState.alphaCaseCache.has(key)) {
    return appState.alphaCaseCache.get(key);
  }
  const manifest = getScenarioManifest();
  const fileEntry = manifest.files.find((item) => item.alpha === alphaValueNumeric);
  const data = await loadJson(`${PRECOMPUTED_ROOT}/${appState.currentScenario}/${fileEntry.path.replace("cases/", "cases/")}`);
  appState.alphaCaseCache.set(key, data);
  return data;
}

function updateControlLabels() {
  alphaValue.textContent = formatNumber(getCurrentAlpha(), 1);
  phiValue.textContent = formatNumber(getCurrentPhi(), 1);
}

function scenarioLabel(name) {
  return name === "isothermal" ? "等温对照" : "非等温耦合";
}

async function render() {
  updateControlLabels();
  const alpha = getCurrentAlpha();
  const phi = getCurrentPhi();
  const alphaData = await ensureAlphaCasesLoaded(alpha);
  const caseData = alphaData.cases[appState.currentPhiIndex];
  const fieldName = fieldSelect.value;
  const radialGrid = alphaData.radial_grid;
  const profiles = caseData.profiles;
  const metrics = caseData.metrics;
  const deltaSelectivity = metrics.surface_selectivity - metrics.center_selectivity;

  heatmapCaption.textContent = `${scenarioLabel(appState.currentScenario)} | 活性分布参数 ${formatNumber(alpha, 1)} | Thiele 模数 ${formatNumber(phi, 1)}`;
  profileCaption.textContent = `当前展示 ${scenarioLabel(appState.currentScenario)} 条件下的径向分布曲线。`;

  const disk = buildDiskField(radialGrid, profiles[fieldName], 141);
  Plotly.react(
    "heatmapPlot",
    [
      {
        type: "heatmap",
        z: disk.z,
        x: disk.axis,
        y: disk.axis,
        colorscale: fieldName === "selectivity" ? "Viridis" : "Turbo",
        colorbar: {
          title: fieldName === "selectivity" ? "S" : "T / °C",
        },
        hovertemplate: "x=%{x:.2f}<br>y=%{y:.2f}<br>value=%{z:.4f}<extra></extra>",
      },
    ],
    {
      margin: { l: 45, r: 25, t: 10, b: 45 },
      paper_bgcolor: "white",
      plot_bgcolor: "white",
      xaxis: { title: "x / r_s", scaleanchor: "y", zeroline: false },
      yaxis: { title: "y / r_s", zeroline: false },
      shapes: [
        {
          type: "circle",
          x0: -1,
          y0: -1,
          x1: 1,
          y1: 1,
          line: { color: "rgba(130, 40, 40, 0.8)", width: 2 },
        },
      ],
    },
    { responsive: true },
  );

  Plotly.react(
    "profilesPlot",
    [
      { x: radialGrid, y: profiles.A, mode: "lines", name: "A(X)", line: { color: "#0f4c81", width: 3 } },
      { x: radialGrid, y: profiles.B, mode: "lines", name: "B(X)", line: { color: "#008080", width: 3 } },
    ],
    {
      margin: { l: 48, r: 18, t: 10, b: 46 },
      paper_bgcolor: "white",
      plot_bgcolor: "white",
      xaxis: { title: "X = r / r_s", zeroline: false },
      yaxis: { title: "数值", zeroline: false },
      legend: { orientation: "h", y: 1.12 },
    },
    { responsive: true },
  );

  metricsGrid.innerHTML = "";
  const metricEntries = [
    ["中心-表面选择性差值", formatNumber(deltaSelectivity, 4)],
    ["温升 / K", formatNumber(metrics.temperature_rise_K, 2)],
    ["中心选择性", formatNumber(metrics.center_selectivity, 4)],
    ["表面选择性", formatNumber(metrics.surface_selectivity, 4)],
    ["总体归一化选择性", formatNumber(metrics.normalized_selectivity, 4)],
    ["有效因子", formatNumber(metrics.effectiveness_factor, 4)],
    ["中心温度 / K", formatNumber(metrics.center_temperature_K, 2)],
  ];
  metricEntries.forEach(([label, value]) => metricsGrid.appendChild(metricCard(label, value)));
}

async function updateScenario(name) {
  appState.currentScenario = name;
  const manifest = getScenarioManifest();
  alphaRange.max = String(manifest.alpha_values.length - 1);
  phiRange.max = String(manifest.phi_values.length - 1);
  appState.currentAlphaIndex = Math.min(appState.currentAlphaIndex, manifest.alpha_values.length - 1);
  appState.currentPhiIndex = Math.min(appState.currentPhiIndex, manifest.phi_values.length - 1);
  alphaRange.value = String(appState.currentAlphaIndex);
  phiRange.value = String(appState.currentPhiIndex);
  await render();
}

async function init() {
  appState.rootManifest = await loadJson(`${PRECOMPUTED_ROOT}/manifest.json`);
  for (const scenario of appState.rootManifest.scenarios) {
    const option = document.createElement("option");
    option.value = scenario.name;
    option.textContent = scenarioLabel(scenario.name);
    scenarioSelect.appendChild(option);
    const manifest = await loadJson(`${PRECOMPUTED_ROOT}/${scenario.path}`);
    appState.scenarioManifests.set(scenario.name, manifest);
  }

  scenarioSelect.addEventListener("change", async (event) => {
    await updateScenario(event.target.value);
  });
  fieldSelect.addEventListener("change", render);
  alphaRange.addEventListener("input", async (event) => {
    appState.currentAlphaIndex = Number(event.target.value);
    await render();
  });
  phiRange.addEventListener("input", async (event) => {
    appState.currentPhiIndex = Number(event.target.value);
    await render();
  });

  scenarioSelect.value = appState.rootManifest.scenarios[0].name;
  await updateScenario(scenarioSelect.value);
}

init().catch((error) => {
  console.error(error);
  document.body.innerHTML = `<pre style="padding:24px;color:#b00020;">${error.stack}</pre>`;
});
