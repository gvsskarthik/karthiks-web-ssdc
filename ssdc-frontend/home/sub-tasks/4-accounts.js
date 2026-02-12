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

function isYmd(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim());
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function getTodayYmdIst() {
  if (typeof window.getIstDateInputValue === "function") {
    return window.getIstDateInputValue(new Date());
  }
  return new Date().toISOString().slice(0, 10);
}

function monthRangeForYmd(ymd) {
  const base = String(ymd || "").trim();
  if (!isYmd(base)) {
    return monthRangeForYmd(getTodayYmdIst());
  }
  const year = Number(base.slice(0, 4));
  const month = Number(base.slice(5, 7)); // 1..12
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: `${year}-${pad2(month)}-01`,
    to: `${year}-${pad2(month)}-${pad2(lastDay)}`
  };
}

function ymdFromUtcDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function clearNode(node){
  if (!node) return;
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function setCard(cardEl, title, valueText, valueClass){
  if (!cardEl) return;
  clearNode(cardEl);
  const h4 = document.createElement("h4");
  h4.textContent = title;
  const p = document.createElement("p");
  p.className = `summary-value ${valueClass || ""}`.trim();
  p.textContent = valueText;
  cardEl.appendChild(h4);
  cardEl.appendChild(p);
}

function parseNumber(value){
  const cleaned = String(value ?? "").replace(/,/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function formatNumber(value){
  return String(Math.round(parseNumber(value)));
}

function setSummaryMessage(message){
  const text = message == null ? "" : String(message);
  setCard(sumRevenue, "Total Revenue", text, "summary-revenue");
  setCard(sumDiscount, "Discounts Given", text, "summary-discount");
  setCard(sumDue, "Total Due", text, "summary-due");
  setCard(sumCommission, "Total Commission", text, "summary-commission");
  setCard(sumProfit, "Net Profit", text, "summary-profit");
}

function setSummaryValues(data){
  setCard(sumRevenue, "Total Revenue", `₹${formatNumber(data?.totalRevenue)}`, "summary-revenue");
  setCard(sumDiscount, "Discounts Given", `₹${formatNumber(data?.totalDiscount)}`, "summary-discount");
  setCard(sumDue, "Total Due", `₹${formatNumber(data?.totalDue)}`, "summary-due");
  setCard(sumCommission, "Total Commission", `₹${formatNumber(data?.totalCommission)}`, "summary-commission");
  setCard(sumProfit, "Net Profit", `₹${formatNumber(data?.netProfit)}`, "summary-profit");
}

function setDetailsMessage(message){
  clearNode(detailsBody);
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 7;
  td.className = "muted text-center";
  td.textContent = message == null ? "" : String(message);
  tr.appendChild(td);
  detailsBody.appendChild(tr);
}

function renderDetails(rows, doctorNameFallback){
  if (!Array.isArray(rows) || rows.length === 0) {
    setDetailsMessage("No records found");
    return;
  }

  let totalBill = 0;
  let totalDue = 0;
  let totalCommission = 0;
  clearNode(detailsBody);
  const frag = document.createDocumentFragment();

  rows.forEach(r => {
    const doctorName = r.doctorName || doctorNameFallback || "-";
    const bill = parseNumber(r.billAmount);
    const due = parseNumber(r.dueAmount ?? r.due ?? 0);
    const commission = parseNumber(r.commissionAmount);
    totalBill += bill;
    totalDue += due;
    totalCommission += commission;

    const tr = document.createElement("tr");
    const tdDate = document.createElement("td");
    tdDate.textContent = r.date || "-";
    const tdReport = document.createElement("td");
    tdReport.textContent = r.reportId || "-";
    const tdPatient = document.createElement("td");
    tdPatient.textContent = r.patientName || "-";
    const tdDoctor = document.createElement("td");
    tdDoctor.textContent = doctorName;
    const tdBill = document.createElement("td");
    tdBill.className = "num";
    tdBill.textContent = `₹${formatNumber(bill)}`;
    const tdDue = document.createElement("td");
    tdDue.className = "num";
    tdDue.textContent = `₹${formatNumber(due)}`;
    const tdComm = document.createElement("td");
    tdComm.className = "num commission";
    tdComm.textContent = `₹${formatNumber(commission)}`;

    tr.appendChild(tdDate);
    tr.appendChild(tdReport);
    tr.appendChild(tdPatient);
    tr.appendChild(tdDoctor);
    tr.appendChild(tdBill);
    tr.appendChild(tdDue);
    tr.appendChild(tdComm);
    frag.appendChild(tr);
  });

  const totalTr = document.createElement("tr");
  totalTr.className = "total-row";
  const totalTd = document.createElement("td");
  totalTd.colSpan = 4;
  totalTd.textContent = "Total";
  const totalBillTd = document.createElement("td");
  totalBillTd.className = "num";
  totalBillTd.textContent = `₹${formatNumber(totalBill)}`;
  const totalDueTd = document.createElement("td");
  totalDueTd.className = "num";
  totalDueTd.textContent = `₹${formatNumber(totalDue)}`;
  const totalCommTd = document.createElement("td");
  totalCommTd.className = "num commission";
  totalCommTd.textContent = `₹${formatNumber(totalCommission)}`;
  totalTr.appendChild(totalTd);
  totalTr.appendChild(totalBillTd);
  totalTr.appendChild(totalDueTd);
  totalTr.appendChild(totalCommTd);
  frag.appendChild(totalTr);

  detailsBody.appendChild(frag);
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
  clearNode(doctorSelect);
  const opt = document.createElement("option");
  opt.value = "";
  opt.textContent = "All";
  doctorSelect.appendChild(opt);
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

  if (sumDue) {
    sumDue.style.cursor = "pointer";
    sumDue.title = "Open due list";
    sumDue.addEventListener("click", () => {
      const selectedDoctorId = doctorSelect.value || "";
      const fromYmd = ymdFromUtcDate(dateRange.from);
      const toYmd = ymdFromUtcDate(dateRange.to);

      let range;
      if (isYmd(fromYmd) && isYmd(toYmd)) {
        range = { from: fromYmd, to: toYmd };
      } else if (isYmd(fromYmd) && !isYmd(toYmd)) {
        const month = monthRangeForYmd(fromYmd);
        range = { from: fromYmd, to: month.to };
      } else if (!isYmd(fromYmd) && isYmd(toYmd)) {
        const month = monthRangeForYmd(toYmd);
        range = { from: month.from, to: toYmd };
      } else {
        range = monthRangeForYmd(getTodayYmdIst());
      }

      const qs = new URLSearchParams();
      qs.set("from", range.from);
      qs.set("to", range.to);
      if (selectedDoctorId) {
        qs.set("doctorId", selectedDoctorId);
      }

      const url = `home/sub-tasks/4-accounts-due.html?${qs.toString()}`;
      if (typeof parent !== "undefined" && parent && typeof parent.loadPage === "function") {
        parent.loadPage(url, "accounts");
        return;
      }
      window.location.href = `4-accounts-due.html?${qs.toString()}`;
    });
  }

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

  applyDateRange.addEventListener("click", async () => {
    const fromDate = parseDateValue(dateFromInput.value);
    const toDate = parseDateValue(dateToInput.value);
    if (fromDate && toDate && fromDate > toDate) {
      await window.ssdcAlert("From date must be before To date.", {
        title: "Invalid Date Range"
      });
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
