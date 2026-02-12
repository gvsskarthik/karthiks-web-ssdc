const reportDate = document.getElementById("reportDate");
const table = document.getElementById("reportTable");
const searchBox = document.getElementById("searchBox");
const dateToggle = document.getElementById("dateToggle");
const searchToggle = document.getElementById("searchToggle");
let isAutoDate = true;
let allPatients = [];

const REPORT_DATE_KEY = "SSDC_REPORTS_SELECTED_DATE";

function clearNode(node){
  if (!node) return;
  while (node.firstChild) {
    node.removeChild(node.firstChild);
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

function getLocalDateInputValue(date = new Date()) {
  if (window.getIstDateInputValue) {
    return window.getIstDateInputValue(date);
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function setDateToToday(){
  const today = getLocalDateInputValue();
  if (reportDate.value !== today) {
    reportDate.value = today;
    safeSessionSet(REPORT_DATE_KEY, today);
    loadByDate(today);
  }
}

function scheduleMidnightUpdate(){
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  const delay = Math.max(0, nextMidnight.getTime() - now.getTime() + 1000);
  setTimeout(() => {
    if (isAutoDate) {
      setDateToToday();
    }
    scheduleMidnightUpdate();
  }, delay);
}

{
  const today = getLocalDateInputValue();
  const stored = safeSessionGet(REPORT_DATE_KEY);
  const canRestore = isBackForwardNav();
  reportDate.value =
    canRestore && stored && /^\d{4}-\d{2}-\d{2}$/.test(stored)
      ? stored
      : today;
  // If this is a normal navigation (menu click / fresh load), reset to today.
  if (!canRestore) {
    safeSessionSet(REPORT_DATE_KEY, reportDate.value);
  }
}
loadByDate(reportDate.value);

reportDate.addEventListener("change", () => {
  isAutoDate = reportDate.value === getLocalDateInputValue();
  safeSessionSet(REPORT_DATE_KEY, reportDate.value);
  loadByDate(reportDate.value);
});

scheduleMidnightUpdate();

// When user clicks "View" and then presses browser Back, many browsers restore
// this page from bfcache without re-running scripts. Refresh data on show.
window.addEventListener("pageshow", (event) => {
  const restore = Boolean(event?.persisted) || isBackForwardNav();
  if (restore) {
    const stored = safeSessionGet(REPORT_DATE_KEY);
    if (stored && /^\d{4}-\d{2}-\d{2}$/.test(stored)) {
      reportDate.value = stored;
    }
  } else {
    reportDate.value = getLocalDateInputValue();
    safeSessionSet(REPORT_DATE_KEY, reportDate.value);
  }
  isAutoDate = reportDate.value === getLocalDateInputValue();
  loadByDate(reportDate.value);
});

function loadByDate(date){
  fetch(`${API_BASE_URL}/patients/by-date/${date}`)
    .then(res=>res.json())
    .then(data=>{
      allPatients = Array.isArray(data) ? data : [];
      refreshTable();
    })
    .catch(()=>{
      allPatients = [];
      renderEmpty("No data");
    });
}

function renderEmpty(message){
  clearNode(table);
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 5;
  td.className = "no-data";
  td.textContent = message || "No data";
  tr.appendChild(td);
  table.appendChild(tr);
}

function matchesPatient(patient, query){
  if (!patient) {
    return false;
  }
  const q = (query || "").trim().toLowerCase();
  if (!q) {
    return true;
  }
  const name = String(patient.name || "").toLowerCase();
  const mobile = String(patient.mobile || "");
  const doctor = String(patient.doctor || "").toLowerCase();
  return name.includes(q) || mobile.includes(q) || doctor.includes(q);
}

function refreshTable(){
  const query = searchBox ? searchBox.value : "";
  const filtered =
    (allPatients || []).filter(p => matchesPatient(p, query));
  renderTable(filtered);
}

function renderTable(data){
  clearNode(table);

  if(!data || data.length===0){
    renderEmpty("No patients found");
    return;
  }

  const frag = document.createDocumentFragment();
  data.forEach((p,i)=>{
    const isCompleted =
      String(p?.status || "").trim().toUpperCase() === "COMPLETED";
    const statusClass =
      isCompleted ? "status is-completed" : "status is-not-completed";
    const statusText =
      String(p?.status || "").trim() || "NOT COMPLETE";

    const tr = document.createElement("tr");

    const tdSno = document.createElement("td");
    tdSno.className = "sno";
    tdSno.textContent = String(i + 1);

    const tdName = document.createElement("td");
    tdName.className = "name";
    const link = document.createElement("a");
    link.className = "patient-link";
    link.href = "#";
    link.textContent = p?.name ? String(p.name) : "-";
    link.addEventListener("click", (e) => {
      e.preventDefault();
      openPatient(p);
    });
    tdName.appendChild(link);

    const tdDoctor = document.createElement("td");
    tdDoctor.className = "doctor";
    tdDoctor.textContent = p?.doctor ? String(p.doctor) : "SELF";

    const tdStatus = document.createElement("td");
    tdStatus.className = "status-col";
    const span = document.createElement("span");
    span.className = statusClass;
    span.textContent = statusText;
    tdStatus.appendChild(span);

    const tdAction = document.createElement("td");
    tdAction.className = "action-col";
    const btn = document.createElement("span");
    btn.className = "action-btn";
    btn.textContent = "View";
    btn.addEventListener("click", () => openReport(p));
    tdAction.appendChild(btn);

    tr.appendChild(tdSno);
    tr.appendChild(tdName);
    tr.appendChild(tdDoctor);
    tr.appendChild(tdStatus);
    tr.appendChild(tdAction);
    frag.appendChild(tr);
  });

  table.appendChild(frag);
}

/* ✅ ENTER VALUES PAGE */
/* ENTER VALUES */
async function openPatient(patient){
  safeSessionSet(REPORT_DATE_KEY, reportDate.value);
  const patientId = Number(patient?.id);
  if (!Number.isFinite(patientId)) {
    await window.ssdcAlert("Patient not found");
    return;
  }

  if (String(patient?.status || "").trim().toUpperCase() === "COMPLETED") {
    await window.ssdcAlert("Report is COMPLETED. PIN is required to edit.", { title: "Locked" });
  }

  parent.loadPage(
    `home/sub-tasks/pt/enter-values.html?patientId=${encodeURIComponent(patientId)}`,
    "reports"
  );
}

/* FINAL REPORT */
function openReport(patient){
  safeSessionSet(REPORT_DATE_KEY, reportDate.value);
  const patientId = Number(patient?.id);
  if (!Number.isFinite(patientId)) {
    window.ssdcAlert("Patient not found");
    return;
  }

  parent.loadPage(
    `home/sub-tasks/pt/reports.html?patientId=${encodeURIComponent(patientId)}`,
    "reports"
  );
}

function openDatePicker(){
  reportDate.focus();
  if (typeof reportDate.showPicker === "function") {
    reportDate.showPicker();
  }
}

function focusSearch(){
  if (searchBox) {
    searchBox.focus();
  }
}

if (dateToggle) {
  dateToggle.addEventListener("click", openDatePicker);
}
if (searchToggle) {
  searchToggle.addEventListener("click", focusSearch);
}
if (searchBox) {
  searchBox.addEventListener("input", refreshTable);
}
