if(parent?.setActiveMenu){ parent.setActiveMenu("patient"); }

const datePicker = document.getElementById("datePicker");
const searchBox  = document.getElementById("searchBox");
const doctorFilter = document.getElementById("doctorFilter");
const dateToggle = document.getElementById("dateToggle");
const searchToggle = document.getElementById("searchToggle");
const tableBody  = document.getElementById("patientTable");
const bulkBar    = document.getElementById("bulkBar");
const selectedCount = document.getElementById("selectedCount");
const newPatientBtn = document.getElementById("newPatientBtn");
const bulkDeleteBtn = document.getElementById("bulkDeleteBtn");
const bulkCancelBtn = document.getElementById("bulkCancelBtn");
const searchPager = document.getElementById("searchPager");
const searchPrevBtn = document.getElementById("searchPrevBtn");
const searchNextBtn = document.getElementById("searchNextBtn");
const searchPageInfo = document.getElementById("searchPageInfo");

let allPatients = [];
let selectMode = false;
let isAutoDate = true;
let isSearchMode = false;
let searchPage = 0;
let searchHasMore = false;
let searchController = null;

const PAGE_SIZE = 25;
let listPage = 0;
const listPager = document.getElementById("listPager");
const listPrevBtn = document.getElementById("listPrevBtn");
const listNextBtn = document.getElementById("listNextBtn");
const listPageInfo = document.getElementById("listPageInfo");
let searchRequestId = 0;

const SEARCH_PAGE_LIMIT = 50;
const DOCTOR_SELF_VALUE = "__SELF__";

const PATIENTS_DATE_KEY = "SSDC_PATIENTS_SELECTED_DATE";

function safeSessionGet(key){
  try {
    return window.sessionStorage ? window.sessionStorage.getItem(key) : null;
  } catch (e) {
    return null;
  }
}

function safeSessionSet(key, value){
  try {
    if (window.sessionStorage) {
      window.sessionStorage.setItem(key, String(value));
    }
  } catch (e) {
    // ignore
  }
}

function isBackForwardNav(){
  try {
    const nav = performance.getEntriesByType?.("navigation")?.[0];
    return nav && nav.type === "back_forward";
  } catch (e) {
    return false;
  }
}

