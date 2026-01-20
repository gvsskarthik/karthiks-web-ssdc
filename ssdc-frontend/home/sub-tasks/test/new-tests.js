const paramList = document.getElementById("paramList");
const addParamBtn = document.getElementById("addParamBtn");
const saveBtn = document.getElementById("saveBtn");
const formMessage = document.getElementById("formMessage");
const shortcutInput = document.getElementById("shortcut");
const shortcutMsg = document.getElementById("shortcutMsg");

let shortcutsLoaded = false;
let existingShortcuts = new Set();
let paramIdCounter = 0;
let normalIdCounter = 0;

addParamBtn.addEventListener("click", () => addParameter());
saveBtn.addEventListener("click", () => saveTest());
shortcutInput.addEventListener("input", () => validateShortcut());
shortcutInput.addEventListener("blur", () => validateShortcut());

function addParameter() {
  const card = document.createElement("div");
  card.className = "param-card";
  const paramId = `param-${paramIdCounter++}`;
  const nameId = `${paramId}-name`;
  const unitId = `${paramId}-unit`;
  const typeId = `${paramId}-type`;
  const defaultToggleId = `${paramId}-default-toggle`;
  const defaultValueId = `${paramId}-default`;
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
        <label for="${defaultToggleId}">Default Result</label>
      </div>
      <div class="param-default-input hidden">
        <label for="${defaultValueId}">Result</label>
        <input id="${defaultValueId}" type="text" class="param-default-value" placeholder="Result">
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
  const defaultInputWrap = card.querySelector(".param-default-input");
  const defaultInput = card.querySelector(".param-default-value");
  defaultToggle.addEventListener("change", () => {
    defaultInputWrap.classList.toggle("hidden", !defaultToggle.checked);
    if (!defaultToggle.checked) {
      defaultInput.value = "";
    }
  });

  addNormalRow(card.querySelector(".normals"));
  refreshParameterLabels();
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
  const commonResult = document.getElementById("commonResult");

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
    const defaultInput = card.querySelector(".param-default-value");

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

    parameters.push({
      name: name || `Parameter ${index + 1}`,
      unit: unitInput.value.trim() || null,
      valueType: typeSelect.value,
      defaultResult: defaultToggle.checked
        ? (defaultInput.value.trim() || null)
        : null,
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
    cost: costValue,
    active: active.checked,
    commonResult: commonResult.checked,
    parameters: parameters
  };
}

async function saveTest() {
  const payload = collectPayload();
  if (!payload) {
    return;
  }

  setMessage("Saving...", "");
  saveBtn.disabled = true;

  try {
    const res = await fetch(API_BASE_URL + "/tests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      setMessage(errText || "Save failed.", "error");
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
