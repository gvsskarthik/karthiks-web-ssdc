/* ================= LOAD DATA ================= */
const patient =
  JSON.parse(localStorage.getItem("currentPatient") || "{}");

let results = [];
const COMMON_RESULT_KEY = "__common__";
let selectedTestIds = [];

/* ================= PATIENT DETAILS ================= */
document.getElementById("pName").innerText =
  patient.name || "";

document.getElementById("pAddress").innerText =
  patient.address || "";

document.getElementById("pAgeSex").innerText =
  (patient.age || "") + " / " + (patient.gender || "");

document.getElementById("pDoctor").innerText =
  patient.doctor || "SELF";

document.getElementById("pMobile").innerText =
  patient.mobile || "";

document.getElementById("pDate").innerText =
  patient.visitDate || new Date().toLocaleDateString();

/* ================= RANGE CHECK ================= */
function isOutOfRange(value, normalText, gender){
  if(!value || !normalText) return false;

  const num = parseFloat(value);
  if(isNaN(num)) return false;

  let rangeText = normalText;

  // Gender-specific normal values
  if(
    normalText.toLowerCase().includes("male") ||
    normalText.toLowerCase().includes("female")
  ){
    const lines = normalText.split(/\n|,/);
    const genderLine = lines.find(l =>
      l.toLowerCase().includes(gender.toLowerCase())
    );
    if(genderLine) rangeText = genderLine;
  }

  // Extract numeric range (e.g. 14-16)
  const match = rangeText.match(/([\d.]+)\s*[-–]\s*([\d.]+)/);
  if(!match) return false;

  const min = parseFloat(match[1]);
  const max = parseFloat(match[2]);

  return num < min || num > max;
}

function normalizeKey(value){
  return (value || "").trim().toLowerCase();
}

function resolveUnit(param){
  const unit = (param.unit || "").trim();
  if (unit) {
    return unit;
  }
  const valueType = (param.valueType || "").toUpperCase();
  if (valueType === "TEXT") {
    return "";
  }
  if (valueType) {
    return "%";
  }
  return "%";
}

function loadResults(){
  if (!patient || !patient.id) {
    return Promise.resolve([]);
  }
  return fetch(`${API_BASE_URL}/patient-tests/results/${patient.id}`)
    .then(res => res.json())
    .then(list => {
      results = list || [];
      localStorage.setItem("patientResults", JSON.stringify(results));
      return results;
    })
    .catch(() => {
      results = JSON.parse(localStorage.getItem("patientResults") || "[]");
      return results;
    });
}

function loadSelectedTests(){
  if (!patient || !patient.id) {
    selectedTestIds = [];
    return Promise.resolve([]);
  }
  return fetch(`${API_BASE_URL}/patient-tests/${patient.id}`)
    .then(res => res.json())
    .then(list => {
      selectedTestIds = (list || [])
        .map(x => Number(x.testId))
        .filter(id => !Number.isNaN(id));
      return selectedTestIds;
    })
    .catch(() => {
      selectedTestIds = [];
      return [];
    });
}

function deriveSelectedFromResults(){
  const ids = new Set(
    results.map(r => Number(r.testId)).filter(id => !Number.isNaN(id))
  );
  return [...ids];
}

