const paramList = document.getElementById("paramList");
const addParamBtn = document.getElementById("addParamBtn");
const hasParametersInput = document.getElementById("hasParameters");
const showTestNameInReportInput = document.getElementById("showTestNameInReport");
const saveBtn = document.getElementById("saveBtn");
const formMessage = document.getElementById("formMessage");
const shortcutInput = document.getElementById("shortcut");
const shortcutMsg = document.getElementById("shortcutMsg");
const title = document.getElementById("title");
const cancelBtn = document.getElementById("cancelBtn");

let shortcutsLoaded = false;
let existingShortcuts = new Set();
let testsCache = null;
let editingId = null;
let editingShortcutNormalized = "";
let paramIdCounter = 0;
let normalIdCounter = 0;
let defaultIdCounter = 0;

addParamBtn.addEventListener("click", () => addParameter());
hasParametersInput.addEventListener("change", () => toggleParameters());
saveBtn.addEventListener("click", () => saveTest());
shortcutInput.addEventListener("input", () => validateShortcut());
shortcutInput.addEventListener("blur", () => validateShortcut());
if (cancelBtn) {
  cancelBtn.addEventListener("click", () => {
    window.location.href = "../5-tests.html";
  });
}

{
  const params = new URLSearchParams(location.search);
  const raw = params.get("edit");
  const parsed = raw == null ? NaN : Number(raw);
  editingId = Number.isFinite(parsed) ? parsed : null;
}

function toggleParameters() {
  const enabled = hasParametersInput.checked;
  addParamBtn.disabled = !enabled;
  // Only disable parameter name inputs and adding new parameters.
  // Other fields like unit, value type, normals should stay editable.
  [...paramList.querySelectorAll(".param-name")].forEach(input => {
    input.disabled = !enabled;
  });

  if (showTestNameInReportInput) {
    if (!enabled) {
      if (!showTestNameInReportInput.disabled) {
        showTestNameInReportInput.dataset.prevChecked =
          showTestNameInReportInput.checked ? "1" : "0";
      }
      showTestNameInReportInput.checked = true;
      showTestNameInReportInput.disabled = true;
    } else {
      showTestNameInReportInput.disabled = false;
      const prev = showTestNameInReportInput.dataset.prevChecked;
      if (prev === "0" || prev === "1") {
        showTestNameInReportInput.checked = prev === "1";
        delete showTestNameInReportInput.dataset.prevChecked;
      }
    }
  }

  updateRemoveButtons();
}

function updateRemoveButtons() {
  const cards = [...paramList.querySelectorAll(".param-card")];
  const disableLastRemove = !hasParametersInput.checked && cards.length <= 1;
  cards.forEach(card => {
    const removeBtn = card.querySelector(".remove-param");
    if (removeBtn) {
      removeBtn.disabled = disableLastRemove;
    }
  });
}

function ensureAtLeastOneParameter() {
  const cards = [...paramList.querySelectorAll(".param-card")];
  if (cards.length === 0) {
    addParameter();
  }
}

