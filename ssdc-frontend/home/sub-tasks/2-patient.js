if(parent?.setActiveMenu){ parent.setActiveMenu("patient"); }

const datePicker = document.getElementById("datePicker");
const searchBox  = document.getElementById("searchBox");
const dateToggle = document.getElementById("dateToggle");
const searchToggle = document.getElementById("searchToggle");
const tableBody  = document.getElementById("patientTable");
const bulkBar    = document.getElementById("bulkBar");
const selectedCount = document.getElementById("selectedCount");

let allPatients = [];
let patientMap = new Map();
let doctorMap = new Map();
let selectMode = false;
let isAutoDate = true;

function getLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

datePicker.value = getLocalDateInputValue();
loadByDate(datePicker.value);

function setDateToToday(){
  const today = getLocalDateInputValue();
  if (datePicker.value !== today) {
    datePicker.value = today;
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
  loadByDate(datePicker.value);
};

scheduleMidnightUpdate();

function loadByDate(date){
  Promise.all([
    apiList("visits?size=1000"),
    apiList("patients?size=1000"),
    apiList("doctors?size=1000")
  ])
    .then(([visits, patients, doctors]) => {
      patientMap = new Map((patients || []).map(p => [Number(p.id), p]));
      doctorMap = new Map((doctors || []).map(d => [Number(d.id), d]));

      const normalized = (visits || [])
        .filter(v => {
          const visitDate = String(v?.visitDate || "");
          return visitDate.startsWith(date);
        })
        .map(v => {
          const patient = patientMap.get(Number(v.patientId)) || {};
          const doctor = doctorMap.get(Number(v.doctorId)) || {};
          const amount =
            (Number(v.paidAmount) || 0) + (Number(v.discountAmount) || 0);
          return {
            id: v.id,
            visitId: v.id,
            patientId: v.patientId,
            name: patient.name || "-",
            age: patient.age || "",
            sex: patient.sex || "",
            mobile: patient.mobile || "",
            address: patient.address || "",
            doctorId: v.doctorId,
            doctorName: doctor.name || "SELF",
            amount: amount,
            status: v.status || "",
            visitDate: v.visitDate,
            discountAmount: v.discountAmount,
            paidAmount: v.paidAmount
          };
        });

      allPatients = normalized;
      renderTable(normalized);
    })
    .catch(() => renderEmpty());
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
      <td class="doctor">${p.doctorName||'-'}</td>
      <td class="amount">₹${p.amount}</td>
      <td class="status-col"><span class="status">${p.status}</span></td>
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
    <td colspan="7" class="no-data">
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

function deleteOne(id){
  if(!confirm("Delete patient and all related data?")) return;

  fetch(apiUrl(`visits/${id}`), {
    method: "DELETE"
  })
  .then(() => {

    // 🔥 clear localStorage if this visit was open
    const current =
      JSON.parse(localStorage.getItem("currentVisit") || "{}");

    if(current.visitId === id){
      localStorage.removeItem("currentVisit");
      localStorage.removeItem("selectedTests");
      localStorage.removeItem("patientResults");
    }

    loadByDate(datePicker.value);
  })
  .catch(err => {
    console.error(err);
    alert("Failed to delete patient");
  });
}

function deleteSelected(){
  const checked = document.querySelectorAll(".row-check:checked");
  if(!checked.length){
    alert("No patients selected");
    return;
  }

  if(!confirm("Delete selected patients and all related data?")) return;

  const ids = [...checked].map(cb => Number(cb.dataset.id));

  Promise.all(
    ids.map(id =>
      fetch(apiUrl(`visits/${id}`), {
        method: "DELETE"
      })
    )
  )
  .then(() => {

    // 🔥 clear localStorage if deleted visit was active
    const current =
      JSON.parse(localStorage.getItem("currentVisit") || "{}");

    if(ids.includes(current.visitId)){
      localStorage.removeItem("currentVisit");
      localStorage.removeItem("selectedTests");
      localStorage.removeItem("patientResults");
    }

    exitSelectMode();
    loadByDate(datePicker.value);
  })
  .catch(err => {
    console.error(err);
    alert("Bulk delete failed");
  });
}

function editPatient(id){
  alert("Edit coming soon");
}

function openBill(patient){
  if (!patient || !patient.id) {
    alert("Patient not found");
    return;
  }

  localStorage.setItem("currentVisit", JSON.stringify({
    visitId: patient.visitId || patient.id,
    patientId: patient.patientId,
    doctorId: patient.doctorId || null,
    name: patient.name,
    age: patient.age,
    sex: patient.sex,
    mobile: patient.mobile,
    address: patient.address,
    doctorName: patient.doctorName || "SELF",
    visitDate: patient.visitDate,
    discountAmount: patient.discountAmount,
    paidAmount: patient.paidAmount,
    status: patient.status
  }));
  localStorage.removeItem("selectedTests");
  localStorage.removeItem("patientResults");

  if (parent?.loadPage) {
    parent.loadPage("home/sub-tasks/pt/bill.html", "patient");
  } else {
    location.href = "pt/bill.html";
  }
}
