/**
 * @typedef {{id:number,testName:string,shortcut?:string,cost?:number}} TestItem
 */

const patientForm = document.getElementById("patientForm");
const visitDate = document.getElementById("visitDate");
const doctor = document.getElementById("doctor");
const existingPatients = document.getElementById("existingPatients");
const existingPatientsPager = document.getElementById("existingPatientsPager");
const existingPrevBtn = document.getElementById("existingPrevBtn");
const existingNextBtn = document.getElementById("existingNextBtn");
const existingPageInfo = document.getElementById("existingPageInfo");
const selectedList = document.getElementById("selectedTests");
const noResult = document.getElementById("noResult");
const searchInput = document.getElementById("search");
const suggestions = document.getElementById("suggestions");
const savePatientBtn = document.getElementById("savePatientBtn");

function clearNode(node) { window.ssdcDom.clear(node); }

function appendNoResult(container, message){
  clearNode(container);
  const div = document.createElement("div");
  div.className = "no-result";
  div.textContent = message;
  container.appendChild(div);
}

function getTodayIstDateInput(){
  if (window.getIstDateInputValue) {
    return window.getIstDateInputValue(new Date());
  }
  // Fallback: local timezone.
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

visitDate.value = getTodayIstDateInput();
let isAutoVisitDate = true;
visitDate.addEventListener("change", () => {
  isAutoVisitDate = visitDate.value === getTodayIstDateInput();
});

// Keep date correct after midnight IST (fixes UTC/incorrect-device-time issues).
setInterval(() => {
  if (!isAutoVisitDate) {
    return;
  }
  const today = getTodayIstDateInput();
  if (visitDate.value !== today) {
    visitDate.value = today;
  }
}, 30 * 1000);

let selected = new Set();
let selectedRank = new Map(); // testId -> selection sequence (higher = more recent)
let selectedSeq = 0;
let testInfoMap = new Map();
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
const paidInput = document.getElementById("paid");
const dueInput = document.getElementById("due");
const billTotalValue = document.getElementById("billTotal");
const billItems = document.getElementById("billItems");
let lastPricingEdited = null; // "discount" | "payable"
let lastPaymentEdited = null; // "paid" | "due"
let isAutoBillUpdate = false;
let isSubmittingPatient = false;
let searchTimer = null;
let patientSearchController = null;
let patientSearchRequestId = 0;
let lastPatientSearchKey = "";
const PATIENT_SEARCH_DELAY_MS = 50;

const EDIT_PIN_COMPLETED = "7702";
let editingPatientId = null;
let completedEditPin = null;
let testsReadyResolve = null;
const testsReady = new Promise((resolve) => {
  testsReadyResolve = resolve;
});

function getEditPatientIdFromUrl(){
  const params = new URLSearchParams(location.search);
  const raw = params.get("edit");
  const id = raw == null ? NaN : Number(raw);
  return Number.isFinite(id) ? id : null;
}

editingPatientId = getEditPatientIdFromUrl();

function navigateToEnterValues(patientId){
  const safeId = Number(patientId);
  if (!Number.isFinite(safeId)) {
    return false;
  }
  const rel = `enter-values.html?patientId=${encodeURIComponent(safeId)}`;
  const abs = `home/sub-tasks/pt/${rel}`;
  try {
    if (parent && typeof parent.loadPage === "function") {
      parent.loadPage(abs, "patient");
      return true;
    }
  } catch (err) {
    console.error(err);
  }
  try {
    window.location.href = rel;
    return true;
  } catch (err) {
    console.error(err);
  }
  return false;
}

searchInput.addEventListener("input", updateSuggestions);
searchInput.addEventListener("keydown", handleSuggestionKeys);
suggestions.addEventListener("click", handleSuggestionClick);
selectedList.addEventListener("change", handleSelectedChange);
savePatientBtn.addEventListener("click", () => patientForm.requestSubmit());

nameInput.addEventListener("input", () => {
  applyPatientFilter();
});

mobileInput.addEventListener("input", () => {
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
  lastPricingEdited = "discount";
  updateBillFromSelection();
});

amountInput.addEventListener("input", () => {
  if (isAutoBillUpdate) {
    return;
  }
  lastPricingEdited = "payable";
  updateBillFromSelection();
});

paidInput.addEventListener("input", () => {
  if (isAutoBillUpdate) {
    return;
  }
  lastPaymentEdited = "paid";
  updateBillFromSelection();
});

dueInput.addEventListener("input", () => {
  if (isAutoBillUpdate) {
    return;
  }
  lastPaymentEdited = "due";
  updateBillFromSelection();
});


/* LOAD DOCTORS */
const doctorsReady = fetch(API_BASE_URL + "/doctors")
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
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      doctor.appendChild(opt);
    });
  })
  .catch((err) => {
    console.error(err);
  });

