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
const dateFromInput = document.getElementById("dateFrom");
const dateToInput = document.getElementById("dateTo");
const applyFilters = document.getElementById("applyFilters");
const detailTitle = document.getElementById("detailTitle");
const detailsBody = document.getElementById("detailsBody");
const accountsDateHeader = document.getElementById("accountsDateHeader");

let doctors = [];
let currentRows = [];
let currentDoctorFallback = "";
let dateSortDir = null; // null | "asc" | "desc"

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
    tdDate.textContent =
      (window.formatYmdToDdMmYyyy && r.date)
        ? window.formatYmdToDdMmYyyy(r.date)
        : (r.date || "-");
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

function compareYmd(a, b) {
  const aa = String(a || "").trim();
  const bb = String(b || "").trim();
  if (aa === bb) return 0;
  return aa < bb ? -1 : 1;
}

function getSortedRowsForDisplay() {
  const list = Array.isArray(currentRows) ? currentRows.slice() : [];
  if (dateSortDir !== "asc" && dateSortDir !== "desc") {
    return list;
  }
  list.sort((x, y) => {
    const c = compareYmd(x?.date, y?.date);
    if (c !== 0) {
      return dateSortDir === "asc" ? c : -c;
    }
    const xi = Number(x?.reportId?.replace?.(/^R/i, "")) || 0;
    const yi = Number(y?.reportId?.replace?.(/^R/i, "")) || 0;
    return dateSortDir === "asc" ? (xi - yi) : (yi - xi);
  });
  return list;
}

function updateDateHeaderLabel() {
  if (!accountsDateHeader) return;
  let suffix = "";
  if (dateSortDir === "asc") suffix = " ▲";
  if (dateSortDir === "desc") suffix = " ▼";
  accountsDateHeader.textContent = `Date${suffix}`;
}

function setupDateHeaderSort() {
  if (!accountsDateHeader) return;
  accountsDateHeader.style.cursor = "pointer";
  accountsDateHeader.title = "Sort by date";
  updateDateHeaderLabel();
  accountsDateHeader.addEventListener("click", () => {
    if (dateSortDir == null) {
      dateSortDir = "asc";
    } else {
      dateSortDir = dateSortDir === "asc" ? "desc" : "asc";
    }
    updateDateHeaderLabel();
    renderDetails(getSortedRowsForDisplay(), currentDoctorFallback);
  });
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

function resolveCurrentRange() {
  const from = String(dateFromInput?.value || "").trim();
  const to = String(dateToInput?.value || "").trim();
  if (isYmd(from) && isYmd(to)) {
    return { from, to };
  }
  const month = monthRangeForYmd(getTodayYmdIst());
  return { from: month.from, to: month.to };
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

function getExportRange() {
  const range = resolveCurrentRange();
  return { from: range.from, to: range.to };
}

function setFilterInputsToThisMonth() {
  const month = monthRangeForYmd(getTodayYmdIst());
  if (dateFromInput) dateFromInput.value = month.from;
  if (dateToInput) dateToInput.value = month.to;
  return month;
}

function updateDetailTitle() {
  const id = doctorSelect?.value || "";
  if (!id) {
    detailTitle.innerText = "All Accounts";
    currentDoctorFallback = "";
    return;
  }
  const doc = doctors.find(d => String(d.doctorId) === String(id));
  const docName = doc?.doctorName || "Doctor";
  const rate = formatNumber(doc?.commissionRate);
  detailTitle.innerText = `Billing Details: ${docName} (${rate}%)`;
  currentDoctorFallback = docName;
}

async function loadDetails() {
  updateDetailTitle();
  setDetailsMessage("Loading...");
  setSummaryMessage("Loading...");
  updateDateHeaderLabel();

  const range = resolveCurrentRange();
  const qs = new URLSearchParams();
  qs.set("from", range.from);
  qs.set("to", range.to);
  const doctorId = doctorSelect?.value || "";
  if (doctorId) {
    qs.set("doctorId", doctorId);
  }

  try {
    const rows = await fetchJson(apiPath(`/accounts/details?${qs.toString()}`));
    currentRows = Array.isArray(rows) ? rows : [];
    renderDetails(getSortedRowsForDisplay(), currentDoctorFallback);
    renderSummaryFromRows(currentRows);
  } catch (err) {
    console.error("Failed to load account details", err);
    setDetailsMessage("Failed to load");
    setSummaryMessage("Failed to load");
  }
}

function init(){
  setFilterInputsToThisMonth();
  loadDoctors().finally(() => loadDetails());
  setupDateHeaderSort();

  if (sumDue) {
    sumDue.style.cursor = "pointer";
    sumDue.title = "Open due list";
    sumDue.addEventListener("click", () => {
      const selectedDoctorId = doctorSelect.value || "";
      const range = resolveCurrentRange();

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
    loadDetails();
  });

  exportExcel.addEventListener("click", () => {
    const state = getExportState();
    const range = getExportRange();
    const qs = new URLSearchParams();
    if (state.doctorId) {
      qs.set("doctorId", String(state.doctorId));
      qs.set("doctorName", String(state.doctorName || "Doctor"));
    } else {
      qs.set("doctorName", "All");
    }
    qs.set("from", range.from);
    qs.set("to", range.to);
    window.open(`export.html?${qs.toString()}`, "_blank");
  });

  if (applyFilters) {
    applyFilters.addEventListener("click", async () => {
      const from = String(dateFromInput?.value || "").trim();
      const to = String(dateToInput?.value || "").trim();
      if (!isYmd(from) || !isYmd(to)) {
        await window.ssdcAlert("Please select From and To dates.", { title: "Invalid Date Range" });
        return;
      }
      if (from > to) {
        await window.ssdcAlert("From date must be before To date.", { title: "Invalid Date Range" });
        return;
      }
      loadDetails();
    });
  }

  // Page loads with current month by default; no "This Month" button needed.
}

init();
