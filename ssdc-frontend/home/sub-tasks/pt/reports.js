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
  const body = document.getElementById("reportBody");
  body.innerHTML = "";

  if (!patientTests.length) {
    body.innerHTML = `<tr><td colspan="4">No results found</td></tr>`;
    return;
  }

  patientTests.forEach(item => {
    const test = testsById.get(Number(item.testId)) || {};
    const result = resultsByPatientTestId.get(Number(item.id));
    body.innerHTML += `
      <tr>
        <td>${test.testName || "Test"}</td>
        <td>${result?.resultValue || ""}</td>
        <td>${result?.unit || ""}</td>
        <td></td>
      </tr>
    `;
  });
}

Promise.all([loadPatientTests(), loadTests(), loadResults()])
  .then(() => render())
  .catch(() => {
    const body = document.getElementById("reportBody");
    body.innerHTML = `<tr><td colspan="4">Failed to load results</td></tr>`;
  });
