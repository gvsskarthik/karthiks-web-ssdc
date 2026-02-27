const reportDate = document.getElementById("reportDate");
const table = document.getElementById("reportTable");
const searchBox = document.getElementById("searchBox");
const doctorFilter = document.getElementById("doctorFilter");
const dateToggle = document.getElementById("dateToggle");
const searchToggle = document.getElementById("searchToggle");
let isAutoDate = true;
let allPatients = [];
const DOCTOR_SELF_VALUE = "__SELF__";

const REPORT_DATE_KEY = "SSDC_REPORTS_SELECTED_DATE";

function clearNode(node) { window.ssdcDom.clear(node); }

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
loadDoctorFilterOptions();
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

function normalizeDoctorName(value){
  const raw = String(value || "").trim();
  const normalized = raw.toUpperCase();
  if (!raw || normalized === "SELF" || normalized === "WALK-IN" || normalized === "WALK IN") {
    return "SELF";
  }
  return normalized;
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

function renderEmpty(message){
  clearNode(table);
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 6;
  td.className = "no-data";
  td.textContent = message || "No data";
  tr.appendChild(td);
  table.appendChild(tr);
}

function formatInr(value){
  const n = Number(value) || 0;
  try {
    const fmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
    return "₹" + fmt.format(Math.round(n));
  } catch (e) {
    return "₹" + String(Math.round(n));
  }
}

function normalizeMobile(value){
  let mobile = String(value || "").replace(/\D/g, "");
  if (!mobile) {
    return "";
  }
  if (!mobile.startsWith("91")) {
    mobile = "91" + mobile;
  }
  return mobile;
}

function formatAgeSex(patient){
  const age = patient?.age ? String(patient.age) : "";
  const sex = patient?.gender ? String(patient.gender) : "";
  if (age && sex) {
    return `${age}/${sex}`;
  }
  return age || sex || "";
}

function buildWhatsAppMessage(patient, credentials){
  const id = Number(patient?.id);
  const reportId = Number.isFinite(id) ? `R${id}` : "";
  const name = String(patient?.name || "").trim();
  const ageSex = formatAgeSex(patient);
  const total = Number(patient?.amount) || 0;
  const paid = Number(patient?.paid) || 0;
  const due = Math.max(0, total - paid);

  const lines = [];
  lines.push("Sai Sree Swetha Diagnostics");
  lines.push("");
  lines.push("Report READY ✅");
  lines.push(`Patient: ${name}${ageSex ? ` (${ageSex})` : ""}`);
  if (reportId) {
    lines.push(`Report ID: ${reportId}`);
  }
  lines.push("");
  lines.push(`Total: ${formatInr(total)}`);
  lines.push(`Paid: ${formatInr(paid)}`);

  if (due > 0) {
    lines.push(`Due: ${formatInr(due)}`);
  } else {
    lines.push("Payment: CLEARED ✅");
  }

  lines.push("");
  lines.push("Please collect from lab.");

  if (credentials?.mobile && credentials?.password) {
    lines.push("");
    lines.push("📱 *View report on your phone:*");
    lines.push("Download: SSDC Labs Patient App");
    lines.push("");
    lines.push("🔑 *Login Details:*");
    lines.push(`Mobile: ${credentials.mobile}`);
    lines.push(`Password: ${credentials.password}`);
  }

  return lines.join("\n");
}

async function informWhatsApp(patient){
  const isCompleted =
    String(patient?.status || "").trim().toUpperCase() === "COMPLETED";
  if (!isCompleted) {
    await window.ssdcAlert("Report not completed", { title: "Not Completed" });
    return;
  }

  const mobile = normalizeMobile(patient?.mobile);
  if (!mobile) {
    await window.ssdcAlert("Patient mobile number not available", { title: "Missing Mobile" });
    return;
  }

  // Fetch fresh credentials from backend (window.fetch auto-attaches JWT)
  let credentials = null;
  try {
    const res = await fetch(window.apiUrl(`/patient-app/generate-credentials/${patient.id}`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
    if (res.ok) credentials = await res.json();
  } catch(e) {
    console.warn("Could not fetch credentials", e);
  }

  const text = buildWhatsAppMessage(patient, credentials);
  window.open(
    `https://wa.me/${mobile}?text=${encodeURIComponent(text)}`,
    "_blank"
  );
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

function matchesDoctorFilter(patient){
  if (!doctorFilter) return true;
  const selected = String(doctorFilter.value || "").trim();
  if (!selected) return true;
  const selectedKey = selected === DOCTOR_SELF_VALUE
    ? "SELF"
    : normalizeDoctorName(selected);
  return normalizeDoctorName(patient?.doctor) === selectedKey;
}

function refreshTable(){
  const query = searchBox ? searchBox.value : "";
  const filtered =
    (allPatients || []).filter(p => matchesPatient(p, query) && matchesDoctorFilter(p));
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

    const tdInform = document.createElement("td");
    tdInform.className = "inform-col";
    const waBtn = document.createElement("button");
    waBtn.type = "button";
    waBtn.className = `wa-btn ${isCompleted ? "" : "is-disabled"}`.trim();
    waBtn.innerHTML = `<i class="bx bxl-whatsapp"></i><span>WhatsApp</span>`;
    waBtn.addEventListener("click", () => informWhatsApp(p));
    tdInform.appendChild(waBtn);

    tr.appendChild(tdSno);
    tr.appendChild(tdName);
    tr.appendChild(tdDoctor);
    tr.appendChild(tdStatus);
    tr.appendChild(tdAction);
    tr.appendChild(tdInform);
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
if (doctorFilter) {
  doctorFilter.addEventListener("change", refreshTable);
}