/* LOAD EXISTING PATIENTS (LIVE SEARCH) */
renderExistingPatients([], "idle");

const EXISTING_PATIENTS_PAGE_LIMIT = 5;
const EXISTING_PATIENTS_PAGE_FETCH = 6; // fetch 1 extra to detect "Next"
let existingPatientsQuery = { name: "", mobile: "" };
let existingPatientsPage = 0;
let existingPatientsHasMore = false;
let existingPatientsLoading = false;

function safeJson(res){
  return res && typeof res.json === "function"
    ? res.json().catch(() => null)
    : Promise.resolve(null);
}

function updateExistingPager(){
  if (!existingPatientsPager) {
    return;
  }

  const hasQuery = Boolean(existingPatientsQuery?.name || existingPatientsQuery?.mobile);
  const hasResults = existingList.length > 0;
  const shouldShow = !existingPatientsLoading && hasQuery && hasResults;

  existingPatientsPager.classList.toggle("hidden", !shouldShow);

  if (existingPageInfo) {
    existingPageInfo.textContent = `Page ${existingPatientsPage + 1}`;
  }
  if (existingPrevBtn) {
    existingPrevBtn.disabled = existingPatientsLoading || existingPatientsPage <= 0;
  }
  if (existingNextBtn) {
    existingNextBtn.disabled = existingPatientsLoading || !existingPatientsHasMore;
  }
}

function loadExistingPatientsPage(page){
  const nameQuery = existingPatientsQuery.name;
  const mobileQuery = existingPatientsQuery.mobile;
  if (!nameQuery && !mobileQuery) {
    existingPatientsPage = 0;
    existingPatientsHasMore = false;
    updateExistingPager();
    return;
  }

  if (patientSearchController) {
    patientSearchController.abort();
  }
  patientSearchController = new AbortController();
  const requestId = ++patientSearchRequestId;

  const params = new URLSearchParams();
  params.set("name", nameQuery);
  params.set("mobile", mobileQuery);
  params.set("page", String(Math.max(0, page)));
  params.set("limit", String(EXISTING_PATIENTS_PAGE_FETCH));

  existingPatientsLoading = true;
  updateExistingPager();

  fetch(`${API_BASE_URL}/patients/search?${params.toString()}`, {
    signal: patientSearchController.signal
  })
  .then(async (res) => {
    if (!res || !res.ok) {
      const data = await safeJson(res);
      // Option A: backend blocks empty searches. Also handle generic failures.
      const message =
        (data && typeof data.message === "string" && data.message.trim())
          ? data.message.trim()
          : "Enter name or mobile";
      if (requestId === patientSearchRequestId) {
        existingList.splice(0, existingList.length);
        existingPatientsLoading = false;
        existingPatientsPage = 0;
        existingPatientsHasMore = false;
        renderExistingPatients([], "idle", message);
        updateExistingPager();
      }
      return null;
    }
    return res.json();
  })
  .then((list) => {
    if (list == null) {
      return;
    }
    if (requestId !== patientSearchRequestId) {
      return;
    }
    const safe = Array.isArray(list) ? list : [];
    existingPatientsHasMore = safe.length >= EXISTING_PATIENTS_PAGE_FETCH;
    existingPatientsPage = Math.max(0, page);
    existingPatientsLoading = false;
    const shown = safe.length > EXISTING_PATIENTS_PAGE_LIMIT
      ? safe.slice(0, EXISTING_PATIENTS_PAGE_LIMIT)
      : safe;
    existingList.splice(0, existingList.length, ...shown);
    renderExistingPatients(shown);
    updateExistingPager();
  })
  .catch(err => {
    if (err && err.name === "AbortError") {
      return;
    }
    console.error(err);
    existingPatientsLoading = false;
    existingPatientsHasMore = false;
    updateExistingPager();
  });
}

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
    existingPatientsQuery = { name: "", mobile: "" };
    existingPatientsPage = 0;
    existingPatientsHasMore = false;
    existingPatientsLoading = false;
    renderExistingPatients([], "idle");
    updateExistingPager();
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

    existingPatientsQuery = { name: nameQuery, mobile: mobileQuery };
    existingPatientsPage = 0;
    existingPatientsHasMore = false;
    existingPatientsLoading = false;
    loadExistingPatientsPage(0);
  }, PATIENT_SEARCH_DELAY_MS);
}