function getLocalDateInputValue(date = new Date()) {
  if (window.getIstDateInputValue) {
    return window.getIstDateInputValue(date);
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

{
  const today = getLocalDateInputValue();
  const stored = safeSessionGet(PATIENTS_DATE_KEY);
  const canRestore = isBackForwardNav();
  datePicker.value =
    canRestore && stored && /^\d{4}-\d{2}-\d{2}$/.test(stored)
      ? stored
      : today;
  if (!canRestore) {
    safeSessionSet(PATIENTS_DATE_KEY, datePicker.value);
  }
}
loadDoctorFilterOptions();
loadByDate(datePicker.value);

function safeJson(res) {
  return res && typeof res.json === "function"
    ? res.json().catch(() => null)
    : Promise.resolve(null);
}

function setSearchPagerVisible(visible) {
  if (!searchPager) return;
  searchPager.classList.toggle("hidden", !visible);
}

function updateSearchPager() {
  const visible = isSearchMode;
  setSearchPagerVisible(visible);
  if (!visible) return;

  if (searchPageInfo) {
    searchPageInfo.textContent = `Page ${searchPage + 1}`;
  }
  if (searchPrevBtn) {
    searchPrevBtn.disabled = searchPage <= 0;
  }
  if (searchNextBtn) {
    searchNextBtn.disabled = !searchHasMore;
  }
}

function cancelSearchRequest() {
  if (searchController) {
    try { searchController.abort(); } catch (e) { /* ignore */ }
    searchController = null;
  }
}

function setDateToToday(){
  const today = getLocalDateInputValue();
  if (datePicker.value !== today) {
    datePicker.value = today;
    safeSessionSet(PATIENTS_DATE_KEY, today);
    loadByDate(today);
  }
}

let midnightTimerId = null;
function scheduleMidnightUpdate(){
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  const delay = Math.max(0, nextMidnight.getTime() - now.getTime() + 1000);
  midnightTimerId = setTimeout(() => {
    if (isAutoDate) {
      setDateToToday();
    }
    scheduleMidnightUpdate();
  }, delay);
}
window.addEventListener("beforeunload", () => {
  if (midnightTimerId) clearTimeout(midnightTimerId);
});

datePicker.onchange = () => {
  isAutoDate = datePicker.value === getLocalDateInputValue();
  safeSessionSet(PATIENTS_DATE_KEY, datePicker.value);
  loadByDate(datePicker.value);
};

scheduleMidnightUpdate();

window.addEventListener("pageshow", (event) => {
  const restore = Boolean(event?.persisted) || isBackForwardNav();
  if (restore) {
    const stored = safeSessionGet(PATIENTS_DATE_KEY);
    if (stored && /^\d{4}-\d{2}-\d{2}$/.test(stored)) {
      datePicker.value = stored;
    }
  } else {
    datePicker.value = getLocalDateInputValue();
    safeSessionSet(PATIENTS_DATE_KEY, datePicker.value);
  }
  isAutoDate = datePicker.value === getLocalDateInputValue();
  loadByDate(datePicker.value);
});

function loadByDate(date){
  cancelSearchRequest();
  isSearchMode = false;
  searchPage = 0;
  searchHasMore = false;
  updateSearchPager();

  fetch(`${API_BASE_URL}/patients/by-date/${date}`)
    .then(r=>r.json())
    .then(d=>{ allPatients=Array.isArray(d) ? d : []; renderCurrentList(allPatients); })
    .catch(()=>renderEmpty());
}

function normalizeDoctorName(value){
  const raw = String(value || "").trim();
  const normalized = raw.toUpperCase();
  if (!raw || normalized === "SELF" || normalized === "WALK-IN" || normalized === "WALK IN") {
    return "SELF";
  }
  return normalized;
}

function getSelectedDoctorKey(){
  if (!doctorFilter) return "";
  const selected = String(doctorFilter.value || "").trim();
  if (!selected) return "";
  if (selected === DOCTOR_SELF_VALUE) return "SELF";
  return normalizeDoctorName(selected);
}

function applyDoctorFilter(list){
  const items = Array.isArray(list) ? list : [];
  const selectedDoctorKey = getSelectedDoctorKey();
  if (!selectedDoctorKey) return items;
  return items.filter((patient) => normalizeDoctorName(patient?.doctor) === selectedDoctorKey);
}

function renderCurrentList(list, resetPage){
  if (resetPage !== false) listPage = 0;
  const filtered = applyDoctorFilter(list);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (listPage >= totalPages) listPage = totalPages - 1;
  const start = listPage * PAGE_SIZE;
  const page = filtered.slice(start, start + PAGE_SIZE);
  renderTable(page, start);
  updateListPager(filtered.length, totalPages);
}

function updateListPager(total, totalPages){
  if (!listPager) return;
  if (isSearchMode || total <= PAGE_SIZE) {
    listPager.classList.add("hidden");
    return;
  }
  listPager.classList.remove("hidden");
  if (listPageInfo) listPageInfo.textContent = `Page ${listPage + 1} of ${totalPages}`;
  if (listPrevBtn) listPrevBtn.disabled = listPage <= 0;
  if (listNextBtn) listNextBtn.disabled = listPage >= totalPages - 1;
}

function sortDoctorNames(names){
  return names.sort((a, b) =>
    String(a).localeCompare(String(b), "en", { sensitivity: "base" })
  );
}

async function fetchDoctorFilterNames(){
  const unique = new Map();

  try {
    const res = await fetch(`${API_BASE_URL}/accounts/doctors`);
    if (res && res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        data.forEach((doctor) => {
          const name = String(doctor?.doctorName || "").trim();
          if (!name) return;
          const key = normalizeDoctorName(name);
          if (key === "SELF") return;
          if (!unique.has(key)) unique.set(key, name);
        });
      }
    }
  } catch (e) {
    // ignore and try fallback
  }

  if (unique.size === 0) {
    try {
      const res = await fetch(`${API_BASE_URL}/doctors`);
      if (res && res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          data.forEach((doctor) => {
            const name = String(doctor?.name || "").trim();
            if (!name) return;
            const key = normalizeDoctorName(name);
            if (key === "SELF") return;
            if (!unique.has(key)) unique.set(key, name);
          });
        }
      }
    } catch (e) {
      // ignore
    }
  }

  return sortDoctorNames(Array.from(unique.values()));
}

