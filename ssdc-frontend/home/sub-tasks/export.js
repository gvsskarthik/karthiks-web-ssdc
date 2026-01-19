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
generatedAtEl.textContent = new Date().toLocaleString();

let exportRows = [];

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
  exportBody.innerHTML =
    `<tr><td colspan="6">${message}</td></tr>`;
}

function renderRows(rows){
  if (!Array.isArray(rows) || rows.length === 0) {
    setBodyMessage("No records found");
    return;
  }

  exportBody.innerHTML = "";
  rows.forEach(row => {
    const doctorLabel = row.doctorName
      || (exportDoctorId ? exportDoctorName : "-");
    exportBody.innerHTML += `
      <tr>
        <td>${row.date || "-"}</td>
        <td>${row.reportId || "-"}</td>
        <td>${row.patientName || "-"}</td>
        <td>${doctorLabel}</td>
        <td>${formatCurrency(row.billAmount)}</td>
        <td>${formatCurrency(row.commissionAmount)}</td>
      </tr>
    `;
  });
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
    "Commission"
  ];
  const lines = [header.map(toCsvValue).join(",")];
  rows.forEach(row => {
    const doctorLabel = row.doctorName
      || (exportDoctorId ? exportDoctorName : "");
    const line = [
      row.date || "",
      row.reportId || "",
      row.patientName || "",
      doctorLabel,
      formatNumber(row.billAmount),
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
    alert("No records to export");
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
