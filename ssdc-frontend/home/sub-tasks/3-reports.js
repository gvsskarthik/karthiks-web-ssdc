const reportDate = document.getElementById("reportDate");
const table = document.getElementById("reportTable");
let isAutoDate = true;

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

reportDate.value = getLocalDateInputValue();
loadByDate(reportDate.value);

reportDate.addEventListener("change", () => {
  isAutoDate = reportDate.value === getLocalDateInputValue();
  loadByDate(reportDate.value);
});

scheduleMidnightUpdate();

function loadByDate(date){
  fetch(`${API_BASE_URL}/patients/by-date/${date}`)
    .then(res=>res.json())
    .then(data=>renderTable(data))
    .catch(()=>{
      table.innerHTML =
        `<tr><td colspan="5" class="no-data">No data</td></tr>`;
    });
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
  localStorage.setItem("currentPatient", JSON.stringify(patient));
  localStorage.removeItem("selectedTests");
  localStorage.removeItem("patientResults");

  parent.loadPage(
    "home/sub-tasks/pt/enter-values.html",
    "reports"
  );
}

/* FINAL REPORT */
function openReport(patient){
  localStorage.setItem("currentPatient", JSON.stringify(patient));
  localStorage.removeItem("selectedTests");
  localStorage.removeItem("patientResults");

  parent.loadPage(
    "home/sub-tasks/pt/reports.html",
    "reports"
  );
}