function normalizeDigits(value){
  return String(value || "").replace(/\D/g, "");
}

function renderExistingPatients(list, mode, overrideIdleMessage){
  clearNode(existingPatients);

  if (mode === "idle") {
    appendNoResult(existingPatients, overrideIdleMessage || "Type name or mobile to search");
    return;
  }

  if (!list.length) {
    appendNoResult(existingPatients, "No matching patients");
    return;
  }

  const frag = document.createDocumentFragment();
  (list || []).forEach((p, index) => {
    const row = document.createElement("div");
    row.className = "patient-row";

    const info = document.createElement("div");
    const nameBold = document.createElement("b");
    nameBold.textContent = p?.name ? String(p.name) : "";
    info.appendChild(nameBold);
    info.appendChild(document.createElement("br"));
    info.appendChild(
      document.createTextNode(p?.mobile ? String(p.mobile) : "")
    );

    const btn = document.createElement("button");
    btn.className = "small-btn select-patient-btn";
    btn.type = "button";
    btn.textContent = "SELECT";
    try { btn.dataset.index = String(index); } catch (e) { /* ignore */ }

    row.appendChild(info);
    row.appendChild(btn);
    frag.appendChild(row);
  });

  existingPatients.appendChild(frag);
}

if (existingPrevBtn) {
  existingPrevBtn.addEventListener("click", () => {
    if (existingPatientsLoading) return;
    if (existingPatientsPage <= 0) return;
    loadExistingPatientsPage(existingPatientsPage - 1);
  });
}
if (existingNextBtn) {
  existingNextBtn.addEventListener("click", () => {
    if (existingPatientsLoading) return;
    if (!existingPatientsHasMore) return;
    loadExistingPatientsPage(existingPatientsPage + 1);
  });
}

