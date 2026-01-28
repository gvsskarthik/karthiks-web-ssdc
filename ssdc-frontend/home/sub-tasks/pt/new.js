/**
 * @typedef {{id:number,testName:string,shortcut?:string,cost?:number}} TestItem
 */

const patientForm = document.getElementById("patientForm");
const visitDate = document.getElementById("visitDate");
const doctor = document.getElementById("doctor");
const existingPatients = document.getElementById("existingPatients");
const selectedList = document.getElementById("selectedTests");
const noResult = document.getElementById("noResult");
const searchInput = document.getElementById("search");
const suggestions = document.getElementById("suggestions");
const savePatientBtn = document.getElementById("savePatientBtn");

visitDate.value = new Date().toISOString().split("T")[0];
let selected = new Set();
let testInfoMap = new Map();
let testOrderMap = new Map();
let testOrderCounter = 0;
let allTests = [];
let groups = [];
let groupMap = new Map();
let groupOrderMap = new Map();
let groupOrderCounter = 0;
let suggestionItems = [];
let activeSuggestionIndex = -1;
const existingList = [];
const nameInput = document.getElementById("name");
const mobileInput = document.getElementById("mobile");
const amountInput = document.getElementById("amount");
const discountInput = document.getElementById("discount");
const billItems = document.getElementById("billItems");
let lastBillEdited = null;
let isAutoBillUpdate = false;
let searchTimer = null;
let patientSearchController = null;
let patientSearchRequestId = 0;
let lastPatientSearchKey = "";
const PATIENT_SEARCH_DELAY_MS = 50;

searchInput.addEventListener("input", updateSuggestions);
searchInput.addEventListener("keydown", handleSuggestionKeys);
suggestions.addEventListener("click", handleSuggestionClick);
selectedList.addEventListener("change", handleSelectedChange);
savePatientBtn.addEventListener("click", () => patientForm.requestSubmit());

nameInput.addEventListener("input", () => {
  localStorage.removeItem("currentPatient");
  applyPatientFilter();
});

mobileInput.addEventListener("input", () => {
  localStorage.removeItem("currentPatient");
  applyPatientFilter();
});

existingPatients.addEventListener("click", (event) => {
  const btn = event.target.closest(".select-patient-btn");
  if (!btn) {
    return;
  }
  const index = Number(btn.dataset.index);
  const patient = existingList[index];
  if (patient) {
    selectPatient(patient);
  }
});

discountInput.addEventListener("input", () => {
  if (isAutoBillUpdate) {
    return;
  }
  lastBillEdited = "discount";
  updateBillFromSelection();
});

amountInput.addEventListener("input", () => {
  if (isAutoBillUpdate) {
    return;
  }
  lastBillEdited = "total";
  updateBillFromSelection();
});


/* LOAD DOCTORS */
fetch(API_BASE_URL + "/doctors")
.then(r=>r.json())
.then(list => {
  const seen = new Set(["self"]);
  (list || []).forEach(x => {
    const name = String(x?.name || "").trim();
    if (!name) {
      return;
    }
    const key = name.toLowerCase();
    if (key === "self" || seen.has(key)) {
      return;
    }
    seen.add(key);
    doctor.innerHTML += `<option>${name}</option>`;
  });
});

/* LOAD EXISTING PATIENTS (LIVE SEARCH) */
renderExistingPatients([], "idle");

