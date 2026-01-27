/* ================= LOAD DATA ================= */
const patient =
  JSON.parse(localStorage.getItem("currentPatient") || "{}");

let results = [];
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

function normalizeText(value){
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function escapeHtml(value){
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatHtmlLines(text){
  return escapeHtml(text).replace(/\r?\n/g, "<br>");
}

function asArray(value){
  return Array.isArray(value) ? value : [];
}

function readUnitEntry(entry){
  if (entry === null || entry === undefined) {
    return "";
  }
  if (typeof entry === "string" || typeof entry === "number") {
    return normalizeText(entry);
  }
  return normalizeText(entry.unit || entry.value || entry.name);
}

function readNormalEntry(entry){
  if (entry === null || entry === undefined) {
    return "";
  }
  if (typeof entry === "string" || typeof entry === "number") {
    return normalizeText(entry);
  }
  return normalizeText(
    entry.normalValue ||
    entry.normal_value ||
    entry.textValue ||
    entry.text_value ||
    entry.normalText ||
    entry.normal_text ||
    entry.value
  );
}

function formatNormalRanges(ranges){
  const parts = asArray(ranges)
    .map(range => {
      if (!range) {
        return "";
      }

      const textValue =
        normalizeText(range.textValue || range.text_value);
      if (textValue) {
        return textValue;
      }

      const min = range.minValue ?? range.min_value;
      const max = range.maxValue ?? range.max_value;
      if (min === null || min === undefined) {
        if (max === null || max === undefined) {
          return "";
        }
        return String(max);
      }
      if (max === null || max === undefined) {
        return String(min);
      }

      const gender =
        normalizeText(range.gender).toUpperCase();
      const base = `${min}-${max}`;
      if (gender && gender !== "ANY") {
        const prefix =
          gender === "MALE" ? "M"
          : (gender === "FEMALE" ? "F" : gender);
        return `${prefix}: ${base}`;
      }
      return base;
    })
    .filter(Boolean);

  return parts.join(" / ");
}

function resolveNormalText(test, param, index){
  const direct =
    normalizeText(param?.normalText || param?.normal_text || param?.normal);
  if (direct) {
    return direct;
  }

  const fromRanges =
    formatNormalRanges(param?.normalRanges || param?.normal_ranges);
  if (fromRanges) {
    return fromRanges;
  }

  const testNormals = asArray(test?.normalValues || test?.normal_values)
    .map(readNormalEntry)
    .filter(Boolean);
  if (testNormals.length) {
    if (typeof index === "number" && testNormals[index]) {
      return testNormals[index];
    }
    return testNormals.join("\n");
  }

  return normalizeText(test?.normalValue || test?.normal_value);
}

function buildResultSlots(param, normalizedItems) {
  const baseName = param.name || "";
  const defaults = Array.isArray(param.defaultResults)
    ? param.defaultResults.map(v => (v || "").trim()).filter(Boolean)
    : [];
  const baseKey = normalizeKey(baseName);
  const slots = [];
  const seen = new Set();

  const addSlot = (suffix, label, defaultValue) => {
    const subKey = suffix ? `${baseName}::${suffix}` : baseName;
    const normalized = normalizeKey(subKey);
    if (seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    slots.push({
      label,
      item: normalizedItems[normalized],
      defaultValue: defaultValue || ""
    });
  };

  const count = Math.max(1, defaults.length);
  for (let i = 0; i < count; i++) {
    const suffix = i === 0 ? "" : String(i + 1);
    const label = i === 0 ? baseName : "";
    addSlot(suffix, label, defaults[i] || "");
  }

  if (baseKey) {
    Object.keys(normalizedItems).forEach(key => {
      if (key.startsWith(baseKey + "::")) {
        const suffix = key.slice(baseKey.length + 2);
        addSlot(suffix, "", "");
      }
    });
  }

  return slots;
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

function resolveUnitText(test, param, index){
  const direct = normalizeText(param?.unit);
  if (direct) {
    return direct;
  }

  const legacyUnit = normalizeText(test?.unit || test?.testUnit);
  if (legacyUnit) {
    return legacyUnit;
  }

  const testUnits = asArray(test?.units || test?.testUnits || test?.unit)
    .map(readUnitEntry)
    .filter(Boolean);
  if (testUnits.length) {
    if (typeof index === "number" && testUnits[index]) {
      const candidate = testUnits[index];
      const name = normalizeText(param?.name);
      return name && candidate === name ? "" : candidate;
    }
    if (testUnits[0]) {
      const candidate = testUnits[0];
      const name = normalizeText(param?.name);
      return name && candidate === name ? "" : candidate;
    }
  }

  return resolveUnit(param || {});
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
        const rawItemMap = grouped[test.id] || {};
        const hasSubSlots = Object.keys(rawItemMap)
          .some(key => key !== "__single__");
        const isMulti = (hasParams && (params.length > 1 || hasSubSlots))
          || (!hasParams && asArray(test.units || test.testUnits).length > 1);

        if (isMulti) {
          body.innerHTML += `
            <tr>
              <td colspan="4"><b>${escapeHtml(test.testName)}</b></td>
            </tr>
          `;

          const normalizedItems = {};
          Object.entries(rawItemMap).forEach(([key, value]) => {
            const normalized = normalizeKey(key === "__single__" ? "" : key);
            normalizedItems[normalized] = value;
          });

          const useParams = hasParams && (params.length > 1 || hasSubSlots);
          const rows = useParams
            ? params.map(p => ({
              name: p.name || "",
              unit: p.unit || "",
              valueType: p.valueType,
              normalText: p.normalText || "",
              defaultResults: Array.isArray(p.defaultResults) ? p.defaultResults : [],
              sectionName: p.sectionName || ""
            }))
            : asArray(test.units || test.testUnits).map((u, index) => ({
              name: (u && typeof u === "object") ? (u.unit || "") : String(u || ""),
              unit: "",
              valueType: null,
              normalText: test.normalValues?.[index]?.normalValue || "",
              sectionName: ""
            }));

          let currentSection = null;
          rows.forEach((param, paramIndex) => {
            const sectionName = String(param.sectionName || "").trim();

            if (sectionName) {
              if (sectionName !== currentSection) {
                body.innerHTML += `
                  <tr class="section-header">
                    <td colspan="4">${escapeHtml(sectionName)}</td>
                  </tr>
                `;
                currentSection = sectionName;
              }
            } else {
              currentSection = null;
            }

            const slots = buildResultSlots(param, normalizedItems);
            slots.forEach(slot => {
              const normalText = resolveNormalText(test, param, paramIndex);
              const resultValue = slot.item?.resultValue || "";
              const valueForDisplay =
                resultValue && resultValue.trim() !== ""
                  ? resultValue
                  : slot.defaultValue;
              const unitText = resolveUnitText(test, param, paramIndex);
              const displayValue =
                valueForDisplay && unitText === "%"
                  ? `${valueForDisplay} %`
                  : valueForDisplay;

              const out = isOutOfRange(
                valueForDisplay,
                normalText,
                patient.gender
              );

              body.innerHTML += `
                <tr>
                  <td class="param-indent">${escapeHtml(slot.label)}</td>
                  <td class="${out ? "is-abnormal" : ""}">
                    ${escapeHtml(displayValue)}
                  </td>
                  <td>${escapeHtml(unitText)}</td>
                  <td>${formatHtmlLines(normalText)}</td>
                </tr>
              `;
            });
          });
        } else {
          const item = rawItemMap["__single__"];
          const normalText = resolveNormalText(test, params[0] || {});
          const resultValue = item?.resultValue || "";

          const out = isOutOfRange(
            resultValue,
            normalText,
            patient.gender
          );

          const unit = resolveUnitText(test, params[0] || {}, 0);

          body.innerHTML += `
            <tr>
              <td><b>${escapeHtml(test.testName)}</b></td>
              <td class="${out ? "is-abnormal" : ""}">
                ${escapeHtml(resultValue)}
              </td>
              <td>${escapeHtml(unit)}</td>
              <td>${formatHtmlLines(normalText)}</td>
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