function parseMoney(value){
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatMoney(value){
  return String(Math.round(value * 100) / 100);
}

const categoryPriority =
  window.SSDC?.utils?.categoryPriority || ((_) => 99);

function sortSelectedIdsByCategory(selectedIds){
  const ids = Array.isArray(selectedIds) ? selectedIds : [];
  const selectionIndex = new Map();
  ids.forEach((id, i) => selectionIndex.set(Number(id), i));

  return ids
    .slice()
    .sort((a, b) => {
      const aInfo = testInfoMap.get(a) || {};
      const bInfo = testInfoMap.get(b) || {};
      const ar = categoryPriority(aInfo.category);
      const br = categoryPriority(bInfo.category);
      if (ar !== br) return ar - br;
      const ai = selectionIndex.get(Number(a)) ?? Number.MAX_SAFE_INTEGER;
      const bi = selectionIndex.get(Number(b)) ?? Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return String(aInfo.name || "").localeCompare(String(bInfo.name || ""));
    });
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
      const ar = categoryPriority(a.category);
      const br = categoryPriority(b.category);
      if (ar !== br) return ar - br;
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
  clearNode(billItems);
  if (!selected.size) {
    appendNoResult(billItems, "No tests selected");
    return 0;
  }

  const { lines, baseTotal } = buildBillLines();
  if (!lines.length) {
    appendNoResult(billItems, "No tests selected");
    return 0;
  }

  const frag = document.createDocumentFragment();
  lines.forEach(line => {
    const row = document.createElement("div");
    row.className = "bill-row";

    const name = document.createElement("div");
    name.className = "bill-name";
    name.textContent = line?.label ? String(line.label) : "-";

    const amount = document.createElement("div");
    amount.className = "bill-amount";
    amount.textContent = `₹${formatMoney(Number(line?.cost) || 0)}`;

    row.appendChild(name);
    row.appendChild(amount);
    frag.appendChild(row);
  });
  billItems.appendChild(frag);

  return baseTotal;
}

function syncBillTotals(baseTotal){
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  let discount = parseMoney(discountInput.value);
  let payable = parseMoney(amountInput.value);
  let paid = parseMoney(paidInput.value);
  let due = parseMoney(dueInput.value);

  // Pricing: baseTotal <-> (discount, payable)
  if (lastPricingEdited === "discount") {
    discount = clamp(discount, 0, baseTotal);
    payable = baseTotal - discount;
  } else if (lastPricingEdited === "payable") {
    payable = clamp(payable, 0, baseTotal);
    discount = baseTotal - payable;
  } else {
    discount = 0;
    payable = baseTotal;
  }

  // Payment: payable <-> (paid, due)
  if (lastPaymentEdited === "paid") {
    paid = clamp(paid, 0, payable); // Option 1: paid cannot exceed payable
    due = payable - paid;
  } else if (lastPaymentEdited === "due") {
    due = clamp(due, 0, payable);
    paid = payable - due;
  } else {
    paid = 0;
    due = payable;
  }

  setInputValue(discountInput, formatMoney(discount));
  setInputValue(paidInput, formatMoney(paid));
  setInputValue(amountInput, formatMoney(payable));
  setInputValue(dueInput, formatMoney(due));
}

function updateBillFromSelection(){
  const baseTotal = renderBillItems();
  if (billTotalValue) {
    billTotalValue.textContent = `₹${formatMoney(baseTotal)}`;
  }
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
  lastPricingEdited = null;
  lastPaymentEdited = null;
  setInputValue(discountInput, "");
  setInputValue(paidInput, "");
  setInputValue(amountInput, "");
  setInputValue(dueInput, "");
  updateBillFromSelection();

  applyPatientFilter();
}
/* TEST LIST */

Promise.all([
  fetch(API_BASE_URL + "/tests/active").then(r => r.json()),
  fetch(API_BASE_URL + "/groups").then(r => r.json()).catch(() => [])
])
.then(([testList, groupList]) => {
  initTests(testList, groupList);
})
.catch((err) => {
  console.error(err);
  initTests([], []);
  if (window.ssdcAlert) {
    window.ssdcAlert("Failed to load tests. Please refresh.", { title: "Error" });
  }
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
      category: test.category || "",
      cost: Number(test.cost) || 0
    });
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

  if (typeof testsReadyResolve === "function") {
    testsReadyResolve();
    testsReadyResolve = null;
  }
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
  selectedRank.set(id, ++selectedSeq);
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
      selectedRank.set(id, ++selectedSeq);
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
  selectedRank.delete(id);
  renderSelectedList();
  updateBillFromSelection();
  updateSuggestions();
}

function getOrderedSelectedIds(){
  return [...selected]
    .map(id => ({
      id,
      category: testInfoMap.get(id)?.category,
      rank: selectedRank.get(id) ?? 0
    }))
    .sort((a, b) => {
      const ar = categoryPriority(a.category);
      const br = categoryPriority(b.category);
      if (ar !== br) return ar - br;
      // Selected priority: first-selected comes first (older first).
      return (a.rank ?? 0) - (b.rank ?? 0);
    })
    .map(item => item.id);
}

function saveSelectedTestsToDb(patientId, orderedIds, editPin){
  const safePatientId = Number(patientId);
  const ids = Array.isArray(orderedIds) ? orderedIds : [];
  if (!Number.isFinite(safePatientId) || !ids.length) {
    return Promise.resolve();
  }
  const payload = ids.map(id => ({
    patientId: safePatientId,
    testId: Number(id)
  }));
  const headers = { "Content-Type": "application/json" };
  if (editPin) {
    headers["X-Edit-Pin"] = editPin;
  }
  return fetch(API_BASE_URL + "/patient-tests/select", {
    method: "POST",
    headers: headers,
    body: JSON.stringify(payload)
  }).then(() => {}).catch(() => {});
}

