const reportDate = document.getElementById("reportDate");
const table = document.getElementById("reportTable");
const searchBox = document.getElementById("searchBox");
const dateToggle = document.getElementById("dateToggle");
const searchToggle = document.getElementById("searchToggle");
let isAutoDate = true;
let allPatients = [];

const REPORT_DATE_KEY = "SSDC_REPORTS_SELECTED_DATE";

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
      table.innerHTML =
        `<tr><td colspan="5" class="no-data">No data</td></tr>`;
    });
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
  table.innerHTML = "";

  if(!data || data.length===0){
    table.innerHTML =
      `<tr><td colspan="5" class="no-data">No patients found</td></tr>`;
    return;
  }

  data.forEach((p,i)=>{
    table.innerHTML += `
      <tr>
        <td class="sno">${i+1}</td>

        <!-- ENTER VALUES -->
        <td class="name">
          <a class="patient-link" href="#"
             onclick='openPatient(${JSON.stringify(p)})'>
            ${p.name || "-"}
          </a>
        </td>

        <td class="doctor">${p.doctor || "SELF"}</td>
        <td class="status-col"><span class="status">${p.status}</span></td>

        <!-- VIEW FINAL REPORT -->
        <td class="action-col">
          <span class="action-btn"
            onclick='openReport(${JSON.stringify(p)})'>
            View
          </span>
        </td>
      </tr>
    `;
  });
}

/* ✅ ENTER VALUES PAGE */
/* ENTER VALUES */
function openPatient(patient){
  safeSessionSet(REPORT_DATE_KEY, reportDate.value);
  localStorage.setItem("currentPatient", JSON.stringify(patient));
  localStorage.removeItem("selectedTests");
  localStorage.removeItem("patientResults");

  if (String(patient?.status || "").trim().toUpperCase() === "COMPLETED") {
    alert("Report is COMPLETED (locked). Editing is disabled.");
    parent.loadPage(
      "home/sub-tasks/pt/reports.html",
      "reports"
    );
    return;
  }

  parent.loadPage(
    "home/sub-tasks/pt/enter-values.html",
    "reports"
  );
}

/* FINAL REPORT */
function openReport(patient){
  safeSessionSet(REPORT_DATE_KEY, reportDate.value);
  localStorage.setItem("currentPatient", JSON.stringify(patient));
  localStorage.removeItem("selectedTests");
  localStorage.removeItem("patientResults");

  parent.loadPage(
    "home/sub-tasks/pt/reports.html",
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