function addParameter(prefill = null) {
  const card = document.createElement("div");
  card.className = "param-card";
  const paramId = `param-${paramIdCounter++}`;
  const nameId = `${paramId}-name`;
  const unitId = `${paramId}-unit`;
  const typeId = `${paramId}-type`;
  const defaultToggleId = `${paramId}-default-toggle`;
  const addLineToggleId = `${paramId}-add-line-toggle`;
  card.innerHTML = `
    <div class="param-header">
      <h4 class="param-title">Parameter</h4>
      <button class="btn link remove-param" type="button">Remove</button>
    </div>
    <div class="grid-3">
      <div>
        <label for="${nameId}">Parameter Name</label>
        <input id="${nameId}" type="text" class="param-name" placeholder="Parameter Name">
      </div>
      <div>
        <label for="${unitId}">Unit</label>
        <input id="${unitId}" type="text" class="param-unit" placeholder="Unit">
      </div>
      <div>
        <label for="${typeId}">Value Type</label>
        <select id="${typeId}" class="param-type">
          <option value="">Select value type</option>
          <option value="NUMBER">NUMBER</option>
          <option value="TEXT">TEXT</option>
        </select>
      </div>
    </div>
    <div class="param-default">
      <div class="param-default-toggle">
        <input id="${defaultToggleId}" type="checkbox" class="param-default-toggle-input">
        <label for="${defaultToggleId}">Default Results</label>
        <input id="${addLineToggleId}" type="checkbox" class="param-add-line-toggle">
        <label for="${addLineToggleId}">Add new line</label>
      </div>
      <div class="param-default-controls hidden">
        <div class="section-row">
          <h4>Default Results</h4>
          <button class="btn small add-default" type="button">Add Result</button>
        </div>
        <div class="default-results"></div>
      </div>
    </div>
    <div class="section-row normal-section">
      <h4>Normal Ranges</h4>
      <button class="btn small add-normal" type="button">Add Normal</button>
    </div>
    <div class="normals"></div>
  `;

  paramList.appendChild(card);
  card.querySelector(".remove-param").addEventListener("click", () => {
    card.remove();
    refreshParameterLabels();
    ensureAtLeastOneParameter();
    updateRemoveButtons();
  });
  card.querySelector(".add-normal").addEventListener("click", () => {
    addNormalRow(card.querySelector(".normals"));
  });

  const defaultToggle = card.querySelector(".param-default-toggle-input");
  const defaultControls = card.querySelector(".param-default-controls");
  const defaultResults = card.querySelector(".default-results");
  card.querySelector(".add-default").addEventListener("click", () => {
    addDefaultResultRow(defaultResults);
  });
  defaultToggle.addEventListener("change", () => {
    defaultControls.classList.toggle("hidden", !defaultToggle.checked);
    if (!defaultToggle.checked) {
      defaultResults.innerHTML = "";
      return;
    }
    if (!defaultResults.children.length) {
      addDefaultResultRow(defaultResults);
    }
  });

  const nameInput = card.querySelector(".param-name");
  const unitInput = card.querySelector(".param-unit");
  const typeSelect = card.querySelector(".param-type");
  const addLineToggle = card.querySelector(".param-add-line-toggle");
  const normalsContainer = card.querySelector(".normals");

  const defaultResultsList =
    Array.isArray(prefill?.defaultResults) ? prefill.defaultResults : [];
  if (defaultResultsList.length) {
    defaultToggle.checked = true;
    defaultControls.classList.remove("hidden");
    defaultResults.innerHTML = "";
    defaultResultsList.forEach(value => addDefaultResultRow(defaultResults, value));
  }

  if (prefill) {
    nameInput.value = prefill.name || "";
    unitInput.value = prefill.unit || "";
    typeSelect.value = prefill.valueType || "";
    if (addLineToggle) {
      addLineToggle.checked = Boolean(prefill.allowNewLines);
    }
  }

  const normalsList =
    Array.isArray(prefill?.normalLines) ? prefill.normalLines : [];
  normalsContainer.innerHTML = "";
  if (normalsList.length) {
    normalsList.forEach(value => addNormalRow(normalsContainer, value));
  } else {
    addNormalRow(normalsContainer, "");
  }

  refreshParameterLabels();
  toggleParameters();
}

function addNormalRow(container, value = "") {
  const row = document.createElement("div");
  row.className = "normal-row";
  const normalId = `normal-${normalIdCounter++}`;
  row.innerHTML = `
    <input id="${normalId}" name="${normalId}" type="text" class="normal-text" placeholder="Normal value (e.g. [Male : 14.0 - 16.0 gms])">
    <button class="btn link remove-normal" type="button">Remove</button>
    <div class="row-error"></div>
  `;
  container.appendChild(row);
  row.querySelector(".normal-text").value = value == null ? "" : String(value);
  row.querySelector(".remove-normal").addEventListener("click", () => row.remove());
}

function addDefaultResultRow(container, value = "") {
  const row = document.createElement("div");
  row.className = "default-row";
  const defaultId = `default-${defaultIdCounter++}`;
  row.innerHTML = `
    <input id="${defaultId}" name="${defaultId}" type="text" class="default-result-input" placeholder="Result">
    <button class="btn link remove-default" type="button">Remove</button>
  `;
  container.appendChild(row);
  row.querySelector(".default-result-input").value = value == null ? "" : String(value);
  row.querySelector(".remove-default").addEventListener("click", () => row.remove());
}