function renderSelectedList(){
  clearNode(selectedList);
  if (!selected.size) {
    appendNoResult(selectedList, "No tests selected");
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
      const ar = categoryPriority(a.category);
      const br = categoryPriority(b.category);
      if (ar !== br) return ar - br;
      const aRank = selectedRank.get(a.id) ?? 0;
      const bRank = selectedRank.get(b.id) ?? 0;
      // Selected priority: first-selected comes first (older first).
      return aRank - bRank;
    });

  if (!groupRows.length && !testRows.length) {
    appendNoResult(selectedList, "No tests selected");
    return;
  }

  const frag = document.createDocumentFragment();

  groupRows.forEach(group => {
    const shortcutText = group.shortcut ? ` (${group.shortcut})` : "";
    const cost = resolveGroupCost(group);
    {
      const wrap = document.createElement("div");
      wrap.className = "selected-item group-item";

      const label = document.createElement("label");
      const cb = document.createElement("input");
      cb.className = "selected-checkbox";
      cb.type = "checkbox";
      cb.checked = true;
      cb.value = String(group.id);
      try { cb.dataset.type = "group"; } catch (e) { /* ignore */ }

      label.appendChild(cb);
      label.appendChild(
        document.createTextNode(
          ` ${group.groupName || "Group"}${shortcutText}`
        )
      );

      const costDiv = document.createElement("div");
      costDiv.className = "selected-cost";
      costDiv.textContent = `₹${formatMoney(cost)}`;

      wrap.appendChild(label);
      wrap.appendChild(costDiv);
      frag.appendChild(wrap);
    }

    (group.testIds || [])
      .map(id => ({ id, ...(testInfoMap.get(id) || {}) }))
      .filter(item => item && item.name)
      .forEach(item => {
        const itemShortcut = item.shortcut ? ` (${item.shortcut})` : "";
        const wrap = document.createElement("div");
        wrap.className = "selected-item group-test";

        const label = document.createElement("label");
        const cb = document.createElement("input");
        cb.className = "selected-checkbox";
        cb.type = "checkbox";
        cb.checked = true;
        cb.value = String(item.id);
        try { cb.dataset.type = "test"; } catch (e) { /* ignore */ }

        label.appendChild(cb);
        label.appendChild(
          document.createTextNode(` ${item.name}${itemShortcut}`)
        );

        const costDiv = document.createElement("div");
        costDiv.className = "selected-cost";
        costDiv.textContent = `₹${formatMoney(Number(item.cost) || 0)}`;

        wrap.appendChild(label);
        wrap.appendChild(costDiv);
        frag.appendChild(wrap);
      });
  });

  testRows.forEach(item => {
    const shortcut = item.shortcut ? ` (${item.shortcut})` : "";
    const wrap = document.createElement("div");
    wrap.className = "selected-item";

    const label = document.createElement("label");
    const cb = document.createElement("input");
    cb.className = "selected-checkbox";
    cb.type = "checkbox";
    cb.checked = true;
    cb.value = String(item.id);
    try { cb.dataset.type = "test"; } catch (e) { /* ignore */ }

    label.appendChild(cb);
    label.appendChild(document.createTextNode(` ${item.name}${shortcut}`));

    const costDiv = document.createElement("div");
    costDiv.className = "selected-cost";
    costDiv.textContent = `₹${formatMoney(Number(item.cost) || 0)}`;

    wrap.appendChild(label);
    wrap.appendChild(costDiv);
    frag.appendChild(wrap);
  });

  selectedList.appendChild(frag);
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
        group.testIds.forEach(testId => {
          selected.delete(testId);
          selectedRank.delete(testId);
        });
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
    clearNode(suggestions);
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
  clearNode(suggestions);

  const frag = document.createDocumentFragment();
  suggestionItems.forEach((item, index) => {
    const shortcut = item.shortcut ? item.shortcut : "";
    const price = formatMoney(Number(item.cost) || 0);
    const activeClass = index === activeSuggestionIndex ? " active" : "";
    const meta = item.type === "group"
      ? `Group${shortcut ? " · " + shortcut : ""}`
      : shortcut;

    const wrap = document.createElement("div");
    wrap.className = `suggestion${activeClass}`;
    try {
      wrap.dataset.id = String(item.id);
      wrap.dataset.type = String(item.type);
    } catch (e) {
      // ignore
    }

    const main = document.createElement("div");
    main.className = "suggestion-main";

    const name = document.createElement("div");
    name.className = "suggestion-name";
    name.textContent = item.name ? String(item.name) : "";

    const metaDiv = document.createElement("div");
    metaDiv.className = "suggestion-meta";
    metaDiv.textContent = meta;

    main.appendChild(name);
    main.appendChild(metaDiv);

    const cost = document.createElement("div");
    cost.className = "suggestion-cost";
    cost.textContent = `₹${price}`;

    wrap.appendChild(main);
    wrap.appendChild(cost);
    frag.appendChild(wrap);
  });

  suggestions.appendChild(frag);
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

  if (isSubmittingPatient) {
    return;
  }

  if (!selected.size) {
    window.ssdcAlert("Select at least one test");
    return;
  }

  isSubmittingPatient = true;
  if (savePatientBtn) {
    savePatientBtn.disabled = true;
  }

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
    paid: parseMoney(paidInput.value)
  };

  const orderedIds = getOrderedSelectedIds();
  const headers = { "Content-Type": "application/json" };
  if (completedEditPin) {
    headers["X-Edit-Pin"] = completedEditPin;
  }

  const openResults = (patientId) => {
    const ok = navigateToEnterValues(patientId);
    if (!ok) {
      window.ssdcAlert("Failed to open results page");
      isSubmittingPatient = false;
      if (savePatientBtn) {
        savePatientBtn.disabled = false;
      }
    }
  };

  // ✅ EDIT PATIENT
  if (editingPatientId) {
    fetch(`${API_BASE_URL}/patients/${editingPatientId}`, {
      method: "PUT",
      headers: headers,
      body: JSON.stringify(payload)
    })
    .then(async (res) => {
      const text = await res.text().catch(() => "");
      if (!res.ok) {
        throw new Error(text || "Failed to update patient");
      }
      return text ? JSON.parse(text) : null;
    })
    .then(() => {
      return saveSelectedTestsToDb(editingPatientId, orderedIds, completedEditPin);
    })
    .then(() => {
      openResults(editingPatientId);
    })
    .catch(err => {
      console.error(err);
      window.ssdcAlert(err?.message || "Failed to update patient");
      isSubmittingPatient = false;
      if (savePatientBtn) {
        savePatientBtn.disabled = false;
      }
    });
    return;
  }

  // ✅ NEW PATIENT
  fetch(API_BASE_URL + "/patients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      status: "NOT COMPLETE"
    })
  })
  .then(async (res) => {
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      throw new Error(text || "Failed to save patient");
    }
    return text ? JSON.parse(text) : null;
  })
  .then(p => {
    if (!p || !p.id) {
      throw new Error("Failed to save patient");
    }
    return saveSelectedTestsToDb(p.id, orderedIds, null).then(() => p.id);
  })
  .then((patientId) => {
    openResults(patientId);
  })
  .catch(err => {
    console.error(err);
    window.ssdcAlert(err?.message || "Failed to save patient");
    isSubmittingPatient = false;
    if (savePatientBtn) {
      savePatientBtn.disabled = false;
    }
  });
});

