const apiPath = window.apiUrl || function (path) {
  return path.charAt(0) === "/" ? "/api" + path : "/api/" + path;
};

const sumRevenue = document.getElementById("sumRevenue");
const sumDiscount = document.getElementById("sumDiscount");
const sumDue = document.getElementById("sumDue");
const sumCommission = document.getElementById("sumCommission");
const sumProfit = document.getElementById("sumProfit");
const doctorSelect = document.getElementById("doctor");
const exportExcel = document.getElementById("exportExcel");
const dateRangeBtn = document.getElementById("dateRangeBtn");
const dateRangeModal = document.getElementById("dateRangeModal");
const closeDateRange = document.getElementById("closeDateRange");
const dateFromInput = document.getElementById("dateFrom");
const dateToInput = document.getElementById("dateTo");
const applyDateRange = document.getElementById("applyDateRange");
const clearDateRange = document.getElementById("clearDateRange");
const detailTitle = document.getElementById("detailTitle");
const detailsBody = document.getElementById("detailsBody");

let doctors = [];
let selectedDoctor = null;
let currentRows = [];
let currentDoctorFallback = "";
let dateRange = { from: null, to: null };

function parseNumber(value){
  const cleaned = String(value ?? "").replace(/,/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function formatNumber(value){
  return String(Math.round(parseNumber(value)));
}

function setSummaryMessage(message){
  sumRevenue.innerHTML =
    `<h4>Total Revenue</h4><p class="summary-value summary-revenue">${message}</p>`;
  sumDiscount.innerHTML =
    `<h4>Discounts Given</h4><p class="summary-value summary-discount">${message}</p>`;
  sumDue.innerHTML =
    `<h4>Total Due</h4><p class="summary-value summary-due">${message}</p>`;
  sumCommission.innerHTML =
    `<h4>Total Commission</h4><p class="summary-value summary-commission">${message}</p>`;
  sumProfit.innerHTML =
    `<h4>Net Profit</h4><p class="summary-value summary-profit">${message}</p>`;
}

function setSummaryValues(data){
  sumRevenue.innerHTML =
    `<h4>Total Revenue</h4><p class="summary-value summary-revenue">₹${formatNumber(data?.totalRevenue)}</p>`;
  sumDiscount.innerHTML =
    `<h4>Discounts Given</h4><p class="summary-value summary-discount">₹${formatNumber(data?.totalDiscount)}</p>`;
  sumDue.innerHTML =
    `<h4>Total Due</h4><p class="summary-value summary-due">₹${formatNumber(data?.totalDue)}</p>`;
  sumCommission.innerHTML =
    `<h4>Total Commission</h4><p class="summary-value summary-commission">₹${formatNumber(data?.totalCommission)}</p>`;
  sumProfit.innerHTML =
    `<h4>Net Profit</h4><p class="summary-value summary-profit">₹${formatNumber(data?.netProfit)}</p>`;
}

function setDetailsMessage(message){
  detailsBody.innerHTML =
    `<tr><td colspan="7" class="muted text-center">${message}</td></tr>`;
}

function renderDetails(rows, doctorNameFallback){
  if (!Array.isArray(rows) || rows.length === 0) {
    setDetailsMessage("No records found");
    return;
  }

  let totalBill = 0;
  let totalDue = 0;
  let totalCommission = 0;
  let html = "";

  rows.forEach(r => {
    const doctorName = r.doctorName || doctorNameFallback || "-";
    const bill = parseNumber(r.billAmount);
    const due = parseNumber(r.dueAmount ?? r.due ?? 0);
    const commission = parseNumber(r.commissionAmount);
    totalBill += bill;
    totalDue += due;
    totalCommission += commission;
    html += `
      <tr>
        <td>${r.date || "-"}</td>
        <td>${r.reportId || "-"}</td>
        <td>${r.patientName || "-"}</td>
        <td>${doctorName}</td>
        <td class="num">₹${formatNumber(bill)}</td>
        <td class="num">₹${formatNumber(due)}</td>
        <td class="num commission">₹${formatNumber(commission)}</td>
      </tr>
    `;
  });

  html += `
    <tr class="total-row">
      <td colspan="4">Total</td>
      <td class="num">₹${formatNumber(totalBill)}</td>
      <td class="num">₹${formatNumber(totalDue)}</td>
      <td class="num commission">₹${formatNumber(totalCommission)}</td>
    </tr>
  `;

  detailsBody.innerHTML = html;
}

function parseDateValue(value){
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    return new Date(Date.UTC(year, month - 1, day));
  }
  const parts = raw.split(/[\/-]/);
  if (parts.length === 3) {
    let year;
    let month;
    let day;
    if (parts[0].length === 4) {
      year = Number(parts[0]);
      month = Number(parts[1]);
      day = Number(parts[2]);
    } else {
      day = Number(parts[0]);
      month = Number(parts[1]);
      year = Number(parts[2]);
    }
    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      return new Date(Date.UTC(year, month - 1, day));
    }
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return new Date(Date.UTC(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate()
  ));
}

function applyDateFilter(rows){
  if (!dateRange.from && !dateRange.to) {
    return rows;
  }
  return rows.filter(row => {
    const rowDate = parseDateValue(row.date);
    if (!rowDate) {
      return false;
    }
    if (dateRange.from && rowDate < dateRange.from) {
      return false;
    }
    if (dateRange.to && rowDate > dateRange.to) {
      return false;
    }
    return true;
  });
}

function renderCurrentRows(rows, doctorNameFallback){
  const filtered = applyDateFilter(rows || []);
  renderDetails(filtered, doctorNameFallback);
  renderSummaryFromRows(filtered);
}

async function fetchJson(url){
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

function getDiscountAmount(row){
  return parseNumber(
    row?.discountAmount ?? row?.discount ?? row?.discountValue ?? row?.discountAmt ?? 0
  );
}

function computeSummary(rows){
  const totals = {
    totalRevenue: 0,
    totalDiscount: 0,
    totalDue: 0,
    totalCommission: 0,
    netProfit: 0,
  };

  rows.forEach(row => {
    const bill = parseNumber(row?.billAmount ?? row?.amount ?? 0);
    const discount = getDiscountAmount(row);
    const due = parseNumber(row?.dueAmount ?? row?.due ?? 0);
    const commission = parseNumber(row?.commissionAmount ?? 0);
    totals.totalRevenue += bill;
    totals.totalDiscount += discount;
    totals.totalDue += due;
    totals.totalCommission += commission;
  });

  // billAmount is already the FINAL payable amount (after discount),
  // so subtracting discount again would double-count it.
  totals.netProfit = totals.totalRevenue - totals.totalCommission;

  return totals;
}

function renderSummaryFromRows(rows){
  const data = computeSummary(rows || []);
  setSummaryValues(data);
}

async function loadAllDetails(){
  detailTitle.innerText = "All Accounts";
  setDetailsMessage("Loading...");
  try{
    const rows = await fetchJson(apiPath("/accounts/details"));
    currentRows = Array.isArray(rows) ? rows : [];
    currentDoctorFallback = "";
    renderCurrentRows(currentRows);
  } catch (err) {
    console.error("Failed to load all account details", err);
    setDetailsMessage("Failed to load");
  }
}

async function loadDoctors(){
  doctorSelect.innerHTML = `<option value="">All</option>`;
  try{
    const data = await fetchJson(apiPath("/accounts/doctors"));
    if (!Array.isArray(data) || data.length === 0) {
      doctors = [];
      return;
    }
    doctors = data;
    renderDoctorOptions();
  } catch (err) {
    console.error("Failed to load doctors", err);
  }
}

function renderDoctorOptions(){
  const fragment = document.createDocumentFragment();
  doctors.forEach(d => {
    if (!d.doctorName) {
      return;
    }
    const option = document.createElement("option");
    option.value = d.doctorId;
    option.textContent = d.doctorName;
    fragment.appendChild(option);
  });
  doctorSelect.appendChild(fragment);
}

function getExportState(){
  const selectedId = doctorSelect.value;
  if (!selectedId) {
    return { doctorId: null, doctorName: "All" };
  }
  const doc = doctors.find(d => String(d.doctorId) === String(selectedId));
  return {
    doctorId: selectedId,
    doctorName: (doc && doc.doctorName) ? doc.doctorName : "Doctor"
  };
}

async function selectDoctor(id){
  selectedDoctor = id;
  const doc = doctors.find(d => String(d.doctorId) === String(id));
  if (!doc) {
    detailTitle.innerText = "No Results";
    setDetailsMessage("No records found");
    return;
  }

  detailTitle.innerText =
    `Billing Details: ${doc.doctorName || "Doctor"} (${formatNumber(doc.commissionRate)}%)`;
  setDetailsMessage("Loading...");

  try{
    const rows = await fetchJson(
      apiPath(`/accounts/doctor/${encodeURIComponent(id)}/details`)
    );

    currentRows = Array.isArray(rows) ? rows : [];
    currentDoctorFallback = doc.doctorName || "Doctor";
    renderCurrentRows(currentRows, currentDoctorFallback);
  } catch (err) {
    console.error("Failed to load doctor details", err);
    setDetailsMessage("Failed to load");
  }
}

function init(){
  loadDoctors();
  loadAllDetails();

  doctorSelect.addEventListener("change", () => {
    const value = doctorSelect.value;
    if (!value) {
      selectedDoctor = null;
      loadAllDetails();
      return;
    }
    selectDoctor(value);
  });

  exportExcel.addEventListener("click", () => {
    const state = getExportState();
    localStorage.setItem("accountsExportFilter", JSON.stringify(state));
    window.open("export.html", "_blank");
  });

  dateRangeBtn.addEventListener("click", () => {
    dateRangeModal.classList.add("is-open");
    dateRangeModal.setAttribute("aria-hidden", "false");
  });

  closeDateRange.addEventListener("click", () => {
    dateRangeModal.classList.remove("is-open");
    dateRangeModal.setAttribute("aria-hidden", "true");
  });

  dateRangeModal.addEventListener("click", (event) => {
    if (event.target === dateRangeModal) {
      dateRangeModal.classList.remove("is-open");
      dateRangeModal.setAttribute("aria-hidden", "true");
    }
  });

  applyDateRange.addEventListener("click", () => {
    const fromDate = parseDateValue(dateFromInput.value);
    const toDate = parseDateValue(dateToInput.value);
    if (fromDate && toDate && fromDate > toDate) {
      alert("From date must be before To date.");
      return;
    }
    dateRange = { from: fromDate, to: toDate };
    renderCurrentRows(currentRows, currentDoctorFallback);
    dateRangeModal.classList.remove("is-open");
    dateRangeModal.setAttribute("aria-hidden", "true");
  });

  clearDateRange.addEventListener("click", () => {
    dateFromInput.value = "";
    dateToInput.value = "";
    dateRange = { from: null, to: null };
    renderCurrentRows(currentRows, currentDoctorFallback);
    dateRangeModal.classList.remove("is-open");
    dateRangeModal.setAttribute("aria-hidden", "true");
  });
}

init();
