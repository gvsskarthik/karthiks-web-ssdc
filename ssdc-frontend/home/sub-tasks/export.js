const apiPath = window.apiUrl || function (path) {
  return path.charAt(0) === "/" ? "/api" + path : "/api/" + path;
};

const exportBody = document.getElementById("exportBody");
const doctorNameEl = document.getElementById("doctorName");
const generatedAtEl = document.getElementById("generatedAt");

const exportState = JSON.parse(
  localStorage.getItem("accountsExportFilter") || "{}"
);
const exportDoctorId = exportState.doctorId || "";
const exportDoctorName = exportState.doctorName || "All";

doctorNameEl.textContent = exportDoctorName;
generatedAtEl.textContent = window.formatIstDateTimeDisplay
  ? window.formatIstDateTimeDisplay(new Date())
  : new Date().toLocaleString();

let exportRows = [];

function clearNode(node){
  if (!node) return;
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function parseNumber(value){
  const cleaned = String(value ?? "").replace(/,/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function formatNumber(value){
  return String(Math.round(parseNumber(value)));
}

function formatCurrency(value){
  return "Rs " + formatNumber(value);
}

function setBodyMessage(message){
  clearNode(exportBody);
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 7;
  td.textContent = message == null ? "" : String(message);
  tr.appendChild(td);
  exportBody.appendChild(tr);
}

function renderRows(rows){
  if (!Array.isArray(rows) || rows.length === 0) {
    setBodyMessage("No records found");
    return;
  }

  clearNode(exportBody);
  const frag = document.createDocumentFragment();
  rows.forEach(row => {
    const doctorLabel = row.doctorName
      || (exportDoctorId ? exportDoctorName : "-");
    const due = parseNumber(row.dueAmount ?? row.due ?? 0);

    const tr = document.createElement("tr");
    const tdDate = document.createElement("td");
    tdDate.textContent = row.date || "-";
    const tdReport = document.createElement("td");
    tdReport.textContent = row.reportId || "-";
    const tdPatient = document.createElement("td");
    tdPatient.textContent = row.patientName || "-";
    const tdDoctor = document.createElement("td");
    tdDoctor.textContent = doctorLabel;
    const tdBill = document.createElement("td");
    tdBill.textContent = formatCurrency(row.billAmount);
    const tdDue = document.createElement("td");
    tdDue.textContent = formatCurrency(due);
    const tdComm = document.createElement("td");
    tdComm.textContent = formatCurrency(row.commissionAmount);

    tr.appendChild(tdDate);
    tr.appendChild(tdReport);
    tr.appendChild(tdPatient);
    tr.appendChild(tdDoctor);
    tr.appendChild(tdBill);
    tr.appendChild(tdDue);
    tr.appendChild(tdComm);
    frag.appendChild(tr);
  });
  exportBody.appendChild(frag);
}

async function fetchJson(url){
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

async function loadRows(){
  setBodyMessage("Loading...");
  const endpoint = exportDoctorId
    ? `/accounts/doctor/${encodeURIComponent(exportDoctorId)}/details`
    : "/accounts/details";

  try{
    const rows = await fetchJson(apiPath(endpoint));
    exportRows = Array.isArray(rows) ? rows : [];
    renderRows(exportRows);
  } catch (err) {
    console.error("Failed to load export data", err);
    exportRows = [];
    setBodyMessage("Failed to load");
  }
}

function toCsvValue(value){
  const text = String(value ?? "");
  const escaped = text.replace(/"/g, '""');
  return `"${escaped}"`;
}

function buildCsv(rows){
  const header = [
    "Date",
    "Report ID",
    "Patient",
    "Doctor",
    "Bill",
    "Due",
    "Commission"
  ];
  const lines = [header.map(toCsvValue).join(",")];
  rows.forEach(row => {
    const doctorLabel = row.doctorName
      || (exportDoctorId ? exportDoctorName : "");
    const due = parseNumber(row.dueAmount ?? row.due ?? 0);
    const line = [
      row.date || "",
      row.reportId || "",
      row.patientName || "",
      doctorLabel,
      formatNumber(row.billAmount),
      formatNumber(due),
      formatNumber(row.commissionAmount)
    ];
    lines.push(line.map(toCsvValue).join(","));
  });
  return lines.join("\n");
}

function sanitizeFileName(value){
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function downloadExcel(){
  if (!exportRows.length) {
    window.ssdcAlert("No records to export", { title: "Nothing to Export" });
    return;
  }

  const csv = buildCsv(exportRows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  const dateStamp = new Date().toISOString().slice(0, 10);
  const name = sanitizeFileName(exportDoctorName) || "all";
  a.href = url;
  a.download = `accounts-${name}-${dateStamp}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

loadRows();