function navigateToPatients(){
  try {
    if (parent && typeof parent.loadPage === "function") {
      parent.loadPage("home/sub-tasks/2-patient.html", "patient");
      return true;
    }
  } catch (err) {
    console.error(err);
  }
  try {
    window.location.href = "../2-patient.html";
    return true;
  } catch (err) {
    console.error(err);
  }
  return false;
}

function isCompletedStatus(status){
  return String(status || "").trim().toUpperCase() === "COMPLETED";
}

function normalizeEditPin(value){
  return String(value == null ? "" : value).trim();
}

async function reopenCompletedPatientForEdit(patientId, editPin) {
  const safeId = Number(patientId);
  if (!Number.isFinite(safeId)) {
    throw new Error("Patient ID missing");
  }

  const res = await fetch(`${API_BASE_URL}/patients/${safeId}/status`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Edit-Pin": String(editPin || "").trim()
    },
    body: JSON.stringify({ status: "NOT COMPLETE" })
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(text || "Failed to unlock patient");
  }
  return text ? JSON.parse(text) : null;
}

async function ensureCompletedEditPin(patient){
  if (!isCompletedStatus(patient?.status)) {
    completedEditPin = null;
    return true;
  }

  const pin = await window.ssdcPrompt("Report is COMPLETED. Enter PIN to edit.", {
    title: "PIN Required",
    inputType: "password",
    inputPlaceholder: "Enter PIN"
  });

  if (pin == null) {
    return false;
  }

  const normalized = normalizeEditPin(pin);
  if (normalized !== EDIT_PIN_COMPLETED) {
    await window.ssdcAlert("Wrong PIN", { title: "Locked" });
    return false;
  }

  // Unlock permanently by reopening the report in DB (COMPLETED -> NOT COMPLETE).
  try {
    const updated = await reopenCompletedPatientForEdit(patient?.id || editingPatientId, normalized);
    if (patient && typeof patient === "object") {
      patient.status = updated?.status || "NOT COMPLETE";
    }
  } catch (err) {
    console.error(err);
    await window.ssdcAlert(err?.message || "Failed to unlock patient", { title: "Error" });
    return false;
  }

  completedEditPin = null;
  return true;
}