function refreshParameterLabels() {
  const cards = [...document.querySelectorAll(".param-card")];
  cards.forEach((card, index) => {
    const title = card.querySelector(".param-title");
    title.textContent = "Parameter " + (index + 1);
  });
}

function setMessage(text, type) {
  formMessage.textContent = text || "";
  formMessage.className = "message" + (type ? " " + type : "");
}

function clearErrors() {
  document.querySelectorAll(".error").forEach(el => el.classList.remove("error"));
  document.querySelectorAll(".row-error").forEach(el => el.textContent = "");
}

function normalizeShortcut(value) {
  return (value || "").trim().toLowerCase();
}

async function loadShortcuts() {
  try {
    const res = await fetch(API_BASE_URL + "/tests");
    if (!res.ok) {
      return;
    }
    const list = await res.json();
    const tests = Array.isArray(list) ? list : [];
    testsCache = tests;
    existingShortcuts = new Set(
      tests
        .map(t => normalizeShortcut(t.shortcut))
        .filter(Boolean)
    );
    shortcutsLoaded = true;
    validateShortcut();
  } catch (err) {
    console.error(err);
  }
}

function validateShortcut() {
  const value = shortcutInput.value;
  const normalized = normalizeShortcut(value);

  if (!normalized) {
    shortcutMsg.textContent = "";
    shortcutInput.classList.remove("error");
    return false;
  }

  if (shortcutsLoaded
      && existingShortcuts.has(normalized)
      && (!editingShortcutNormalized || normalized !== editingShortcutNormalized)) {
    shortcutMsg.textContent = "Shortcut already exists.";
    shortcutInput.classList.add("error");
    return true;
  }

  shortcutMsg.textContent = "";
  shortcutInput.classList.remove("error");
  return false;
}

function normalizeNormalText(value) {
  return (value || "").trim();
}

