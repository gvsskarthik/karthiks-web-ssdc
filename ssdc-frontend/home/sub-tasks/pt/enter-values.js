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

function loadTests(){
  return apiList("tests?size=1000")
    .then(list => {
      const tests = Array.isArray(list) ? list : [];
      testsById = new Map(tests.map(t => [Number(t.id), t]));
      return tests;
    });
}

function loadResults(){
  return apiList(`reports/results/by-visit/${visit.visitId}`)
    .then(list => {
      resultsByPatientTestId = new Map();
      (Array.isArray(list) ? list : []).forEach(r => {
        if (r && r.patientTestId != null) {
          resultsByPatientTestId.set(Number(r.patientTestId), r);
        }
      });
      return list;
    });
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
    const saved = resultsByPatientTestId.get(Number(item.id));
    const value = saved?.resultValue || "";
    body.innerHTML += `
      <tr>
        <td>${test.testName || "Test"}</td>
        <td>
          <input class="result-input"
                 data-patient-test-id="${item.id}"
                 value="${String(value).replace(/"/g, "&quot;")}">
        </td>
        <td>${saved?.unit || ""}</td>
        <td></td>
      </tr>
    `;
  });
}

function collectResults(){
  return [...document.querySelectorAll(".result-input")]
    .map(input => ({
      patientTestId: Number(input.dataset.patientTestId),
      resultValue: String(input.value || "").trim()
    }))
    .filter(item => Number.isFinite(item.patientTestId));
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

Promise.all([loadPatientTests(), loadTests(), loadResults()])
  .then(() => render())
  .catch(() => {
    const body = document.getElementById("resultBody");
    body.innerHTML = `<tr><td colspan="4">Failed to load tests</td></tr>`;
  });

window.saveOnly = saveOnly;
