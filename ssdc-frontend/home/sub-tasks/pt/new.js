/**
 * @typedef {{id:number,testName:string,shortcut?:string,price?:number}} TestItem
 */

const patientForm = document.getElementById("patientForm");
const visitDate = document.getElementById("visitDate");
const doctor = document.getElementById("doctor");
const labToggle = document.getElementById("labToggle");
const labNameWrap = document.getElementById("labNameWrap");
const labNameInput = document.getElementById("labName");
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
let allPatients = [];
let selectedPatient = null;
let doctorsById = new Map();
const nameInput = document.getElementById("name");
const mobileInput = document.getElementById("mobile");
const amountInput = document.getElementById("amount");
const discountInput = document.getElementById("discount");
const paidInput = document.getElementById("paid");
const dueInput = document.getElementById("due");
const billItems = document.getElementById("billItems");
let lastBillEdited = null;
let isAutoBillUpdate = false;
let searchTimer = null;

searchInput.addEventListener("input", updateSuggestions);
searchInput.addEventListener("keydown", handleSuggestionKeys);
suggestions.addEventListener("click", handleSuggestionClick);
selectedList.addEventListener("change", handleSelectedChange);
savePatientBtn.addEventListener("click", () => patientForm.requestSubmit());

if (labToggle && labNameWrap) {
  labToggle.addEventListener("change", () => {
    const isChecked = labToggle.checked;
    labNameWrap.classList.toggle("hidden", !isChecked);
    if (!isChecked && labNameInput) {
      labNameInput.value = "";
    }
  });
}

nameInput.addEventListener("input", () => {
  selectedPatient = null;
  localStorage.removeItem("currentVisit");
  applyPatientFilter();
});