function fetchJsonOrThrow(res){
  if (!res) {
    return Promise.reject(new Error("Server error"));
  }
  return res.text()
    .catch(() => "")
    .then((text) => {
      if (!res.ok) {
        throw new Error(text || "Request failed");
      }
      return text ? JSON.parse(text) : null;
    });
}

function loadPatientById(patientId){
  const safeId = Number(patientId);
  if (!Number.isFinite(safeId)) {
    return Promise.reject(new Error("Patient ID missing"));
  }
  return fetch(`${API_BASE_URL}/patients/${safeId}`)
    .then(fetchJsonOrThrow);
}

function loadSelectedTestIds(patientId){
  const safeId = Number(patientId);
  if (!Number.isFinite(safeId)) {
    return Promise.resolve([]);
  }
  return fetch(`${API_BASE_URL}/patient-tests/${safeId}`)
    .then(r => r.json())
    .then(list => (list || [])
      .map(x => Number(x && x.testId))
      .filter(n => Number.isFinite(n) && n > 0))
    .catch(() => []);
}

function setSelectedIds(ids){
  selected.clear();
  selectedRank.clear();
  selectedSeq = 0;

  const list = Array.isArray(ids) ? ids : [];
  list.forEach((raw) => {
    const id = Number(raw);
    if (!Number.isFinite(id) || !testInfoMap.has(id)) {
      return;
    }
    selected.add(id);
    selectedRank.set(id, ++selectedSeq);
  });

  renderSelectedList();
  updateBillFromSelection();
  updateSuggestions();
}

function applyPatientToForm(patient){
  if (!patient) {
    return;
  }

  const visit = String(patient.visitDate || "").trim();
  if (visit) {
    visitDate.value = visit;
    isAutoVisitDate = false;
  }

  document.getElementById("name").value = patient.name || "";
  document.getElementById("age").value = patient.age || "";
  document.getElementById("gender").value = patient.gender || "Male";
  document.getElementById("mobile").value = patient.mobile || "";
  document.getElementById("address").value = patient.address || "";
  {
    const doctorSelect = document.getElementById("doctor");
    const doctorName = String(patient.doctor || "").trim();
    if (!doctorSelect) {
      // ignore
    } else if (!doctorName || doctorName.toUpperCase() === "SELF") {
      doctorSelect.value = "";
    } else {
      doctorSelect.value = doctorName;
      if (doctorSelect.value !== doctorName) {
        const opt = document.createElement("option");
        opt.value = doctorName;
        opt.textContent = doctorName;
        doctorSelect.appendChild(opt);
        doctorSelect.value = doctorName;
      }
    }
  }

  const payable = Number(patient.amount) || 0;
  const discount = Number(patient.discount) || 0;
  const paid = Number(patient.paid) || 0;

  lastPricingEdited = "payable";
  lastPaymentEdited = "paid";
  setInputValue(amountInput, formatMoney(payable));
  setInputValue(discountInput, formatMoney(discount));
  setInputValue(paidInput, formatMoney(paid));
  setInputValue(dueInput, formatMoney(Math.max(0, payable - paid)));
}

async function initEditMode(){
  if (!editingPatientId) {
    return;
  }

  if (savePatientBtn) {
    savePatientBtn.textContent = "UPDATE PATIENT & ENTER RESULTS";
  }
  const title = document.querySelector(".wrapper .neo-card h3");
  if (title) {
    title.textContent = "Edit Patient Registration";
  }

  try {
    const patient = await loadPatientById(editingPatientId);
    const ok = await ensureCompletedEditPin(patient);
    if (!ok) {
      navigateToPatients();
      return;
    }

    await doctorsReady;
    applyPatientToForm(patient);

    await testsReady;
    const ids = await loadSelectedTestIds(editingPatientId);
    setSelectedIds(ids);
  } catch (err) {
    console.error(err);
    await window.ssdcAlert(err?.message || "Failed to load patient", { title: "Error" });
    navigateToPatients();
  }
}

initEditMode();