async function loadDoctorFilterOptions(){
  if (!doctorFilter) return;
  const previous = String(doctorFilter.value || "");

  doctorFilter.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "All Doctors";
  doctorFilter.appendChild(allOption);

  const selfOption = document.createElement("option");
  selfOption.value = DOCTOR_SELF_VALUE;
  selfOption.textContent = "Self / Walk-in";
  doctorFilter.appendChild(selfOption);

  const names = await fetchDoctorFilterNames();
  names.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    doctorFilter.appendChild(option);
  });

  if (previous) {
    doctorFilter.value = previous;
  }
}

function loadSearchPage(page){
  const q = String(searchBox.value || "").trim();
  if (!q) {
    isSearchMode = false;
    searchPage = 0;
    searchHasMore = false;
    updateSearchPager();
    renderCurrentList(allPatients);
    return;
  }

  cancelSearchRequest();
  searchController = new AbortController();
  const requestId = ++searchRequestId;

  const params = new URLSearchParams();
  params.set("name", q);
  params.set("mobile", "");
  params.set("page", String(Math.max(0, page)));
  params.set("limit", String(SEARCH_PAGE_LIMIT));

  fetch(`${API_BASE_URL}/patients/search?${params.toString()}`, {
    signal: searchController.signal
  })
    .then(async (res) => {
      if (!res || !res.ok) {
        const data = await safeJson(res);
        const msg =
          (data && typeof data.message === "string" && data.message.trim())
            ? data.message.trim()
            : "Search failed";
        if (requestId === searchRequestId) {
          isSearchMode = false;
          searchPage = 0;
          searchHasMore = false;
          updateSearchPager();
          renderMessageRow(msg);
        }
        return null;
      }
      return res.json();
    })
    .then((list) => {
      if (list == null) return;
      if (requestId !== searchRequestId) return;

      const safe = Array.isArray(list) ? list : [];
      isSearchMode = true;
      searchPage = Math.max(0, page);
      searchHasMore = safe.length >= SEARCH_PAGE_LIMIT;
      updateSearchPager();
      renderCurrentList(safe);
    })
    .catch((err) => {
      if (err && err.name === "AbortError") {
        return;
      }
      console.error(err);
      if (requestId === searchRequestId) {
        renderMessageRow("Search failed. Please try again.");
      }
    });
}

function searchPatient(){
  const q = String(searchBox.value || "").trim();
  if (!q) {
    isSearchMode = false;
    searchPage = 0;
    searchHasMore = false;
    updateSearchPager();
    renderCurrentList(allPatients);
    return;
  }
  loadSearchPage(0);
}

function openDatePicker(){
  datePicker.focus();
  if (typeof datePicker.showPicker === "function") {
    datePicker.showPicker();
  }
}

function focusSearch(){
  searchBox.focus();
}

dateToggle.addEventListener("click", openDatePicker);
searchToggle.addEventListener("click", focusSearch);

// Inline handler replacements (CSP-safe)
if (searchBox) {
  searchBox.addEventListener("input", searchPatient);
}
if (doctorFilter) {
  doctorFilter.addEventListener("change", () => {
    const query = String(searchBox?.value || "").trim();
    if (query) {
      loadSearchPage(0);
      return;
    }
    renderCurrentList(allPatients);
  });
}
if (newPatientBtn) {
  newPatientBtn.addEventListener("click", () => {
    location.href = "pt/new.html";
  });
}
if (bulkDeleteBtn) {
  bulkDeleteBtn.addEventListener("click", deleteSelected);
}
if (bulkCancelBtn) {
  bulkCancelBtn.addEventListener("click", exitSelectMode);
}

