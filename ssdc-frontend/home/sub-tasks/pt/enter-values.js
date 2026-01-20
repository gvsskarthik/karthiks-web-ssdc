/* ================= LOAD SAVED RESULTS (LOCAL) ================= */
let savedResults = [];

/* ================= LOAD PATIENT ================= */
const patient =
  JSON.parse(localStorage.getItem("currentPatient") || "{}");

if (!patient || !patient.id) {
  alert("Patient ID missing. Please open patient from Patient / Reports page.");
  throw new Error("Patient ID missing");
}

/* ================= SHOW PATIENT ================= */
document.getElementById("pName").innerText = patient.name || "";
document.getElementById("pAddress").innerText = patient.address || "";
document.getElementById("pAgeSex").innerText =
  (patient.age || "") + " / " + (patient.gender || "");
document.getElementById("pDoctor").innerText = patient.doctor || "";
document.getElementById("pDate").innerText =
  patient.visitDate || new Date().toLocaleDateString();

/* ================= LOAD SELECTED TEST IDS ================= */
function loadSelectedIds(){
  const local =
    JSON.parse(localStorage.getItem("selectedTests") || "[]");
  if (local.length) {
    saveSelectedTestsToDb(local);
    return Promise.resolve(local);
  }

  return fetch(`${API_BASE_URL}/patient-tests/${patient.id}`)
    .then(res => res.json())
    .then(list => {
      const ids = (list || []).map(x => x.testId);
      localStorage.setItem("selectedTests", JSON.stringify(ids));
      return ids;
    });
}

/* ================= LOAD SAVED RESULTS (DB) ================= */
function loadSavedResults(){
  return fetch(`${API_BASE_URL}/patient-tests/results/${patient.id}`)
    .then(res => res.json())
    .then(list => {
      const incoming = list || [];
      savedResults = normalizeResults(incoming);
      if (savedResults.length) {
        localStorage.setItem("patientResults", JSON.stringify(savedResults));
      }
      return savedResults;
    })
    .catch(() => {
      const cached =
        JSON.parse(localStorage.getItem("patientResults") || "[]");
      savedResults = normalizeResults(cached);
      return savedResults;
    });
}

function saveSelectedTestsToDb(selectedIds){
  if (!selectedIds.length) {
    return Promise.resolve();
  }

  const payload = selectedIds.map(id => ({
    patientId: patient.id,
    testId: Number(id)
  }));

  return fetch(API_BASE_URL + "/patient-tests/select", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).catch(() => {});
}

function deriveSelectedFromResults(){
  const ids = new Set(savedResults.map(r => r.testId));
  return [...ids];
}

function normalizeResults(list){
  const ordered = [...(list || [])].sort((a, b) => (a.id || 0) - (b.id || 0));
  const map = {};
  ordered.forEach(r => {
    const key = `${r.testId}::${r.subTest || ""}`;
    map[key] = r;
  });
  return Object.values(map);
}

loadSavedResults()
  .then(() => loadSelectedIds())
  .then(selectedIds => {
    let ids = selectedIds;
    if (!ids.length && savedResults.length) {
      ids = deriveSelectedFromResults();
      localStorage.setItem("selectedTests", JSON.stringify(ids));
    }
    if (!ids.length) {
      alert("No tests selected");
      return;
    }

    /* ================= LOAD TEST MASTER ================= */
    return fetch(API_BASE_URL + "/tests/active")
      .then(res => res.json())
      .then(allTests => {
        const activeTests = (allTests || [])
          .filter(t => t && t.active !== false);
        const selectedTests =
          activeTests.filter(t => ids.includes(t.id));
        renderTests(selectedTests);
      });
  });

function normalizeKey(value){
  return (value || "").trim().toLowerCase();
}

