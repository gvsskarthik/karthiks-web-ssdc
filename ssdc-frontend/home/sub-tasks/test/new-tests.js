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

function clearNode(node) { window.ssdcDom.clear(node); }

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
  if (prefill && prefill.id != null) {
    const parsed = Number(prefill.id);
    if (Number.isFinite(parsed)) {
      card.dataset.paramId = String(parsed);
    }
  }
  const paramId = `param-${paramIdCounter++}`;
  const nameId = `${paramId}-name`;
  const unitId = `${paramId}-unit`;
  const typeId = `${paramId}-type`;
  const defaultToggleId = `${paramId}-default-toggle`;
  const addLineToggleId = `${paramId}-add-line-toggle`;

  const header = document.createElement("div");
  header.className = "param-header";
  const title = document.createElement("h4");
  title.className = "param-title";
  title.textContent = "Parameter";
  const removeBtn = document.createElement("button");
  removeBtn.className = "btn link remove-param";
  removeBtn.type = "button";
  removeBtn.textContent = "Remove";
  header.appendChild(title);
  header.appendChild(removeBtn);

  const grid = document.createElement("div");
  grid.className = "grid-3";

  const nameWrap = document.createElement("div");
  const nameLabel = document.createElement("label");
  nameLabel.htmlFor = nameId;
  nameLabel.textContent = "Parameter Name";
  const nameInput = document.createElement("input");
  nameInput.id = nameId;
  nameInput.type = "text";
  nameInput.className = "param-name";
  nameInput.placeholder = "Parameter Name";
  nameWrap.appendChild(nameLabel);
  nameWrap.appendChild(nameInput);

  const unitWrap = document.createElement("div");
  const unitLabel = document.createElement("label");
  unitLabel.htmlFor = unitId;
  unitLabel.textContent = "Unit";
  const unitInput = document.createElement("input");
  unitInput.id = unitId;
  unitInput.type = "text";
  unitInput.className = "param-unit";
  unitInput.placeholder = "Unit";
  unitWrap.appendChild(unitLabel);
  unitWrap.appendChild(unitInput);

  const typeWrap = document.createElement("div");
  const typeLabel = document.createElement("label");
  typeLabel.htmlFor = typeId;
  typeLabel.textContent = "Value Type";
  const typeSelect = document.createElement("select");
  typeSelect.id = typeId;
  typeSelect.className = "param-type";
  [
    { value: "", label: "Select value type" },
    { value: "NUMBER", label: "NUMBER" },
    { value: "TEXT", label: "TEXT" }
  ].forEach((opt) => {
    const o = document.createElement("option");
    o.value = opt.value;
    o.textContent = opt.label;
    typeSelect.appendChild(o);
  });
  typeWrap.appendChild(typeLabel);
  typeWrap.appendChild(typeSelect);

  grid.appendChild(nameWrap);
  grid.appendChild(unitWrap);
  grid.appendChild(typeWrap);

  const paramDefault = document.createElement("div");
  paramDefault.className = "param-default";

  const defaultToggleRow = document.createElement("div");
  defaultToggleRow.className = "param-default-toggle";

  const defaultToggle = document.createElement("input");
  defaultToggle.id = defaultToggleId;
  defaultToggle.type = "checkbox";
  defaultToggle.className = "param-default-toggle-input";
  const defaultToggleLabel = document.createElement("label");
  defaultToggleLabel.htmlFor = defaultToggleId;
  defaultToggleLabel.textContent = "Default Results";

  const addLineToggle = document.createElement("input");
  addLineToggle.id = addLineToggleId;
  addLineToggle.type = "checkbox";
  addLineToggle.className = "param-add-line-toggle";
  const addLineToggleLabel = document.createElement("label");
  addLineToggleLabel.htmlFor = addLineToggleId;
  addLineToggleLabel.textContent = "Add new line";

  defaultToggleRow.appendChild(defaultToggle);
  defaultToggleRow.appendChild(defaultToggleLabel);
  defaultToggleRow.appendChild(addLineToggle);
  defaultToggleRow.appendChild(addLineToggleLabel);

  const defaultControls = document.createElement("div");
  defaultControls.className = "param-default-controls hidden";
  const defaultHeader = document.createElement("div");
  defaultHeader.className = "section-row";
  const defaultTitle = document.createElement("h4");
  defaultTitle.textContent = "Default Results";
  const addDefaultBtn = document.createElement("button");
  addDefaultBtn.className = "btn small add-default";
  addDefaultBtn.type = "button";
  addDefaultBtn.textContent = "Add Result";
  defaultHeader.appendChild(defaultTitle);
  defaultHeader.appendChild(addDefaultBtn);
  const defaultResults = document.createElement("div");
  defaultResults.className = "default-results";
  defaultControls.appendChild(defaultHeader);
  defaultControls.appendChild(defaultResults);

  paramDefault.appendChild(defaultToggleRow);
  paramDefault.appendChild(defaultControls);

  const normalHeader = document.createElement("div");
  normalHeader.className = "section-row normal-section";
  const normalTitle = document.createElement("h4");
  normalTitle.textContent = "Normal Ranges";
  const addNormalBtn = document.createElement("button");
  addNormalBtn.className = "btn small add-normal";
  addNormalBtn.type = "button";
  addNormalBtn.textContent = "Add Normal";
  normalHeader.appendChild(normalTitle);
  normalHeader.appendChild(addNormalBtn);

  const normalsContainer = document.createElement("div");
  normalsContainer.className = "normals";

  card.appendChild(header);
  card.appendChild(grid);
  card.appendChild(paramDefault);
  card.appendChild(normalHeader);
  card.appendChild(normalsContainer);

  paramList.appendChild(card);
  removeBtn.addEventListener("click", () => {
    card.remove();
    refreshParameterLabels();
    ensureAtLeastOneParameter();
    updateRemoveButtons();
  });
  addNormalBtn.addEventListener("click", () => {
    addNormalRow(normalsContainer);
  });
  addDefaultBtn.addEventListener("click", () => {
    addDefaultResultRow(defaultResults);
  });
  defaultToggle.addEventListener("change", () => {
    defaultControls.classList.toggle("hidden", !defaultToggle.checked);
    if (!defaultToggle.checked) {
      clearNode(defaultResults);
      return;
    }
    if (!defaultResults.children.length) {
      addDefaultResultRow(defaultResults);
    }
  });

  const defaultResultsList =
    Array.isArray(prefill?.defaultResults) ? prefill.defaultResults : [];
  if (defaultResultsList.length) {
    defaultToggle.checked = true;
    defaultControls.classList.remove("hidden");
    clearNode(defaultResults);
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
  clearNode(normalsContainer);
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
  const input = document.createElement("input");
  input.id = normalId;
  input.name = normalId;
  input.type = "text";
  input.className = "normal-text";
  input.placeholder = "Normal value (e.g. [Male : 14.0 - 16.0 gms])";
  const removeBtn = document.createElement("button");
  removeBtn.className = "btn link remove-normal";
  removeBtn.type = "button";
  removeBtn.textContent = "Remove";
  const err = document.createElement("div");
  err.className = "row-error";
  row.appendChild(input);
  row.appendChild(removeBtn);
  row.appendChild(err);
  container.appendChild(row);
  input.value = value == null ? "" : String(value);
  removeBtn.addEventListener("click", () => row.remove());
}

function addDefaultResultRow(container, value = "") {
  const row = document.createElement("div");
  row.className = "default-row";
  const defaultId = `default-${defaultIdCounter++}`;
  const input = document.createElement("input");
  input.id = defaultId;
  input.name = defaultId;
  input.type = "text";
  input.className = "default-result-input";
  input.placeholder = "Result";
  const removeBtn = document.createElement("button");
  removeBtn.className = "btn link remove-default";
  removeBtn.type = "button";
  removeBtn.textContent = "Remove";
  row.appendChild(input);
  row.appendChild(removeBtn);
  container.appendChild(row);
  input.value = value == null ? "" : String(value);
  removeBtn.addEventListener("click", () => row.remove());
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
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

function clearParamCards() {
  clearNode(paramList);
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
        id: param?.id,
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
    const rawParamId = card.dataset.paramId;
    const paramIdValue = rawParamId == null ? null : Number(rawParamId);
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
      id: Number.isFinite(paramIdValue) ? paramIdValue : null,
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
