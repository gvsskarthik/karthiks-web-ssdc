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
setText("pDate", visit.visitDate || new Date().toLocaleDateString());
setText("pAddress", visit.address);
setText("pAgeSex", formatAgeSex(visit.age, visit.sex));
setText("pDoctor", visit.doctorName || "SELF");

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

function getDefaultValues(test, parameterName){
  const defaults = Array.isArray(test.defaultResults) ? test.defaultResults : [];
  return defaults
    .filter(item => {
      if (!item) {
        return false;
      }
      const name = item.parameterName || "Result";
      return name === parameterName;
    })
    .map(item => item.value)
    .filter(Boolean);
}

function buildInputs(patientTestId, parameterName, unit, values, allowMultiple){
  const safeValues = values && values.length ? values : [""];
  const inputs = safeValues.map(value => `
    <input class="result-input"
           data-patient-test-id="${patientTestId}"
           data-parameter-name="${escapeHtml(parameterName)}"
           data-unit="${escapeHtml(unit)}"
           value="${escapeHtml(value)}">
  `).join("");

  const addButton = allowMultiple
    ? `<div class="add-line-wrap">
         <button class="add-line-btn" type="button"
           data-patient-test-id="${patientTestId}"
           data-parameter-name="${escapeHtml(parameterName)}"
           data-unit="${escapeHtml(unit)}">Add</button>
       </div>`
    : "";

  return `<div class="result-cell">${inputs}${addButton}</div>`;
}

function render(){
  const body = document.getElementById("resultBody");
  body.innerHTML = "";

  if (!patientTests.length) {
    body.innerHTML = `<tr><td colspan="4">No tests selected</td></tr>`;
    return;
  }

  patientTests.forEach(item => {
    const test = testsById.get(Number(item.testId)) || {};
    const paramMap = resultsByPatientTestId.get(Number(item.id)) || new Map();
    const parameters = Array.isArray(test.parameters) && test.parameters.length
      ? test.parameters
      : [{ name: "Result", unit: "" }];

    parameters.forEach(param => {
      const paramName = param.name || "Result";
      const savedEntry = paramMap.get(paramName);
      const savedValues = savedEntry ? savedEntry.values : [];
      const defaultValues = savedValues.length ? [] : getDefaultValues(test, paramName);
      const values = savedValues.length ? savedValues : (defaultValues.length ? defaultValues : [""]);
      const unit = (savedEntry && savedEntry.unit) || param.unit || "";
      const allowMultiple = !!test.allowMultipleResults;
      const nameLabel = parameters.length > 1
        ? `${escapeHtml(test.testName || "Test")}<div class="param-label">${escapeHtml(paramName)}</div>`
        : escapeHtml(test.testName || "Test");

      body.innerHTML += `
        <tr>
          <td>${nameLabel}</td>
          <td>${buildInputs(item.id, paramName, unit, values, allowMultiple)}</td>
          <td>${escapeHtml(unit)}</td>
          <td class="normal"></td>
        </tr>
      `;
    });
  });
}

function collectResults(){
  return [...document.querySelectorAll(".result-input")]
    .map(input => ({
      patientTestId: Number(input.dataset.patientTestId),
      parameterName: input.dataset.parameterName || "Result",
      unit: input.dataset.unit || "",
      resultValue: String(input.value || "").trim()
    }))
    .filter(item => Number.isFinite(item.patientTestId) && item.resultValue !== "");
}

function saveOnly(){
  const payload = collectResults();

  const finishSave = () => {
    localStorage.setItem("patientResults", JSON.stringify(payload));
    window.location.href = "reports.html";
  };

  if (!payload.length) {
    finishSave();
    return;
  }

  fetch(apiUrl("reports/results/bulk"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
  .then(res => {
    if (!res.ok) {
      throw new Error("Failed to save results");
    }
    finishSave();
  })
  .catch(err => {
    console.error(err);
    alert("Failed to save results");
  });
}

const resultBody = document.getElementById("resultBody");
resultBody.addEventListener("click", event => {
  const btn = event.target.closest(".add-line-btn");
  if (!btn) {
    return;
  }
  const wrapper = btn.closest(".add-line-wrap");
  const container = btn.closest(".result-cell");
  if (!container || !wrapper) {
    return;
  }
  const input = document.createElement("input");
  input.type = "text";
  input.className = "result-input";
  input.dataset.patientTestId = btn.dataset.patientTestId || "";
  input.dataset.parameterName = btn.dataset.parameterName || "Result";
  input.dataset.unit = btn.dataset.unit || "";
  input.value = "";
  container.insertBefore(input, wrapper);
});

loadPatientTests()
  .then(() => Promise.all([loadTestDetails(), loadResults()]))
  .then(() => render())
  .catch(() => {
    const body = document.getElementById("resultBody");
    body.innerHTML = `<tr><td colspan="4">Failed to load tests</td></tr>`;
  });

window.saveOnly = saveOnly;