function renderTable(data, startOffset){
  const snoBase = startOffset || 0;
  const D = window.ssdcDom;
  if (!D) {
    // Fallback (shouldn't happen if common/dom.js is loaded)
    tableBody.textContent = "";
  } else {
    D.clear(tableBody);
  }
  if(!data.length){ renderEmpty(); return; }

  const checkClass = selectMode ? "check-col round-left" : "check-col";
  const snoClass = selectMode ? "sno" : "sno round-left";

  const frag = document.createDocumentFragment();
  data.forEach((p,i)=>{
    const isCompleted =
      String(p?.status || "").trim().toUpperCase() === "COMPLETED";
    const statusClass =
      isCompleted ? "status is-completed" : "status is-not-completed";
    const statusText =
      String(p?.status || "").trim() || "NOT COMPLETE";

    const amount = Number(p?.amount) || 0;
    const paid = Number(p?.paid) || 0;
    const dueRaw = Math.max(0, amount - paid);
    const dueText = dueRaw > 0 ? `₹${dueRaw}` : "-";
    const dueClass = dueRaw > 0 ? "due is-due" : "due is-no-due";

    const tr = document.createElement("tr");

    // checkbox
    {
      const td = document.createElement("td");
      td.className = checkClass;
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.id = `patient-${p.id}`;
      cb.name = `patient-${p.id}`;
      cb.className = "row-check";
      try { cb.dataset.id = String(p.id); } catch (e) { /* ignore */ }
      cb.addEventListener("change", updateCount);
      td.appendChild(cb);
      tr.appendChild(td);
    }

    // sno
    {
      const td = document.createElement("td");
      td.className = snoClass;
      td.textContent = String(snoBase + i + 1);
      tr.appendChild(td);
    }

    // name
    {
      const td = document.createElement("td");
      td.className = "name";
      td.textContent = p?.name ? String(p.name) : "-";
      tr.appendChild(td);
    }

    // doctor
    {
      const td = document.createElement("td");
      td.className = "doctor";
      td.textContent = p?.doctor ? String(p.doctor) : "-";
      tr.appendChild(td);
    }

    // amount
    {
      const td = document.createElement("td");
      td.className = "amount";
      td.textContent = `₹${amount}`;
      tr.appendChild(td);
    }

    // due
    {
      const td = document.createElement("td");
      td.className = dueClass;
      td.textContent = dueText;
      tr.appendChild(td);
    }

    // status
    {
      const td = document.createElement("td");
      td.className = "status-col";
      const span = document.createElement("span");
      span.className = statusClass;
      span.textContent = statusText;
      td.appendChild(span);
      tr.appendChild(td);
    }

    // options menu
    {
      const td = document.createElement("td");
      td.className = "options";

      const menu = document.createElement("div");
      menu.className = "menu";

      const btn = document.createElement("button");
      btn.className = "menu-btn";
      btn.type = "button";
      btn.textContent = "⋮";
      btn.addEventListener("click", () => toggleMenu(p.id));

      const list = document.createElement("div");
      list.className = "menu-list";
      list.id = `menu-${p.id}`;

      const itemSelect = document.createElement("div");
      itemSelect.textContent = "Select";
      itemSelect.addEventListener("click", enterSelectMode);

      const itemEdit = document.createElement("div");
      itemEdit.textContent = "Edit";
      itemEdit.addEventListener("click", () => editPatient(p.id));

      const itemBill = document.createElement("div");
      itemBill.textContent = "Bill";
      itemBill.addEventListener("click", () => openBill(p));

      const itemDelete = document.createElement("div");
      itemDelete.className = "danger";
      itemDelete.textContent = "Delete";
      itemDelete.addEventListener("click", () => deleteOne(p.id));

      list.appendChild(itemSelect);
      list.appendChild(itemEdit);
      list.appendChild(itemBill);
      list.appendChild(itemDelete);

      menu.appendChild(btn);
      menu.appendChild(list);
      td.appendChild(menu);
      tr.appendChild(td);
    }

    frag.appendChild(tr);
  });

  tableBody.appendChild(frag);
}

function renderEmpty(){
  const D = window.ssdcDom;
  if (D) D.clear(tableBody);

  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 8;
  td.className = "no-data";
  td.textContent = "No patients found";
  tr.appendChild(td);
  tableBody.appendChild(tr);
}

function renderMessageRow(message){
  const D = window.ssdcDom;
  if (D) D.clear(tableBody);

  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 8;
  td.className = "no-data";
  td.textContent = String(message || "No data");
  tr.appendChild(td);
  tableBody.appendChild(tr);
}

if (searchPrevBtn) {
  searchPrevBtn.addEventListener("click", () => {
    if (!isSearchMode) return;
    if (searchPage <= 0) return;
    loadSearchPage(searchPage - 1);
  });
}
if (searchNextBtn) {
  searchNextBtn.addEventListener("click", () => {
    if (!isSearchMode) return;
    if (!searchHasMore) return;
    loadSearchPage(searchPage + 1);
  });
}

