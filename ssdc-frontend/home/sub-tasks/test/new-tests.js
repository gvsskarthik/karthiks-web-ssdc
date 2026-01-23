const paramList = document.getElementById("paramList");
const addParamBtn = document.getElementById("addParamBtn");
const saveBtn = document.getElementById("saveBtn");
const formMessage = document.getElementById("formMessage");
const shortcutInput = document.getElementById("shortcut");
const shortcutMsg = document.getElementById("shortcutMsg");
const enableParameters = document.getElementById("enableParameters");

let shortcutsLoaded = false;
let existingShortcuts = new Set();
let paramIdCounter = 0;
let normalIdCounter = 0;
let defaultIdCounter = 0;

addParamBtn.addEventListener("click", () => addParameter());
saveBtn.addEventListener("click", () => saveTest());
shortcutInput.addEventListener("input", () => validateShortcut());
shortcutInput.addEventListener("blur", () => validateShortcut());
enableParameters.addEventListener("change", () => {
  setParametersEnabled(enableParameters.checked);
});

function addParameter() {
  const card = document.createElement("div");
  card.className = "param-card";
  const paramId = `param-${paramIdCounter++}`;
  const nameId = `${paramId}-name`;
  const unitId = `${paramId}-unit`;
  const typeId = `${paramId}-type`;
  const defaultToggleId = `${paramId}-default-toggle`;
  const multiLineToggleId = `${paramId}-multiline-toggle`;
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
        <input id="${multiLineToggleId}" type="checkbox" class="param-multiline-toggle-input">
        <label for="${multiLineToggleId}">Add New Line</label>
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

  addNormalRow(card.querySelector(".normals"));
  refreshParameterLabels();
  setParametersEnabled(enableParameters.checked);
}

function addNormalRow(container) {
  const row = document.createElement("div");
  row.className = "normal-row";
  const normalId = `normal-${normalIdCounter++}`;
  row.innerHTML = `
    <input id="${normalId}" name="${normalId}" type="text" class="normal-text" placeholder="Normal value (e.g. [Male : 14.0 - 16.0 gms])">
    <button class="btn link remove-normal" type="button">Remove</button>
    <div class="row-error"></div>
  `;
  container.appendChild(row);
  row.querySelector(".remove-normal").addEventListener("click", () => row.remove());
}

function addDefaultResultRow(container) {
  const row = document.createElement("div");
  row.className = "default-row";
  const defaultId = `default-${defaultIdCounter++}`;
  row.innerHTML = `
    <input id="${defaultId}" name="${defaultId}" type="text" class="default-result-input" placeholder="Result">
    <button class="btn link remove-default" type="button">Remove</button>
  `;
  container.appendChild(row);
  row.querySelector(".remove-default").addEventListener("click", () => row.remove());
}

function refreshParameterLabels() {
  const cards = [...document.querySelectorAll(".param-card")];
  cards.forEach((card, index) => {
    const title = card.querySelector(".param-title");
    title.textContent = "Parameter " + (index + 1);
  });
}

function setParametersEnabled(enabled) {
  addParamBtn.disabled = !enabled;
  const nameInputs = paramList.querySelectorAll(".param-name");
  nameInputs.forEach(input => {
    input.disabled = !enabled;
    input.classList.toggle("is-disabled", !enabled);
  });
}

function setMessage(text, type) {
  formMessage.textContent = text || "";
  formMessage.className = "message" + (type ? " " + type : "");
}

function extractErrorMessage(text, status) {
  const cleaned = String(text || "").trim();
  if (!cleaned) {
    return `Save failed (HTTP ${status || "error"}).`;
  }
  if (cleaned.startsWith("<")) {
    return `Server error (HTTP ${status || "error"}).`;
  }
  try {
    const parsed = JSON.parse(cleaned);
    return parsed.message || parsed.detail || parsed.error || cleaned;
  } catch (err) {
    return cleaned;
  }
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
    const list = await apiList("tests?size=1000");
    existingShortcuts = new Set(
      (list || [])
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

  if (shortcutsLoaded && existingShortcuts.has(normalized)) {
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

function collectPayload() {
  clearErrors();
  const errors = [];

  const testName = document.getElementById("testName");
  const shortcut = document.getElementById("shortcut");
  const category = document.getElementById("category");
  const cost = document.getElementById("cost");
  const active = document.getElementById("active");

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

  const parameters = [];
  const cards = [...document.querySelectorAll(".param-card")];

  if (cards.length === 0) {
    errors.push("Add at least one parameter.");
  }

  cards.forEach((card, index) => {
    const nameInput = card.querySelector(".param-name");
    const unitInput = card.querySelector(".param-unit");
    const typeSelect = card.querySelector(".param-type");
    const defaultToggle = card.querySelector(".param-default-toggle-input");
    const defaultResultsContainer = card.querySelector(".default-results");
    const multiLineToggle = card.querySelector(".param-multiline-toggle-input");

    const name = nameInput.value.trim();
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

    parameters.push({
      name: name || `Parameter ${index + 1}`,
      unit: unitInput.value.trim() || null,
      valueType: typeSelect.value,
      allowMultiLine: !!multiLineToggle.checked,
      defaultResults: defaultResults.length ? defaultResults : null,
      normalRanges: normals
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
    price: costValue,
    isActive: active.checked,
    hasParameters: enableParameters.checked && parameters.length > 0,
    hasDefaultResults: parameters.some(param => Array.isArray(param.defaultResults) && param.defaultResults.length),
    allowMultipleResults: parameters.some(param => param.allowMultiLine)
  };
}

async function saveTest() {
  const payload = collectPayload();
  if (!payload) {
    return;
  }

  const multiLineConfig =
    JSON.parse(localStorage.getItem("testMultiLineConfig") || "{}");
  const shortcutKey = normalizeShortcut(payload.shortcut);
  if (shortcutKey) {
    multiLineConfig[shortcutKey] = (payload.parameters || [])
      .filter(p => p && p.allowMultiLine)
      .map(p => String(p.name || "").trim())
      .filter(Boolean);
    localStorage.setItem("testMultiLineConfig", JSON.stringify(multiLineConfig));
  }

  setMessage("Saving...", "");
  saveBtn.disabled = true;

  try {
    const res = await fetch(apiUrl("tests"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      setMessage(extractErrorMessage(errText, res.status), "error");
      saveBtn.disabled = false;
      return;
    }

    setMessage("Saved successfully.", "success");
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

addParameter();
loadShortcuts();
setParametersEnabled(enableParameters.checked);