function splitNormalLines(text) {
  return String(text == null ? "" : text)
    .replace(/\s+\/\s+/g, "\n")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

function clearParamCards() {
  paramList.innerHTML = "";
  paramIdCounter = 0;
  normalIdCounter = 0;
  defaultIdCounter = 0;
}

function applyTestToForm(test) {
  const testName = document.getElementById("testName");
  const shortcut = document.getElementById("shortcut");
  const category = document.getElementById("category");
  const cost = document.getElementById("cost");
  const active = document.getElementById("active");

  testName.value = test?.testName || "";
  shortcut.value = test?.shortcut || "";
  category.value = test?.category || "";
  cost.value = test?.cost == null ? "" : String(test.cost);
  active.checked = test?.active !== false;

  if (showTestNameInReportInput) {
    showTestNameInReportInput.checked = test?.showTestNameInReport !== false;
    delete showTestNameInReportInput.dataset.prevChecked;
  }

  editingShortcutNormalized = normalizeShortcut(test?.shortcut);

  const params = Array.isArray(test?.parameters) ? test.parameters : [];
  const fallbackNormals = Array.isArray(test?.normalValues)
    ? test.normalValues
        .map(n => n && (n.normalValue || n.textValue || n.value))
        .filter(Boolean)
        .map(v => String(v))
    : [];

  clearParamCards();

  if (params.length) {
    params.forEach(param => {
      addParameter({
        name: param?.name || "",
        unit: param?.unit || "",
        valueType: param?.valueType || "",
        allowNewLines: Boolean(param?.allowNewLines),
        defaultResults: Array.isArray(param?.defaultResults) ? param.defaultResults : [],
        normalLines: splitNormalLines(param?.normalText)
      });
    });
    return;
  }

  addParameter({
    name: "",
    unit: "",
    valueType: "NUMBER",
    allowNewLines: false,
    defaultResults: [],
    normalLines: fallbackNormals.length ? fallbackNormals : []
  });
}

function collectPayload() {
  clearErrors();
  const errors = [];

  const testName = document.getElementById("testName");
  const shortcut = document.getElementById("shortcut");
  const category = document.getElementById("category");
  const cost = document.getElementById("cost");
  const active = document.getElementById("active");
  const showTestNameInReport = showTestNameInReportInput
    ? Boolean(showTestNameInReportInput.checked)
    : true;
  if (!testName.value.trim()) {
    testName.classList.add("error");
    errors.push("Test name is required.");
  }
  if (!shortcut.value.trim()) {
    shortcut.classList.add("error");
    errors.push("Shortcut is required.");
  }
  if (validateShortcut()) {
    errors.push("Shortcut already exists.");
  }
  if (!category.value.trim()) {
    category.classList.add("error");
    errors.push("Category is required.");
  }

  const costRaw = cost.value.trim();
  let costValue = null;
  if (!costRaw) {
    cost.classList.add("error");
    errors.push("Cost is required.");
  } else {
    costValue = Number(costRaw);
    if (Number.isNaN(costValue)) {
      cost.classList.add("error");
      errors.push("Cost must be a number.");
    }
  }

  const cards = [...document.querySelectorAll(".param-card")];

  if (cards.length === 0) {
    errors.push("Add at least one parameter.");
  }

  const parameters = [];

  cards.forEach(card => {
    const nameInput = card.querySelector(".param-name");
    const unitInput = card.querySelector(".param-unit");
    const typeSelect = card.querySelector(".param-type");
    const defaultToggle = card.querySelector(".param-default-toggle-input");
    const defaultResultsContainer = card.querySelector(".default-results");
    const addLineToggle = card.querySelector(".param-add-line-toggle");

    if (!typeSelect.value) {
      typeSelect.classList.add("error");
      errors.push("Value type is required.");
      return;
    }

    const normals = [];
    const normalRows = [...card.querySelectorAll(".normal-row")];

    normalRows.forEach(row => {
      const textValueRaw = normalizeNormalText(
        row.querySelector(".normal-text").value
      );
      if (!textValueRaw) {
        return;
      }

      normals.push({
        textValue: textValueRaw
      });
    });

    const defaultResults = defaultToggle.checked
      ? [...defaultResultsContainer.querySelectorAll(".default-result-input")]
          .map(input => input.value.trim())
          .filter(Boolean)
      : [];

    const nameRaw = nameInput.value.trim();
    parameters.push({
      name: nameRaw || null,
      unit: unitInput.value.trim() || null,
      valueType: typeSelect.value,
      defaultResults: defaultResults.length ? defaultResults : null,
      normalRanges: normals,
      allowNewLines: !!(addLineToggle && addLineToggle.checked)
    });
  });

  if (errors.length) {
    setMessage("Please fix the highlighted errors.", "error");
    return null;
  }

  return {
    testName: testName.value.trim(),
    shortcut: shortcut.value.trim(),
    category: category.value.trim(),
    cost: costValue,
    active: active.checked,
    showTestNameInReport: showTestNameInReport,
    parameters: parameters
  };
}

async function saveTest() {
  const payload = collectPayload();
  if (!payload) {
    return;
  }

  setMessage(editingId ? "Updating..." : "Saving...", "");
  saveBtn.disabled = true;

  try {
    const url = editingId
      ? (API_BASE_URL + "/tests/" + editingId)
      : (API_BASE_URL + "/tests");
    const method = editingId ? "PUT" : "POST";
    const res = await fetch(url, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      setMessage(errText || "Save failed.", "error");
      saveBtn.disabled = false;
      return;
    }

    setMessage(editingId ? "Updated successfully." : "Saved successfully.", "success");
    setTimeout(() => {
      window.location.href = "../5-tests.html";
    }, 600);
  } catch (err) {
    console.error(err);
    setMessage("Backend not running or network error.", "error");
  } finally {
    saveBtn.disabled = false;
  }
}

async function initPage() {
  if (editingId && title) {
    title.textContent = "Edit Test";
  }
  if (editingId && saveBtn) {
    saveBtn.textContent = "Update Test";
  }

  await loadShortcuts();

  if (editingId) {
    const list = Array.isArray(testsCache) ? testsCache : [];
    const match = list.find(t => Number(t?.id) === Number(editingId));
    if (!match) {
      setMessage("Test not found.", "error");
      return;
    }
    applyTestToForm(match);
    validateShortcut();
    toggleParameters();
    return;
  }

  addParameter();
  toggleParameters();
}

initPage();