if (listPrevBtn) {
  listPrevBtn.addEventListener("click", () => {
    if (isSearchMode || listPage <= 0) return;
    listPage--;
    renderCurrentList(allPatients, false);
  });
}
if (listNextBtn) {
  listNextBtn.addEventListener("click", () => {
    if (isSearchMode) return;
    listPage++;
    renderCurrentList(allPatients, false);
  });
}

function closeMenus(){
  document.querySelectorAll(".menu-list")
    .forEach(m=>m.style.display="none");
  document.querySelectorAll("#patientTable tr.menu-open")
    .forEach(row => row.classList.remove("menu-open"));
  document.body.classList.remove("menu-open");
}

function toggleMenu(id){
  const m=document.getElementById(`menu-${id}`);
  const isOpen = m && m.style.display === "block";
  closeMenus();
  if (m) {
    m.style.display=isOpen?"none":"block";
    if (!isOpen) {
      const row = m.closest("tr");
      if (row) {
        row.classList.add("menu-open");
      }
      document.body.classList.add("menu-open");
    }
  }
}

document.addEventListener("click", (event) => {
  if (!event.target.closest(".menu")) {
    closeMenus();
  }
});

function enterSelectMode(){
  selectMode=true;
  document.body.classList.add("select-mode");
  bulkBar.style.display="flex";
  closeMenus();
  renderCurrentList(allPatients);
}

function exitSelectMode(){
  selectMode=false;
  document.body.classList.remove("select-mode");
  bulkBar.style.display="none";
  closeMenus();
  renderCurrentList(allPatients);
}

function updateCount(){
  const c=document.querySelectorAll(".row-check:checked").length;
  selectedCount.innerText=`${c} items selected`;
}

async function deleteOne(id){
  const ok = await window.ssdcConfirm("Delete patient and all related data?", {
    title: "Confirm Delete",
    okText: "Delete",
    okVariant: "danger"
  });
  if (!ok) return;

  fetch(`${API_BASE_URL}/patients/${id}`, {
    method: "DELETE"
  })
  .then(() => {
    loadByDate(datePicker.value);
  })
  .catch(err => {
    console.error(err);
    window.ssdcAlert("Failed to delete patient");
  });
}

async function deleteSelected(){
  const checked = document.querySelectorAll(".row-check:checked");
  if(!checked.length){
    await window.ssdcAlert("No patients selected");
    return;
  }

  const ok = await window.ssdcConfirm("Delete selected patients and all related data?", {
    title: "Confirm Bulk Delete",
    okText: "Delete",
    okVariant: "danger"
  });
  if (!ok) return;

  const ids = [...checked].map(cb => Number(cb.dataset.id));

  Promise.all(
    ids.map(id =>
      fetch(`${API_BASE_URL}/patients/${id}`, {
        method: "DELETE"
      })
    )
  )
  .then(() => {
    exitSelectMode();
    loadByDate(datePicker.value);
  })
  .catch(err => {
    console.error(err);
    window.ssdcAlert("Bulk delete failed");
  });
}

async function editPatient(id){
  const safeId = Number(id);
  if (!Number.isFinite(safeId)) {
    await window.ssdcAlert("Patient not found");
    return;
  }
  closeMenus();
  const rel = `pt/new.html?edit=${encodeURIComponent(safeId)}`;
  const abs = `home/sub-tasks/${rel}`;
  if (parent?.loadPage) {
    parent.loadPage(abs, "patient");
  } else {
    location.href = rel;
  }
}

async function openBill(patient){
  if (!patient || !patient.id) {
    await window.ssdcAlert("Patient not found");
    return;
  }
  closeMenus();
  const safeId = Number(patient.id);
  if (!Number.isFinite(safeId)) {
    await window.ssdcAlert("Patient not found");
    return;
  }
  const rel = `pt/bill.html?patientId=${encodeURIComponent(safeId)}`;
  const abs = `home/sub-tasks/${rel}`;
  if (parent?.loadPage) {
    parent.loadPage(abs, "patient");
  } else {
    location.href = rel;
  }
}