function buildResultSlots(baseName, defaultResults, savedBySub) {
  const defaults = Array.isArray(defaultResults)
    ? defaultResults.map(v => (v || "").trim()).filter(Boolean)
    : [];
  const slots = [];
  const baseKey = baseName || "";
  const normalizedBase = normalizeKey(baseKey);
  const seen = new Set();

  const addSlot = (suffix, label, defaultValue) => {
    const subKey = suffix ? `${baseKey}::${suffix}` : baseKey;
    const normalized = normalizeKey(subKey);
    if (seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    const saved = savedBySub[normalized];
    slots.push({
      label,
      subKey,
      savedValue: saved?.resultValue || saved?.value || "",
      defaultValue: defaultValue || ""
    });
  };

  const count = Math.max(1, defaults.length);
  for (let i = 0; i < count; i++) {
    const suffix = i === 0 ? "" : String(i + 1);
    const label = i === 0 ? baseName : `${baseName} (${i + 1})`;
    addSlot(suffix, label, defaults[i] || "");
  }

  if (normalizedBase) {
    Object.keys(savedBySub).forEach(key => {
      if (key.startsWith(normalizedBase + "::")) {
        const rawSuffix = key.slice(normalizedBase.length + 2);
        addSlot(rawSuffix, `${baseName} (${rawSuffix})`, "");
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

function renderResultControl(testId,
                             inputId,
                             subTest,
                             param,
                             savedValue,
                             defaultValue){
  const valueType = (param.valueType || "").toUpperCase();
  const subAttr = subTest ? ` data-sub="${subTest}"` : "";
  const defaultText =
    defaultValue == null ? "" : String(defaultValue);
  const savedText =
    savedValue == null ? "" : String(savedValue);
  const safeValue =
    savedText.trim() !== "" ? savedText : defaultText;

  return `
    <input class="result-input"
           id="${inputId}"
           name="${inputId}"
           data-testid="${testId}"${subAttr}
           value="${safeValue}">
  `;
}

/* ================= RENDER TESTS ================= */
function renderTests(tests) {
  const body = document.getElementById("resultBody");
  body.innerHTML = "";

  tests.forEach(test => {
    const params = Array.isArray(test.parameters) ? test.parameters : [];
    const hasParams = params.length > 0;
    const isMulti = (hasParams && params.length > 1)
      || (!hasParams && (test.units || []).length > 1);

    /* ===== SINGLE VALUE TEST ===== */
    if (!isMulti) {

      const saved = savedResults.find(
        r => r.testId == test.id && !r.subTest
      );

      const singleParam = params[0] || {};
      const unit =
        (singleParam.unit || "").trim()
        || test.units?.[0]?.unit
        || "";
      const normalText =
        (test.normalValues || [])
          .map(n => n.normalValue)
          .join("<br>");
      const fallbackNormal = singleParam.normalText || "";
      const inputHtml = renderResultControl(
        test.id,
        `result-${test.id}`,
        null,
        singleParam,
        saved?.resultValue || saved?.value || "",
        Array.isArray(singleParam.defaultResults)
          ? (singleParam.defaultResults[0] || "")
          : ""
      );

      body.innerHTML += `
        <tr>
          <td><b>${test.testName}</b></td>
          <td>
            ${inputHtml}
          </td>
          <td>${unit}</td>
          <td class="normal">
            ${normalText || fallbackNormal}
          </td>
        </tr>`;
      return;
    }

    /* ===== MULTI VALUE TEST ===== */
    body.innerHTML +=
      `<tr><td colspan="4"><b>${test.testName}</b></td></tr>`;

    const savedBySub = {};
    savedResults.forEach(r => {
      if (r.testId == test.id) {
        savedBySub[normalizeKey(r.subTest)] = r;
      }
    });

    const rows = hasParams && params.length > 1
      ? params.map(p => ({
        name: p.name || "",
        unit: p.unit || "",
        valueType: p.valueType,
        normalText: p.normalText || "",
        defaultResults: Array.isArray(p.defaultResults) ? p.defaultResults : [],
        sectionName: p.sectionName || ""
      }))
      : (test.units || []).map((u, i) => ({
        name: u.unit || "",
        unit: "",
        valueType: null,
        normalText: test.normalValues?.[i]?.normalValue || "",
        sectionName: ""
      }));

    let currentSection = null;
    rows.forEach((param, i) => {
      const sectionName = String(param.sectionName || "").trim();
      if (sectionName) {
        if (sectionName !== currentSection) {
          body.innerHTML += `
            <tr class="section-header">
              <td colspan="4">${sectionName}</td>
            </tr>`;
          currentSection = sectionName;
        }
      } else {
        currentSection = null;
      }

      const slots = buildResultSlots(
        param.name,
        param.defaultResults,
        savedBySub
      );

      slots.forEach((slot, slotIndex) => {
        const inputHtml = renderResultControl(
          test.id,
          `result-${test.id}-${i}-${slotIndex}`,
          slot.subKey,
          param,
          slot.savedValue,
          slot.defaultValue
        );

        body.innerHTML += `
          <tr>
            <td class="param-indent">${slot.label}</td>
            <td>
              ${inputHtml}
            </td>
            <td>${resolveUnit(param)}</td>
            <td class="normal">
              ${param.normalText || ""}
            </td>
          </tr>`;
      });
    });
  });
}

/* ================= COLLECT RESULTS ================= */
function collectResults() {
  return [...document.querySelectorAll(".result-input")]
    .filter(i => i.value.trim() !== "")
    .map(i => ({
      patientId: patient.id,
      testId: Number(i.dataset.testid),
      subTest: i.dataset.sub || null,
      resultValue: i.value
    }));
}

/* ================= SAVE ONLY ================= */
function saveOnly() {

  const results = collectResults();

  const finishSave = () => {
    localStorage.setItem("patientResults", JSON.stringify(results));
    location.href = "reports.html";
  };

  if (results.length === 0) {
    finishSave();
    return;
  }

  const requests = [];
  if (results.length) {
    requests.push(fetch(API_BASE_URL + "/patient-tests/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(results)
    }));
  }

  Promise.all(requests)
    .then(() => finishSave())
    .catch(err => {
      console.error(err);
      alert("Failed to save results");
    });
}