mobileInput.addEventListener("input", () => {
  selectedPatient = null;
  localStorage.removeItem("currentVisit");
  applyPatientFilter();
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

paidInput.addEventListener("input", () => {
  if (isAutoBillUpdate) {
    return;
  }
  syncDue(parseMoney(amountInput.value));
});


/* LOAD DOCTORS */
apiList("doctors?size=1000")
  .then(list => {
    doctorsById = new Map();
    doctor.innerHTML = `<option value="">SELF</option>`;
    (list || []).forEach(x => {
      if (!x || x.id == null) {
        return;
      }
      const name = String(x.displayName || x.name || "").trim();
      if (!name) {
        return;
      }
      doctorsById.set(Number(x.id), x);
      doctor.innerHTML += `<option value="${x.id}">${name}</option>`;
    });
  })
  .catch(() => {});

/* LOAD EXISTING PATIENTS */
loadPatients();

function renderExistingPatients(list){
  existingPatients.innerHTML = "";
  if (!list.length) {
    existingPatients.innerHTML = `<div class="no-result">No matching patients</div>`;
    return;
  }

  list.forEach(p=>{
    existingPatients.innerHTML+=`
    <div class="patient-row">
      <div><b>${p.name}</b><br>${p.mobile}</div>
      <button class="small-btn" onclick='selectPatient(${JSON.stringify(p)})'>SELECT</button>
    </div>`;
  });
}

function loadPatients(){
  apiList("patients?size=1000")
    .then(list => {
      allPatients = Array.isArray(list) ? list : [];
      applyPatientFilter();
    })
    .catch(() => {
      allPatients = [];
      applyPatientFilter();
    });
}

function applyPatientFilter(){
  const nameQuery = String(nameInput.value || "").trim().toLowerCase();
  const mobileQuery = normalizeDigits(mobileInput.value.trim());

  if (searchTimer) {
    clearTimeout(searchTimer);
  }

  searchTimer = setTimeout(() => {
    const filtered = allPatients.filter(p => {
      const name = String(p?.name || "").toLowerCase();
      const mobile = normalizeDigits(p?.mobile || "");
      const nameMatch = !nameQuery || name.includes(nameQuery);
      const mobileMatch = !mobileQuery || mobile.includes(mobileQuery);
      return nameMatch && mobileMatch;
    });
    existingList.splice(0, existingList.length, ...filtered);
    renderExistingPatients(filtered);
  }, 150);
}

function normalizeDigits(value){
  return String(value || "").replace(/\D/g, "");
}

function toSexEnum(value){
  const raw = String(value || "").trim().toLowerCase();
  if (raw.startsWith("male")) {
    return "MALE";
  }
  if (raw.startsWith("female")) {
    return "FEMALE";
  }
  return "OTHER";
}

function fromSexEnum(value){
  const raw = String(value || "").trim().toUpperCase();
  if (raw === "MALE") {
    return "Male";
  }
  if (raw === "FEMALE") {
    return "Female";
  }
  return "Other";
}

function parseMoney(value){
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatMoney(value){
  return String(Math.round(value * 100) / 100);
}

function resolveGroupCost(group){
  const cost = Number(group.price);
  if (Number.isFinite(cost)) {
    return cost;
  }
  let sum = 0;
  (group.testIds || []).forEach(id => {
    const testInfo = testInfoMap.get(id);
    sum += Number(testInfo?.price) || 0;
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
    const cost = Number(item.price) || 0;
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
  const hasDiscountInput = discountInput.value.trim() !== "";
  const hasTotalInput = amountInput.value.trim() !== "";

  if (lastBillEdited === "discount") {
    total = baseTotal - discount;
  } else if (lastBillEdited === "total") {
    discount = baseTotal - total;
  } else if (hasDiscountInput && !hasTotalInput) {
    // If discount is filled, derive total from it.
    total = baseTotal - discount;
  } else if (hasTotalInput && !hasDiscountInput) {
    // If total is filled, derive discount from it.
    discount = baseTotal - total;
  } else {
    discount = 0;
    total = baseTotal;
  }

  setInputValue(discountInput, formatMoney(discount));
  setInputValue(amountInput, formatMoney(total));
  return total;
}

function updateBillFromSelection(){
  const baseTotal = renderBillItems();
  const total = syncBillTotals(baseTotal);
  syncDue(total);
}

function syncDue(totalValue){
  const paidRaw = paidInput.value.trim();
  const paid = parseMoney(paidRaw);
  const hasPaid = paidRaw !== "";
  const due = hasPaid ? (totalValue - paid) : totalValue;
  setInputValue(dueInput, formatMoney(due));
}

/* ✅ FIXED */
function selectPatient(p){
  selectedPatient = p || null;
  document.getElementById("name").value    = p.name || "";
  document.getElementById("age").value     = p.age || "";
  document.getElementById("gender").value  = fromSexEnum(p.sex);
  document.getElementById("mobile").value  = p.mobile || "";
  document.getElementById("address").value = p.address || "";
  document.getElementById("doctor").value  = "";
  lastBillEdited = null;
  setInputValue(discountInput, "");
  setInputValue(amountInput, "");
  setInputValue(paidInput, "");
  setInputValue(dueInput, "");
  updateBillFromSelection();

  // Prefill only; keep visits separate
  localStorage.setItem("prefillPatient", JSON.stringify(p));
  localStorage.removeItem("currentVisit");
  localStorage.removeItem("patientResults");
  localStorage.removeItem("selectedTests");
  applyPatientFilter();
}
/* TEST LIST */

Promise.all([
  apiList("tests?size=1000"),
  apiList("tests/groups?size=1000").catch(() => [])
])
.then(([testList, groupList]) => initTests(testList, groupList));

/** @param {TestItem[]} list */
function initTests(list, groupList){
  const tests = (Array.isArray(list) ? list : [])
    .filter(test => test && test.isActive !== false);
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
      price: Number(test.price) || 0
    });
    if (!testOrderMap.has(test.id)) {
      testOrderMap.set(test.id, testOrderCounter++);
    }
  });

  groups
    .filter(group => group)
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
            <div class="selected-cost">₹${formatMoney(Number(item.price) || 0)}</div>
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
        <div class="selected-cost">₹${formatMoney(Number(item.price) || 0)}</div>
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
      cost: Number(test.price) || 0,
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
    const price = formatMoney(Number(item.price) || 0);
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
patientForm.addEventListener("submit", async e => {
  e.preventDefault();

  if (!selected.size) {
    alert("Select at least one test");
    return;
  }

  localStorage.removeItem("prefillPatient");

  const name = document.getElementById("name").value.trim();
  const ageValue = Number(document.getElementById("age").value);
  const sexValue = toSexEnum(document.getElementById("gender").value);
  const mobile = document.getElementById("mobile").value.trim();
  const address = document.getElementById("address").value.trim();
  const doctorIdRaw = document.getElementById("doctor").value;
  const doctorId = doctorIdRaw ? Number(doctorIdRaw) : null;
  const visitDateRaw = document.getElementById("visitDate").value;
  const visitDate = visitDateRaw ? `${visitDateRaw}T00:00:00` : new Date().toISOString();
  const discountAmount = parseMoney(discountInput.value);
  const paidAmount = parseMoney(paidInput.value);
  const labName = labToggle && labToggle.checked
    ? String(labNameInput?.value || "").trim()
    : "";

  let patientId = selectedPatient && selectedPatient.id ? selectedPatient.id : null;

  try {
    if (!patientId) {
      const patientPayload = {
        patientCode: `P-${Date.now()}`,
        name,
        age: Number.isFinite(ageValue) ? ageValue : 0,
        sex: sexValue,
        mobile,
        address
      };
      const createdPatient = await apiFetchJson("patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patientPayload)
      });
      patientId = createdPatient.id;
    }

    const visitPayload = {
      patientId,
      doctorId: doctorId || null,
      visitDate,
      labName: labName || null,
      discountAmount,
      paidAmount,
      status: "REGISTERED"
    };

    const visit = await apiFetchJson("visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(visitPayload)
    });

    const testIds = [...selected];
    const createRequests = testIds.map(testId => {
      const testInfo = testInfoMap.get(testId) || {};
      const payload = {
        visitId: visit.id,
        testId: testId,
        priceAtTime: Number(testInfo.price) || 0
      };
      return apiFetchJson("visits/patient-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).catch(() => null);
    });

    await Promise.all(createRequests);

    const doctorInfo = doctorId ? doctorsById.get(doctorId) : null;
    const currentVisit = {
      visitId: visit.id,
      patientId,
      doctorId,
      name,
      age: Number.isFinite(ageValue) ? ageValue : 0,
      sex: sexValue,
      mobile,
      address,
      doctorName: doctorInfo?.displayName || doctorInfo?.name || "SELF",
      labName: labName || "",
      visitDate: visit.visitDate || visitDate,
      discountAmount,
      paidAmount,
      status: visit.status || "REGISTERED"
    };

    localStorage.setItem("currentVisit", JSON.stringify(currentVisit));
    localStorage.setItem("selectedTests", JSON.stringify(testIds));
    if (parent?.loadPage) {
      parent.loadPage("home/sub-tasks/pt/enter-values.html", "patient");
    } else {
      window.location.href = "enter-values.html";
    }
  } catch (err) {
    console.error(err);
    alert("Failed to save visit");
  }
});
