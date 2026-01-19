const title = document.getElementById("title");
const groupName = document.getElementById("groupName");
const shortcut = document.getElementById("shortcut");
const category = document.getElementById("category");
const cost = document.getElementById("cost");
const active = document.getElementById("active");
const slotList = document.getElementById("slotList");
const addTestBtn = document.getElementById("addTestBtn");
const status = document.getElementById("status");
const saveBtn = document.getElementById("saveBtn");

const params = new URLSearchParams(location.search);
const editId = params.get("edit");

let tests = [];
let testMap = new Map();
let slots = [];
let slotCounter = 0;

addTestBtn.addEventListener("click", () => addSlot());
saveBtn.addEventListener("click", () => saveGroup());

function setStatus(message, type){
  status.textContent = message || "";
  status.className = "message" + (type ? " " + type : "");
}

function normalizeId(value){
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function getSelectedIds(excludeSlotId){
  return new Set(
    slots
      .filter(slot => slot.testId && slot.id !== excludeSlotId)
      .map(slot => slot.testId)
  );
}

function normalizeQuery(value){
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function formatValue(value, fallback){
  if (value === null || value === undefined || value === "") {
    return fallback || "—";
  }
  return String(value);
}

function formatCost(value){
  const num = Number(value);
  return Number.isFinite(num) ? `₹${num}` : "—";
}

function getParamNormals(param){
  if (!param) return "";
  if (Array.isArray(param.normalRanges) && param.normalRanges.length) {
    return param.normalRanges
      .map(r => (r && r.textValue ? String(r.textValue) : ""))
      .filter(Boolean)
      .join(" | ");
  }
  if (param.normalText) {
    return String(param.normalText);
  }
  return "";
}

function renderParamList(test){
  const params = Array.isArray(test.parameters) ? test.parameters : [];
  if (params.length) {
    return params.map((param, index) => {
      const name = param.name || `Parameter ${index + 1}`;
      const unit = param.unit || "—";
      const type = param.valueType || "—";
      const normals = getParamNormals(param);
      const normalText = normals ? `<div class="param-normal">Normal: ${normals}</div>` : "";
      return `
        <div class="param-item">
          <div class="param-title">${name}</div>
          <div class="param-meta">Unit: ${unit} · Type: ${type}</div>
          ${normalText}
        </div>
      `;
    }).join("");
  }

  const normalValues = Array.isArray(test.normalValues) ? test.normalValues : [];
  const normals = normalValues
    .map(n => (n && n.normalValue ? String(n.normalValue) : ""))
    .filter(Boolean)
    .join(" | ");

  if (!normals) {
    return '<div class="param-item"><div class="param-title">No parameters</div></div>';
  }

  return `
    <div class="param-item">
      <div class="param-title">Normal Values</div>
      <div class="param-normal">${normals}</div>
    </div>
  `;
}

function renderDetails(slot){
  const detail = slot.detail;
  const test = testMap.get(slot.testId);
  if (!test) {
    detail.innerHTML = '<div class="muted">Select a test to see details.</div>';
    return;
  }

  const shortcutText = test.shortcut || "—";
  const categoryText = test.category || "—";
  const activeText = test.active ? "Active" : "Inactive";

  detail.innerHTML = `
    <div class="detail-grid">
      <div>
        <div class="detail-label">Test Name</div>
        <div class="detail-value">${formatValue(test.testName, "—")}</div>
      </div>
      <div>
        <div class="detail-label">Shortcut</div>
        <div class="detail-value">${shortcutText}</div>
      </div>
      <div>
        <div class="detail-label">Category</div>
        <div class="detail-value">${categoryText}</div>
      </div>
      <div>
        <div class="detail-label">Cost</div>
        <div class="detail-value">${formatCost(test.cost)}</div>
      </div>
      <div>
        <div class="detail-label">Status</div>
        <div class="detail-value">${activeText}</div>
      </div>
    </div>
    <div class="param-list">
      ${renderParamList(test)}
    </div>
  `;
}

function setSlotInputFromSelection(slot){
  const test = testMap.get(slot.testId);
  if (!test) {
    slot.searchInput.value = "";
    return;
  }
  const shortcutText = test.shortcut ? ` (${test.shortcut})` : "";
  slot.searchInput.value = `${test.testName || ""}${shortcutText}`.trim();
}

function rankSuggestion(test, query){
  const name = normalizeQuery(test.testName);
  const shortcut = normalizeQuery(test.shortcut);
  if (shortcut && shortcut.startsWith(query)) {
    return 0;
  }
  if (name.startsWith(query)) {
    return 1;
  }
  if (shortcut && shortcut.includes(query)) {
    return 2;
  }
  return 3;
}

function setActiveSuggestion(slot, index){
  if (!slot.suggestionItems.length) {
    slot.activeSuggestionIndex = -1;
    return;
  }

  if (index < 0) {
    slot.activeSuggestionIndex = slot.suggestionItems.length - 1;
  } else if (index >= slot.suggestionItems.length) {
    slot.activeSuggestionIndex = 0;
  } else {
    slot.activeSuggestionIndex = index;
  }

  const items = slot.suggestions.querySelectorAll(".suggestion");
  items.forEach((item, idx) => {
    item.classList.toggle("active", idx === slot.activeSuggestionIndex);
  });
}

function updateSlotSuggestions(slot){
  const query = normalizeQuery(slot.searchInput.value);

  if (!query) {
    slot.suggestionItems = [];
    slot.activeSuggestionIndex = -1;
    slot.suggestions.innerHTML = "";
    slot.suggestions.classList.add("hidden");
    slot.noResult.classList.add("hidden");
    return;
  }

  const selectedElsewhere = getSelectedIds(slot.id);

  const matches = tests
    .filter(test => {
      const id = Number(test?.id);
      if (!Number.isFinite(id)) {
        return false;
      }
      if (selectedElsewhere.has(id)) {
        return false;
      }
      const name = normalizeQuery(test.testName);
      const shortcut = normalizeQuery(test.shortcut);
      return name.includes(query) || shortcut.includes(query);
    })
    .map(test => ({
      id: Number(test.id),
      name: test.testName || "",
      shortcut: test.shortcut || "",
      cost: Number(test.cost) || 0,
      rank: rankSuggestion(test, query)
    }))
    .sort((a, b) => {
      const rankDiff = a.rank - b.rank;
      if (rankDiff !== 0) {
        return rankDiff;
      }
      return (a.id || 0) - (b.id || 0);
    })
    .slice(0, 8);

  slot.suggestionItems = matches;
  slot.activeSuggestionIndex = matches.length ? 0 : -1;
  slot.suggestions.innerHTML = "";

  matches.forEach((item, index) => {
    const shortcut = item.shortcut ? item.shortcut : "";
    const activeClass = index === slot.activeSuggestionIndex ? " active" : "";
    const meta = shortcut ? shortcut : " ";
    slot.suggestions.innerHTML += `
      <div class="suggestion${activeClass}" data-id="${item.id}">
        <div class="suggestion-main">
          <div class="suggestion-name">${item.name || ""}</div>
          <div class="suggestion-meta">${meta}</div>
        </div>
        <div class="suggestion-cost">₹${item.cost}</div>
      </div>
    `;
  });

  slot.suggestions.classList.toggle("hidden", !matches.length);
  slot.noResult.classList.toggle("hidden", matches.length > 0);
}

function chooseSlotTest(slot, testId){
  const id = Number(testId);
  if (!Number.isFinite(id)) {
    return;
  }

  const selectedElsewhere = getSelectedIds(slot.id);
  if (selectedElsewhere.has(id)) {
    setStatus("This test is already selected in another slot.", "error");
    return;
  }

  slot.testId = id;
  setSlotInputFromSelection(slot);
  renderDetails(slot);
  slots.forEach(other => {
    if (other.suggestions && !other.suggestions.classList.contains("hidden")) {
      updateSlotSuggestions(other);
    }
  });
}

function handleSlotSuggestionClick(slot, event){
  const item = event.target.closest(".suggestion");
  if (!item) {
    return;
  }
  chooseSlotTest(slot, item.dataset.id);
  slot.suggestions.classList.add("hidden");
  slot.noResult.classList.add("hidden");
}

function handleSlotSuggestionKeys(slot, event){
  if (event.key === "ArrowDown") {
    if (slot.suggestionItems.length) {
      event.preventDefault();
      setActiveSuggestion(slot, slot.activeSuggestionIndex + 1);
    }
    return;
  }

  if (event.key === "ArrowUp") {
    if (slot.suggestionItems.length) {
      event.preventDefault();
      setActiveSuggestion(slot, slot.activeSuggestionIndex - 1);
    }
    return;
  }

  if (event.key === "Enter") {
    if (slot.suggestionItems.length) {
      event.preventDefault();
      const active = slot.suggestionItems[slot.activeSuggestionIndex] || slot.suggestionItems[0];
      if (active) {
        chooseSlotTest(slot, active.id);
      }
      slot.suggestions.classList.add("hidden");
      slot.noResult.classList.add("hidden");
    }
    return;
  }

  if (event.key === "Escape") {
    slot.suggestions.classList.add("hidden");
    slot.noResult.classList.add("hidden");
  }
}

function addSlot(testId){
  const slotId = `slot-${slotCounter++}`;
  const wrapper = document.createElement("div");
  wrapper.className = "slot-card";

  wrapper.innerHTML = `
    <div class="slot-header">
      <h4 class="slot-title"></h4>
      <button class="btn link" type="button">Remove</button>
    </div>
    <div class="grid-2">
      <div>
        <label>Select Test</label>
        <div class="search-wrap">
          <input class="test-search" placeholder="Search test..." autocomplete="off">
          <div class="suggestions hidden"></div>
        </div>
        <div class="no-result hidden">❌ No test available</div>
      </div>
      <div class="inline">
        <input type="checkbox" disabled>
        <label class="label-inline">Details (read-only)</label>
      </div>
    </div>
    <div class="detail-card"></div>
  `;

  const searchInput = wrapper.querySelector(".test-search");
  const suggestions = wrapper.querySelector(".suggestions");
  const noResult = wrapper.querySelector(".no-result");
  const removeBtn = wrapper.querySelector(".btn.link");
  const titleEl = wrapper.querySelector(".slot-title");
  const detail = wrapper.querySelector(".detail-card");

  const slot = {
    id: slotId,
    testId: normalizeId(testId),
    wrapper,
    searchInput,
    suggestions,
    noResult,
    suggestionItems: [],
    activeSuggestionIndex: -1,
    detail,
    titleEl
  };
  slots.push(slot);

  searchInput.addEventListener("input", () => updateSlotSuggestions(slot));
  searchInput.addEventListener("keydown", event => handleSlotSuggestionKeys(slot, event));
  suggestions.addEventListener("click", event => handleSlotSuggestionClick(slot, event));
  searchInput.addEventListener("focus", () => updateSlotSuggestions(slot));
  searchInput.addEventListener("blur", () => {
    setTimeout(() => {
      slot.suggestions.classList.add("hidden");
      slot.noResult.classList.add("hidden");
      setSlotInputFromSelection(slot);
    }, 120);
  });

  removeBtn.addEventListener("click", () => {
    slots = slots.filter(item => item.id !== slot.id);
    wrapper.remove();
    slots.forEach(other => updateSlotSuggestions(other));
    refreshSlotTitles();
  });

  slotList.appendChild(wrapper);
  setSlotInputFromSelection(slot);
  renderDetails(slot);
  refreshSlotTitles();
}

function refreshSlotTitles(){
  slots.forEach((slot, index) => {
    slot.titleEl.textContent = `Test ${index + 1}`;
  });
}

async function loadData(){
  setStatus("Loading tests...");
  try {
    const testRes = await fetch(API_BASE_URL + "/tests/active");
    if (!testRes.ok) {
      setStatus("Failed to load tests.", "error");
      return;
    }
    tests = await testRes.json();
    tests = Array.isArray(tests) ? tests : [];
    testMap = new Map(tests.map(t => [Number(t.id), t]));

    if (editId) {
      const groupRes = await fetch(API_BASE_URL + "/groups/" + editId);
      if (groupRes.ok) {
        const group = await groupRes.json();
        title.textContent = "Edit Group";
        groupName.value = group.groupName || "";
        shortcut.value = group.shortcut || "";
        cost.value = group.cost == null ? "" : group.cost;
        if (group.category) {
          category.value = group.category;
        }
        if (typeof group.active === "boolean") {
          active.checked = group.active;
        }
        const ids = Array.isArray(group.testIds) ? group.testIds : [];
        ids.forEach(id => addSlot(id));
      } else {
        setStatus("Failed to load group.", "error");
      }
    }

    if (!slots.length) {
      addSlot();
    }

    setStatus("");
  } catch (err) {
    console.error(err);
    setStatus("Failed to load data. Check backend connection.", "error");
  }
}

async function saveGroup(){
  const nameValue = groupName.value.trim();
  const shortcutValue = shortcut.value.trim();
  const categoryValue = category.value.trim();
  const costValue = cost.value.trim();
  let costNumber = null;

  if (!nameValue) {
    setStatus("Group name is required.", "error");
    groupName.focus();
    return;
  }
  if (!shortcutValue) {
    setStatus("Shortcut is required.", "error");
    shortcut.focus();
    return;
  }
  if (costValue !== "") {
    costNumber = Number(costValue);
    if (Number.isNaN(costNumber)) {
      setStatus("Price must be a number.", "error");
      cost.focus();
      return;
    }
  }

  const testIds = slots
    .map(slot => slot.testId)
    .filter(id => Number.isFinite(id));

  const uniqueIds = [...new Set(testIds)];
  if (!uniqueIds.length) {
    setStatus("Select at least one test.", "error");
    return;
  }

  const payload = {
    groupName: nameValue,
    shortcut: shortcutValue,
    category: categoryValue || null,
    cost: costNumber,
    active: active.checked,
    testIds: uniqueIds
  };

  setStatus("Saving...");
  saveBtn.disabled = true;

  try {
    const url = editId
      ? API_BASE_URL + "/groups/" + editId
      : API_BASE_URL + "/groups";
    const method = editId ? "PUT" : "POST";

    const res = await fetch(url, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      setStatus(errText || "Save failed.", "error");
      saveBtn.disabled = false;
      return;
    }

    setStatus("Saved successfully.");
    setTimeout(() => {
      window.location.href = "../5-tests.html";
    }, 600);
  } catch (err) {
    console.error(err);
    setStatus("Backend not running or network error.", "error");
  } finally {
    saveBtn.disabled = false;
  }
}

loadData();