/* ================= LOAD TEST MASTER ================= */
Promise.all([loadResults(), loadSelectedTests()])
  .then(([, selectedIds]) => {
    let ids = selectedIds && selectedIds.length
      ? selectedIds
      : deriveSelectedFromResults();

    if (!ids.length) {
      document.getElementById("reportBody").innerHTML =
        `<tr><td colspan="4">No results found</td></tr>`;
      return;
    }

    return fetch(API_BASE_URL + "/tests/active")
    .then(res => res.json())
    .then(tests => {

      const body = document.getElementById("reportBody");
      body.innerHTML = "";

      const selectedTests = tests.filter(t => ids.includes(t.id));
      if (!selectedTests.length) {
        body.innerHTML =
          `<tr><td colspan="4">No tests found</td></tr>`;
        return;
      }

      // Sort to prefer the latest entry when duplicates exist
      results.sort((a, b) => (a.id || 0) - (b.id || 0));

      // Group results by testId + subTest (keep latest)
      const grouped = {};
      results.forEach(r => {
        const tid = r.testId;
        if(!grouped[tid]) grouped[tid] = {};
        const key = r.subTest || "__single__";
        grouped[tid][key] = r;
      });

      selectedTests.forEach(test => {
        const params = Array.isArray(test.parameters) ? test.parameters : [];
        const hasParams = params.length > 0;
        const isMulti = (hasParams && params.length > 1)
          || (!hasParams && (test.units || []).length > 1);
        const rawItemMap = grouped[test.id] || {};

        if (isMulti) {
          body.innerHTML += `
            <tr>
              <td colspan="4"><b>${test.testName}</b></td>
            </tr>
          `;

          const normalizedItems = {};
          Object.entries(rawItemMap).forEach(([key, value]) => {
            const normalized = normalizeKey(key === "__single__" ? "" : key);
            normalizedItems[normalized] = value;
          });

          const rows = hasParams && params.length > 1
            ? params.map(p => ({
              name: p.name || "",
              unit: p.unit || "",
              valueType: p.valueType,
              normalText: p.normalText || "",
              sectionName: p.sectionName || ""
            }))
            : (test.units || []).map((u, index) => ({
              name: u.unit || "",
              unit: "",
              valueType: null,
              normalText: test.normalValues?.[index]?.normalValue || "",
              sectionName: ""
            }));

          let currentSection = null;
          if (test.commonResult) {
            const commonItem =
              normalizedItems[normalizeKey(COMMON_RESULT_KEY)];
            const resultValue = commonItem?.resultValue || "";
            body.innerHTML += `
              <tr>
                <td class="param-indent">Common Result</td>
                <td>${resultValue}</td>
                <td></td>
                <td></td>
              </tr>
            `;
          }
          rows.forEach(param => {
            const item = normalizedItems[normalizeKey(param.name)];
            const normalText = param.normalText || "";
            const resultValue = item?.resultValue || "";
            const unitText = resolveUnit(param);
            const displayValue =
              resultValue && unitText === "%" ? `${resultValue} %` : resultValue;
            const sectionName = String(param.sectionName || "").trim();

            if (sectionName) {
              if (sectionName !== currentSection) {
                body.innerHTML += `
                  <tr class="section-header">
                    <td colspan="4">${sectionName}</td>
                  </tr>
                `;
                currentSection = sectionName;
              }
            } else {
              currentSection = null;
            }

            const out = isOutOfRange(
              resultValue,
              normalText,
              patient.gender
            );

            body.innerHTML += `
              <tr>
                <td class="param-indent">${param.name}</td>
                <td class="${out ? "is-abnormal" : ""}">
                  ${displayValue}
                </td>
                <td>${unitText}</td>
                <td>${normalText}</td>
              </tr>
            `;
          });
        } else {
          const item = rawItemMap["__single__"];
          const normalText =
            (test.normalValues || [])
              .map(n => n.normalValue)
              .join("<br>");
          const fallbackNormal = params[0]?.normalText || "";
          const resultValue = item?.resultValue || "";

          const out = isOutOfRange(
            resultValue,
            normalText || fallbackNormal,
            patient.gender
          );

          const unit =
            (params[0]?.unit || "").trim()
            || test.units?.[0]?.unit
            || "";

          body.innerHTML += `
            <tr>
              <td><b>${test.testName}</b></td>
              <td class="${out ? "is-abnormal" : ""}">
                ${resultValue}
              </td>
              <td>${unit}</td>
              <td>${normalText || fallbackNormal}</td>
            </tr>
          `;
        }

      });
    });
  });

/* ================= ACTIONS ================= */
function goPatients(){
  parent.loadPage("home/sub-tasks/2-patient.html");
}

function downloadPDF(){
  window.print(); // browser save as PDF
}

function shareWhatsApp(){
  let mobile = (patient.mobile || "").replace(/\D/g, "");

  if(!mobile){
    alert("Patient mobile number not available");
    return;
  }

  if(!mobile.startsWith("91")){
    mobile = "91" + mobile;
  }

  const text =
`Sai Sree Swetha Diagnostics

Patient: ${patient.name}
Date: ${patient.visitDate}

Please collect your report from the lab.`;

  window.open(
    `https://wa.me/${mobile}?text=${encodeURIComponent(text)}`,
    "_blank"
  );
}
