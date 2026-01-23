const visit =
  JSON.parse(localStorage.getItem("currentVisit") || "{}");

if (!visit || !visit.visitId) {
  alert("Visit not found. Please open a patient first.");
  throw new Error("Visit ID missing");
}

function setText(id, value){
  const el = document.getElementById(id);
  if (el) {
    el.innerText = value || "";
  }
}

function formatAgeSex(age, sex){
  const safeAge = age ? String(age) : "";
  const safeSex = sex ? String(sex) : "";
  if (safeAge && safeSex) {
    return `${safeAge} / ${safeSex}`;
  }
  return `${safeAge}${safeSex}`;
}

function escapeHtml(value){
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

setText("pName", visit.name);
setText("pAddress", visit.address);
setText("pAgeSex", formatAgeSex(visit.age, visit.sex));
setText("pDoctor", visit.doctorName || "SELF");
setText("pMobile", visit.mobile);
setText("pDate", visit.visitDate || new Date().toLocaleDateString());

let patientTests = [];
let testsById = new Map();
let resultsByPatientTestId = new Map();

function loadPatientTests(){
  return apiList(`visits/${visit.visitId}/patient-tests`)
    .then(list => {
      patientTests = Array.isArray(list) ? list : [];
      return patientTests;
    });
}

function loadTestDetails(){
  const ids = [...new Set(patientTests.map(item => Number(item.testId)).filter(Number.isFinite))];
  if (!ids.length) {
    testsById = new Map();
    return Promise.resolve([]);
  }
  return Promise.all(ids.map(id =>
    apiFetchJson(`tests/${id}`).catch(() => null)
  ))
    .then(details => {
      const clean = details.filter(Boolean);
      testsById = new Map(clean.map(t => [Number(t.id), t]));
      return clean;
    });
}

function loadResults(){
  return apiList(`reports/results/by-visit/${visit.visitId}`)
    .then(list => {
      resultsByPatientTestId = new Map();
      (Array.isArray(list) ? list : []).forEach(r => {
        if (r && r.patientTestId != null) {
          const patientTestId = Number(r.patientTestId);
          const parameterName = r.parameterName || "Result";
          if (!resultsByPatientTestId.has(patientTestId)) {
            resultsByPatientTestId.set(patientTestId, new Map());
          }
          const paramMap = resultsByPatientTestId.get(patientTestId);
          if (!paramMap.has(parameterName)) {
            paramMap.set(parameterName, { values: [], unit: r.unit || "" });
          }
          const entry = paramMap.get(parameterName);
          entry.values.push(r.resultValue || "");
          if (!entry.unit && r.unit) {
            entry.unit = r.unit;
          }
        }
      });
      return list;
    });
}

function render(){
  const body = document.getElementById("reportBody");
  body.innerHTML = "";

  if (!patientTests.length) {
    body.innerHTML = `<tr><td colspan="4">No results found</td></tr>`;
    return;
  }

  patientTests.forEach(item => {
    const test = testsById.get(Number(item.testId)) || {};
    const paramMap = resultsByPatientTestId.get(Number(item.id)) || new Map();
    const parameters = Array.isArray(test.parameters) && test.parameters.length
      ? test.parameters.map(param => param.name || "Result")
      : Array.from(paramMap.keys());

    if (!parameters.length) {
      parameters.push("Result");
    }

    parameters.forEach(paramName => {
      const entry = paramMap.get(paramName) || { values: [], unit: "" };
      const valueText = entry.values.length
        ? entry.values.map(value => escapeHtml(value)).join("<br>")
        : "";
      const testLabel = parameters.length > 1
        ? `${escapeHtml(test.testName || "Test")}<div class="param-label">${escapeHtml(paramName)}</div>`
        : escapeHtml(test.testName || "Test");

      body.innerHTML += `
        <tr>
          <td>${testLabel}</td>
          <td>${valueText}</td>
          <td>${escapeHtml(entry.unit || "")}</td>
          <td></td>
        </tr>
      `;
    });
  });
}

function goPatients(){
  if (parent?.loadPage) {
    parent.loadPage("home/sub-tasks/2-patient.html", "patient");
  } else {
    location.href = "../2-patient.html";
  }
}

window.goPatients = goPatients;

loadPatientTests()
  .then(() => Promise.all([loadTestDetails(), loadResults()]))
  .then(() => render())
  .catch(() => {
    const body = document.getElementById("reportBody");
    body.innerHTML = `<tr><td colspan="4">Failed to load results</td></tr>`;
  });