function escapeHtml(value){
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function applyPatientFilter(){
  const nameQuery = nameInput.value.trim();
  const mobileQuery = normalizeDigits(mobileInput.value.trim());

  const hasQuery = !!nameQuery || !!mobileQuery;
  if (!hasQuery) {
    if (searchTimer) {
      clearTimeout(searchTimer);
      searchTimer = null;
    }
    if (patientSearchController) {
      patientSearchController.abort();
      patientSearchController = null;
    }
    lastPatientSearchKey = "";
    existingList.splice(0, existingList.length);
    renderExistingPatients([], "idle");
    return;
  }

  if (searchTimer) {
    clearTimeout(searchTimer);
  }

  searchTimer = setTimeout(() => {
    const searchKey = `${nameQuery.toLowerCase()}::${mobileQuery}`;
    if (searchKey === lastPatientSearchKey) {
      return;
    }
    lastPatientSearchKey = searchKey;

    if (patientSearchController) {
      patientSearchController.abort();
    }
    patientSearchController = new AbortController();
    const requestId = ++patientSearchRequestId;

    const params = new URLSearchParams();
    params.set("name", nameQuery);
    params.set("mobile", mobileQuery);

    fetch(`${API_BASE_URL}/patients/search?${params.toString()}`, {
      signal: patientSearchController.signal
    })
    .then(r => r.json())
    .then(list => {
      if (requestId !== patientSearchRequestId) {
        return;
      }
      const safe = Array.isArray(list) ? list : [];
      existingList.splice(0, existingList.length, ...safe);
      renderExistingPatients(safe);
    })
    .catch(err => {
      if (err && err.name === "AbortError") {
        return;
      }
      console.error(err);
    });
  }, PATIENT_SEARCH_DELAY_MS);
}

function normalizeDigits(value){
  return String(value || "").replace(/\D/g, "");
}

function renderExistingPatients(list, mode){
  existingPatients.innerHTML = "";

  if (mode === "idle") {
    existingPatients.innerHTML = `<div class="no-result">Type name or mobile to search</div>`;
    return;
  }

  if (!list.length) {
    existingPatients.innerHTML = `<div class="no-result">No matching patients</div>`;
    return;
  }

  const html = list.map((p, index) => `
    <div class="patient-row">
      <div><b>${escapeHtml(p?.name || "")}</b><br>${escapeHtml(p?.mobile || "")}</div>
      <button class="small-btn select-patient-btn" type="button" data-index="${index}">SELECT</button>
    </div>
  `).join("");

  existingPatients.innerHTML = html;
}

function parseMoney(value){
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatMoney(value){
  return String(Math.round(value * 100) / 100);
}

function resolveGroupCost(group){
  const cost = Number(group.cost);
  if (Number.isFinite(cost)) {
    return cost;
  }
  let sum = 0;
  (group.testIds || []).forEach(id => {
    const testInfo = testInfoMap.get(id);
    sum += Number(testInfo?.cost) || 0;
  });
  return Math.round(sum * 100) / 100;
}

function deriveGroupSelection(){
  const ordered = [...groupMap.values()]
    .filter(group => Array.isArray(group.testIds) && group.testIds.length)
    .sort((a, b) => {
      const diff = b.testIds.length - a.testIds.length;
      if (diff !== 0) return diff;
      const orderA = groupOrderMap.has(a.id) ? groupOrderMap.get(a.id) : 0;
      const orderB = groupOrderMap.has(b.id) ? groupOrderMap.get(b.id) : 0;
      return orderA - orderB;
    });

  const selectedGroups = [];
  const coveredTests = new Set();

  ordered.forEach(group => {
    const ids = group.testIds || [];
    const allSelected = ids.every(id => selected.has(id));
    if (!allSelected) {
      return;
    }
    const overlaps = ids.some(id => coveredTests.has(id));
    if (overlaps) {
      return;
    }
    selectedGroups.push(group);
    ids.forEach(id => coveredTests.add(id));
  });

  return { selectedGroups, coveredTests };
}

function setInputValue(input, value){
  isAutoBillUpdate = true;
  input.value = value;
  isAutoBillUpdate = false;
}

function buildBillLines(){
  const lines = [];
  let baseTotal = 0;

  const { selectedGroups, coveredTests } = deriveGroupSelection();

  const groupRows = selectedGroups
    .slice()
    .sort((a, b) => {
      const orderA = groupOrderMap.has(a.id)
        ? groupOrderMap.get(a.id)
        : Number.MAX_SAFE_INTEGER;
      const orderB = groupOrderMap.has(b.id)
        ? groupOrderMap.get(b.id)
        : Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return String(a.groupName || "").localeCompare(String(b.groupName || ""));
    });

  groupRows.forEach(group => {
    const cost = resolveGroupCost(group);
    lines.push({ label: `${group.groupName || "Group"} (Group)`, cost });
    baseTotal += cost;
  });

  const rows = [...selected]
    .filter(id => !coveredTests.has(id))
    .map(id => ({ id, ...(testInfoMap.get(id) || {}) }))
    .filter(item => item && item.name)
    .sort((a, b) => {
      const orderA = testOrderMap.has(a.id)
        ? testOrderMap.get(a.id)
        : Number.MAX_SAFE_INTEGER;
      const orderB = testOrderMap.has(b.id)
        ? testOrderMap.get(b.id)
        : Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.name.localeCompare(b.name);
    });

  rows.forEach(item => {
    const cost = Number(item.cost) || 0;
    lines.push({ label: item.name, cost });
    baseTotal += cost;
  });

  return { lines, baseTotal: Math.round(baseTotal * 100) / 100 };
}

function renderBillItems(){
  billItems.innerHTML = "";
  if (!selected.size) {
    billItems.innerHTML = `<div class="no-result">No tests selected</div>`;
    return 0;
  }

  const { lines, baseTotal } = buildBillLines();
  if (!lines.length) {
    billItems.innerHTML = `<div class="no-result">No tests selected</div>`;
    return 0;
  }

  lines.forEach(line => {
    billItems.innerHTML += `
      <div class="bill-row">
        <div class="bill-name">${line.label}</div>
        <div class="bill-amount">₹${formatMoney(Number(line.cost) || 0)}</div>
      </div>
    `;
  });

  return baseTotal;
}

function syncBillTotals(baseTotal){
  let discount = parseMoney(discountInput.value);
  let total = parseMoney(amountInput.value);

  if (lastBillEdited === "discount") {
    total = baseTotal - discount;
  } else if (lastBillEdited === "total") {
    discount = baseTotal - total;
  } else {
    discount = 0;
    total = baseTotal;
  }

  setInputValue(discountInput, formatMoney(discount));
  setInputValue(amountInput, formatMoney(total));
}

function updateBillFromSelection(){
  const baseTotal = renderBillItems();
  syncBillTotals(baseTotal);
}

/* ✅ FIXED */
function selectPatient(p){
  document.getElementById("name").value    = p.name || "";
  document.getElementById("age").value     = p.age || "";
  document.getElementById("gender").value  = p.gender || "Male";
  document.getElementById("mobile").value  = p.mobile || "";
  document.getElementById("address").value = p.address || "";
  document.getElementById("doctor").value  = p.doctor || "SELF";
  lastBillEdited = null;
  setInputValue(discountInput, "");
  setInputValue(amountInput, "");
  updateBillFromSelection();

  // Prefill only; keep visits separate
  localStorage.setItem("prefillPatient", JSON.stringify(p));
  localStorage.removeItem("currentPatient");
  localStorage.removeItem("patientResults");
  localStorage.removeItem("selectedTests");
  applyPatientFilter();
}
/* TEST LIST */

Promise.all([
  fetch(API_BASE_URL + "/tests/active").then(r => r.json()),
  fetch(API_BASE_URL + "/groups").then(r => r.json()).catch(() => [])
])
.then(([testList, groupList]) => {
  try {
    localStorage.setItem("testsActiveCache", JSON.stringify(testList || []));
    localStorage.setItem("testsActiveCacheAt", String(Date.now()));
  } catch (e) {
    // ignore storage errors
  }
  initTests(testList, groupList);
});

/** @param {TestItem[]} list */
function initTests(list, groupList){
  const tests = (Array.isArray(list) ? list : [])
    .filter(test => test && test.active !== false);
  const incomingGroups = Array.isArray(groupList) ? groupList : [];
  const ordered = [...tests].sort((a, b) => {
    const left = Number(a && a.id) || 0;
    const right = Number(b && b.id) || 0;
    return left - right;
  });

  allTests = ordered;
  testInfoMap = new Map();
  testOrderMap = new Map();
  testOrderCounter = 0;
  groups = incomingGroups;
  groupMap = new Map();
  groupOrderMap = new Map();
  groupOrderCounter = 0;

  ordered.forEach(test => {
    if (!test || test.id == null) {
      return;
    }
    const name = test.testName || "";
    const shortcut = test.shortcut || "";
    testInfoMap.set(test.id, {
      name,
      shortcut,
      cost: Number(test.cost) || 0
    });
    if (!testOrderMap.has(test.id)) {
      testOrderMap.set(test.id, testOrderCounter++);
    }
  });

  groups
    .filter(group => group && group.active !== false)
    .map(group => {
      const ids = Array.isArray(group.testIds) ? group.testIds : [];
      const testIds = ids
        .map(id => Number(id))
        .filter(id => Number.isFinite(id) && testInfoMap.has(id));
      return { ...group, testIds };
    })
    .forEach(group => {
      const groupId = Number(group?.id);
      if (!Number.isFinite(groupId)) {
        return;
      }
      const normalized = { ...group, id: groupId };
      groupMap.set(groupId, normalized);
      groupOrderMap.set(groupId, groupOrderCounter++);
    });

  renderSelectedList();
  updateBillFromSelection();
  updateSuggestions();
}

/* ================= LOGIC ================= */

function addSelectedTest(id){
  if (!testInfoMap.has(id)) {
    return;
  }
  if (selected.has(id)) {
    return;
  }
  selected.add(id);
  renderSelectedList();
  updateBillFromSelection();
}

function addSelectedGroup(groupId){
  const group = groupMap.get(groupId);
  if (!group || !Array.isArray(group.testIds)) {
    return;
  }
  group.testIds.forEach(id => {
    if (testInfoMap.has(id)) {
      selected.add(id);
    }
  });
  renderSelectedList();
  updateBillFromSelection();
  updateSuggestions();
}

function removeSelectedTest(id){
  if (!selected.has(id)) {
    return;
  }
  selected.delete(id);
  renderSelectedList();
  updateBillFromSelection();
  updateSuggestions();
}

function renderSelectedList(){
  selectedList.innerHTML = "";
  if (!selected.size) {
    selectedList.innerHTML = `<div class="no-result">No tests selected</div>`;
    return;
  }

  const { selectedGroups, coveredTests } = deriveGroupSelection();

  const groupRows = selectedGroups
    .slice()
    .sort((a, b) => {
      const orderA = groupOrderMap.has(a.id)
        ? groupOrderMap.get(a.id)
        : Number.MAX_SAFE_INTEGER;
      const orderB = groupOrderMap.has(b.id)
        ? groupOrderMap.get(b.id)
        : Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return String(a.groupName || "").localeCompare(String(b.groupName || ""));
    });

  const testRows = [...selected]
    .filter(id => !coveredTests.has(id))
    .map(id => ({ id, ...(testInfoMap.get(id) || {}) }))
    .filter(item => item && item.name)
    .sort((a, b) => {
      const orderA = testOrderMap.has(a.id)
        ? testOrderMap.get(a.id)
        : Number.MAX_SAFE_INTEGER;
      const orderB = testOrderMap.has(b.id)
        ? testOrderMap.get(b.id)
        : Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.name.localeCompare(b.name);
    });

  if (!groupRows.length && !testRows.length) {
    selectedList.innerHTML = `<div class="no-result">No tests selected</div>`;
    return;
  }

  groupRows.forEach(group => {
    const shortcutText = group.shortcut ? ` (${group.shortcut})` : "";
    const cost = resolveGroupCost(group);
    selectedList.innerHTML += `
      <div class="selected-item group-item">
        <label>
          <input class="selected-checkbox" data-type="group" type="checkbox" checked value="${group.id}">
          ${group.groupName || "Group"}${shortcutText}
        </label>
        <div class="selected-cost">₹${formatMoney(cost)}</div>
      </div>
    `;

    (group.testIds || [])
      .map(id => ({ id, ...(testInfoMap.get(id) || {}) }))
      .filter(item => item && item.name)
      .forEach(item => {
        const itemShortcut = item.shortcut ? ` (${item.shortcut})` : "";
        selectedList.innerHTML += `
          <div class="selected-item group-test">
            <label>
              <input class="selected-checkbox" data-type="test" type="checkbox" checked value="${item.id}">
              ${item.name}${itemShortcut}
            </label>
            <div class="selected-cost">₹${formatMoney(Number(item.cost) || 0)}</div>
          </div>
        `;
      });
  });

  testRows.forEach(item => {
    const shortcut = item.shortcut ? ` (${item.shortcut})` : "";
    selectedList.innerHTML += `
      <div class="selected-item">
        <label>
          <input class="selected-checkbox" data-type="test" type="checkbox" checked value="${item.id}">
          ${item.name}${shortcut}
        </label>
        <div class="selected-cost">₹${formatMoney(Number(item.cost) || 0)}</div>
      </div>
    `;
  });
}

function handleSelectedChange(event){
  const target = event.target;
  if (!target.classList.contains("selected-checkbox")) {
    return;
  }
  if (!target.checked) {
    const type = target.dataset.type || "test";
    const id = Number(target.value);
    if (type === "group") {
      const group = groupMap.get(id);
      if (group && Array.isArray(group.testIds)) {
        group.testIds.forEach(testId => selected.delete(testId));
      }
      renderSelectedList();
      updateBillFromSelection();
      updateSuggestions();
      return;
    }
    removeSelectedTest(id);
  }
}

function normalizeQuery(value){
  return String(value || "").trim().toLowerCase();
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

function rankGroupSuggestion(group, query){
  const name = normalizeQuery(group.groupName);
  const shortcut = normalizeQuery(group.shortcut);
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

function groupMatchesQuery(group, query){
  const name = normalizeQuery(group.groupName);
  const shortcut = normalizeQuery(group.shortcut);
  if (name.includes(query) || shortcut.includes(query)) {
    return true;
  }
  return (group.testIds || []).some(id => {
    const test = testInfoMap.get(id);
    const testName = normalizeQuery(test?.name);
    const testShortcut = normalizeQuery(test?.shortcut);
    return testName.includes(query) || testShortcut.includes(query);
  });
}

function updateSuggestions(){
  const query = normalizeQuery(searchInput.value);
  if (!query) {
    suggestionItems = [];
    activeSuggestionIndex = -1;
    suggestions.innerHTML = "";
    suggestions.classList.add("hidden");
    noResult.classList.add("hidden");
    return;
  }

  const { selectedGroups } = deriveGroupSelection();
  const selectedGroupIds = new Set(selectedGroups.map(group => group.id));

  const groupMatches = [...groupMap.values()].filter(group => {
    if (selectedGroupIds.has(group.id)) {
      return false;
    }
    if (!Array.isArray(group.testIds) || !group.testIds.length) {
      return false;
    }
    return groupMatchesQuery(group, query);
  });

  const testMatches = allTests.filter(test => {
    if (!test || test.id == null) {
      return false;
    }
    if (selected.has(test.id)) {
      return false;
    }
    const name = normalizeQuery(test.testName);
    const shortcut = normalizeQuery(test.shortcut);
    return name.includes(query) || shortcut.includes(query);
  });

  const combined = [
    ...groupMatches.map(group => ({
      type: "group",
      id: group.id,
      name: group.groupName || "",
      shortcut: group.shortcut || "",
      cost: resolveGroupCost(group),
      rank: rankGroupSuggestion(group, query)
    })),
    ...testMatches.map(test => ({
      type: "test",
      id: test.id,
      name: test.testName || "",
      shortcut: test.shortcut || "",
      cost: Number(test.cost) || 0,
      rank: rankSuggestion(test, query)
    }))
  ];

  combined.sort((a, b) => {
    const rankDiff = a.rank - b.rank;
    if (rankDiff !== 0) {
      return rankDiff;
    }
    return (Number(a.id) || 0) - (Number(b.id) || 0);
  });

  suggestionItems = combined.slice(0, 8);
  activeSuggestionIndex = suggestionItems.length ? 0 : -1;
  suggestions.innerHTML = "";

  suggestionItems.forEach((item, index) => {
    const shortcut = item.shortcut ? item.shortcut : "";
    const price = formatMoney(Number(item.cost) || 0);
    const activeClass = index === activeSuggestionIndex ? " active" : "";
    const meta = item.type === "group"
      ? `Group${shortcut ? " · " + shortcut : ""}`
      : shortcut;
    suggestions.innerHTML += `
      <div class="suggestion${activeClass}" data-id="${item.id}" data-type="${item.type}">
        <div class="suggestion-main">
          <div class="suggestion-name">${item.name || ""}</div>
          <div class="suggestion-meta">${meta}</div>
        </div>
        <div class="suggestion-cost">₹${price}</div>
      </div>
    `;
  });

  suggestions.classList.toggle("hidden", !suggestionItems.length);
  noResult.classList.toggle("hidden", suggestionItems.length > 0);
}

function setActiveSuggestion(index){
  if (!suggestionItems.length) {
    activeSuggestionIndex = -1;
    return;
  }
  if (index < 0) {
    activeSuggestionIndex = suggestionItems.length - 1;
  } else if (index >= suggestionItems.length) {
    activeSuggestionIndex = 0;
  } else {
    activeSuggestionIndex = index;
  }

  const items = suggestions.querySelectorAll(".suggestion");
  items.forEach((item, idx) => {
    item.classList.toggle("active", idx === activeSuggestionIndex);
  });
}

function chooseSuggestion(type, id){
  const numericId = Number(id);
  if (!numericId) {
    return;
  }
  if (type === "group") {
    addSelectedGroup(numericId);
  } else {
    addSelectedTest(numericId);
  }
  searchInput.value = "";
  updateSuggestions();
  searchInput.focus();
}

function handleSuggestionClick(event){
  const item = event.target.closest(".suggestion");
  if (!item) {
    return;
  }
  const type = item.dataset.type || "test";
  chooseSuggestion(type, item.dataset.id);
}

function handleSuggestionKeys(event){
  if (event.key === "ArrowDown") {
    if (suggestionItems.length) {
      event.preventDefault();
      setActiveSuggestion(activeSuggestionIndex + 1);
    }
    return;
  }

  if (event.key === "ArrowUp") {
    if (suggestionItems.length) {
      event.preventDefault();
      setActiveSuggestion(activeSuggestionIndex - 1);
    }
    return;
  }

  if (event.key === "Enter") {
    if (suggestionItems.length) {
      event.preventDefault();
      const active = suggestionItems[activeSuggestionIndex] || suggestionItems[0];
      if (active) {
        chooseSuggestion(active.type, active.id);
      }
    }
    return;
  }

  if (event.key === "Escape") {
    suggestions.classList.add("hidden");
    noResult.classList.add("hidden");
  }
}

/* SUBMIT */
patientForm.addEventListener("submit", e => {
  e.preventDefault();

  if (!selected.size) {
    alert("Select at least one test");
    return;
  }

  const current =
    JSON.parse(localStorage.getItem("currentPatient") || "null");
  localStorage.removeItem("prefillPatient");

  const payload = {
    name: document.getElementById("name").value.trim(),
    age: Number(document.getElementById("age").value),
    gender: document.getElementById("gender").value,
    mobile: document.getElementById("mobile").value.trim(),
    address: document.getElementById("address").value.trim(),
    doctor: document.getElementById("doctor").value || "SELF",
    visitDate: document.getElementById("visitDate").value,
    amount: parseMoney(amountInput.value),
    discount: parseMoney(discountInput.value),
    status: "NOT COMPLETE"
  };

  // ✅ EXISTING PATIENT → no save
  if (current && current.id) {
    localStorage.setItem("selectedTests", JSON.stringify([...selected]));
    parent.loadPage("home/sub-tasks/pt/enter-values.html");
    return;
  }

  // ✅ NEW PATIENT → save
  fetch(API_BASE_URL + "/patients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
  .then(res => res.json())
  .then(p => {
    localStorage.setItem("currentPatient", JSON.stringify(p));
    localStorage.setItem("selectedTests", JSON.stringify([...selected]));
    parent.loadPage("home/sub-tasks/pt/enter-values.html");
  })
  .catch(err => {
    console.error(err);
    alert("Failed to save patient");
  });
});
