if(parent?.setActiveMenu){ parent.setActiveMenu("patient"); }

const datePicker = document.getElementById("datePicker");
const searchBox  = document.getElementById("searchBox");
const dateToggle = document.getElementById("dateToggle");
const searchToggle = document.getElementById("searchToggle");
const tableBody  = document.getElementById("patientTable");
const bulkBar    = document.getElementById("bulkBar");
const selectedCount = document.getElementById("selectedCount");

let allPatients = [];
let selectMode = false;
let isAutoDate = true;

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
loadByDate(datePicker.value);

function setDateToToday(){
  const today = getLocalDateInputValue();
  if (datePicker.value !== today) {
    datePicker.value = today;
    safeSessionSet(PATIENTS_DATE_KEY, today);
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
  fetch(`${API_BASE_URL}/patients/by-date/${date}`)
    .then(r=>r.json())
    .then(d=>{ allPatients=d; renderTable(d); })
    .catch(()=>renderEmpty());
}

function searchPatient(){
  const q = searchBox.value.toLowerCase();
  renderTable(allPatients.filter(p =>
    (p.name||"").toLowerCase().includes(q)
  ));
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

function renderTable(data){
  tableBody.innerHTML="";
  if(!data.length){ renderEmpty(); return; }

  const checkClass = selectMode ? "check-col round-left" : "check-col";
  const snoClass = selectMode ? "sno" : "sno round-left";

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
    tableBody.innerHTML+=`
    <tr>
      <td class="${checkClass}">
        <input type="checkbox"
               id="patient-${p.id}"
               name="patient-${p.id}"
               class="row-check"
               data-id="${p.id}"
               onchange="updateCount()">
      </td>
      <td class="${snoClass}">${i+1}</td>
      <td class="name">${p.name || "-"}</td>
      <td class="doctor">${p.doctor||'-'}</td>
      <td class="amount">₹${amount}</td>
      <td class="${dueClass}">${dueText}</td>
      <td class="status-col"><span class="${statusClass}">${statusText}</span></td>
      <td class="options">
        <div class="menu">
          <button class="menu-btn" type="button" onclick="toggleMenu(${p.id})">⋮</button>
          <div class="menu-list" id="menu-${p.id}">
            <div onclick="enterSelectMode()">Select</div>
            <div onclick="editPatient(${p.id})">Edit</div>
            <div onclick='openBill(${JSON.stringify(p)})'>Bill</div>
            <div class="danger" onclick="deleteOne(${p.id})">Delete</div>
          </div>
        </div>
      </td>
    </tr>`;
  });
}

function renderEmpty(){
  tableBody.innerHTML=`<tr>
    <td colspan="8" class="no-data">
      No patients found
    </td></tr>`;
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
  renderTable(allPatients);
}

function exitSelectMode(){
  selectMode=false;
  document.body.classList.remove("select-mode");
  bulkBar.style.display="none";
  closeMenus();
  renderTable(allPatients);
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

    // 🔥 clear localStorage if this patient was open
    const current =
      JSON.parse(localStorage.getItem("currentPatient") || "{}");

    if(current.id === id){
      localStorage.removeItem("currentPatient");
      localStorage.removeItem("selectedTests");
      localStorage.removeItem("patientResults");
    }

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

    // 🔥 clear localStorage if deleted patient was active
    const current =
      JSON.parse(localStorage.getItem("currentPatient") || "{}");

    if(ids.includes(current.id)){
      localStorage.removeItem("currentPatient");
      localStorage.removeItem("selectedTests");
      localStorage.removeItem("patientResults");
    }

    exitSelectMode();
    loadByDate(datePicker.value);
  })
  .catch(err => {
    console.error(err);
    window.ssdcAlert("Bulk delete failed");
  });
}

async function editPatient(id){
  await window.ssdcAlert("Edit coming soon");
}

async function openBill(patient){
  if (!patient || !patient.id) {
    await window.ssdcAlert("Patient not found");
    return;
  }

  localStorage.setItem("currentPatient", JSON.stringify(patient));
  localStorage.removeItem("selectedTests");
  localStorage.removeItem("patientResults");

  if (parent?.loadPage) {
    parent.loadPage("home/sub-tasks/pt/bill.html", "patient");
  } else {
    location.href = "pt/bill.html";
  }
}
