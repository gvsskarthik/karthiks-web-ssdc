/* ================= LOAD SAVED RESULTS (LOCAL) ================= */
let savedResults = [];
let selectedTestsCache = [];

/* ================= LOAD PATIENT ================= */
const patient =
  JSON.parse(localStorage.getItem("currentPatient") || "{}");

if (!patient || !patient.id) {
  window.ssdcAlert("Patient ID missing. Please open patient from Patient / Reports page.", {
    title: "Missing Patient"
  });
  throw new Error("Patient ID missing");
}

const reportLocked =
  String(patient?.status || "").trim().toUpperCase() === "COMPLETED";

function applyLockedUi(){
  if (!reportLocked) {
    return;
  }
  const saveBtn = document.getElementById("btnSaveResults");
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "LOCKED";
  }
  document.querySelectorAll(".order-input").forEach(el => {
    el.disabled = true;
  });
  document.querySelectorAll(".result-input").forEach(el => {
    el.disabled = true;
  });
  document.querySelectorAll(".add-line-btn,.remove-line-row-btn").forEach(el => {
    el.disabled = true;
  });
}

/* ================= SHOW PATIENT ================= */
document.getElementById("pName").innerText = patient.name || "";
document.getElementById("pAddress").innerText = patient.address || "";
document.getElementById("pAgeSex").innerText =
  (patient.age || "") + " / " + (patient.gender || "");
document.getElementById("pDoctor").innerText = patient.doctor || "";
document.getElementById("pDate").innerText =
  patient.visitDate || (window.formatIstDateDisplay
    ? window.formatIstDateDisplay(new Date())
    : new Date().toLocaleDateString());

/* ================= LAB PRINT SETTINGS (DB) ================= */
function clampLines(value) {
  const n = Number.parseInt(String(value ?? "0"), 10);
  if (!Number.isFinite(n) || Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 200) return 200;
  return n;
}

function setPrintSettingsForm(data) {
  const top = document.getElementById("psTopLines");
  const bottom = document.getElementById("psBottomLines");
  const left = document.getElementById("psLeftLines");
  const right = document.getElementById("psRightLines");
  if (!top || !bottom || !left || !right) {
    return;
  }
  top.value = clampLines(data?.topLines);
  bottom.value = clampLines(data?.bottomLines);
  left.value = clampLines(data?.leftLines);
  right.value = clampLines(data?.rightLines);
}

function readPrintSettingsForm() {
  return {
    topLines: clampLines(document.getElementById("psTopLines")?.value),
    bottomLines: clampLines(document.getElementById("psBottomLines")?.value),
    leftLines: clampLines(document.getElementById("psLeftLines")?.value),
    rightLines: clampLines(document.getElementById("psRightLines")?.value)
  };
}

function loadPrintSettings() {
  return fetch(API_BASE_URL + "/print-settings")
    .then((res) => {
      if (!res.ok) {
        throw new Error("Failed to load print settings");
      }
      return res.json();
    })
    .then((data) => {
      setPrintSettingsForm(data);
      return data;
    })
    .catch(() => {
      // Keep defaults (0) if not available.
      setPrintSettingsForm({ topLines: 0, bottomLines: 0, leftLines: 0, rightLines: 0 });
      return null;
    });
}

function savePrintSettings() {
  const payload = readPrintSettingsForm();
  fetch(API_BASE_URL + "/print-settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
    .then(async (res) => {
      const text = await res.text().catch(() => "");
      if (!res.ok) {
        throw new Error(text || "Failed to save print settings");
      }
      return text ? JSON.parse(text) : payload;
    })
    .then((saved) => {
      setPrintSettingsForm(saved);
      window.ssdcAlert("Letterhead spacing saved for this Lab ID.", { title: "Saved" });
    })
    .catch((err) => {
      console.error(err);
      window.ssdcAlert(err?.message || "Failed to save print settings", { title: "Error" });
    });
}

loadPrintSettings();

// Inline handler replacements (CSP-safe)
{
  const saveSpacingBtn = document.getElementById("btnSaveSpacing");
  if (saveSpacingBtn) {
    saveSpacingBtn.addEventListener("click", savePrintSettings);
  }
  const saveResultsBtn = document.getElementById("btnSaveResults");
  if (saveResultsBtn) {
    saveResultsBtn.addEventListener("click", saveOnly);
  }
}

/* ================= LOAD SELECTED TEST IDS ================= */
function loadSelectedIds(){
  const local =
    JSON.parse(localStorage.getItem("selectedTests") || "[]");
  if (local.length) {
    if (!reportLocked) {
      saveSelectedTestsToDb(local);
    }
    return Promise.resolve(local);
  }

  return fetch(`${API_BASE_URL}/patient-tests/${patient.id}`)
    .then(res => res.json())
    .then(list => {
      const rows = Array.isArray(list) ? list : [];
      const ids = rows.map(x => x && x.testId).filter(Boolean);
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
      window.ssdcAlert("No tests selected");
      return;
    }

    /* ================= LOAD TEST MASTER ================= */
    return fetch(API_BASE_URL + "/tests/active")
      .then(res => res.json())
      .then(allTests => {
        try {
          localStorage.setItem("testsActiveCache", JSON.stringify(allTests || []));
          localStorage.setItem("testsActiveCacheAt", String(Date.now()));
        } catch (e) {
          // ignore storage errors
        }
        const activeTests = (allTests || [])
          .filter(t => t && t.active !== false);
        const selectedTests =
          activeTests.filter(t => ids.includes(t.id));
        selectedTestsCache = sortTestsByOrder(selectedTests);
        renderTests(selectedTestsCache);
      });
  });

function sortTestsByOrder(tests){
  const list = Array.isArray(tests) ? tests : [];
  const indexById = new Map();
  list.forEach((t, i) => indexById.set(Number(t?.id), i));
  const categoryById = new Map();
  list.forEach(t => categoryById.set(Number(t?.id), t?.category || ""));

  return [...list].sort((a, b) => {
    const aId = Number(a?.id);
    const bId = Number(b?.id);
    const ar = categoryPriority(categoryById.get(aId));
    const br = categoryPriority(categoryById.get(bId));
    if (ar !== br) return ar - br;
    return (indexById.get(aId) ?? 0) - (indexById.get(bId) ?? 0);
  });
}

function normalizeKey(value){
  return (value || "").trim().toLowerCase();
}

const categoryPriority =
  window.SSDC?.utils?.categoryPriority || ((_) => 99);

function makeGroupKey(testId, baseName){
  const raw = normalizeKey(baseName) || "value";
  const safe = raw
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `t${testId}-${safe || "value"}`;
}

function normalizeText(value){
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function normalizeNormalForDisplay(value){
  const text = normalizeText(value);
  if (!text) {
    return "";
  }
  // Backend joins multiple normal values with " / ". Show them on new lines.
  return text.replace(/\s+\/\s+/g, "\n");
}

function escapeAttr(value){
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtml(value){
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function asArray(value){
  return Array.isArray(value) ? value : [];
}

function formatHtmlLines(text){
  return escapeHtml(text).replace(/\r?\n/g, "<br>");
}

function clearNode(node){
  if (!node) return;
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function appendTextWithLineBreaks(parent, text){
  if (!parent) return;
  const value = text == null ? "" : String(text);
  if (!value) return;
  const parts = value.split(/\r?\n/);
  parts.forEach((part, idx) => {
    if (idx > 0) {
      parent.appendChild(document.createElement("br"));
    }
    parent.appendChild(document.createTextNode(part));
  });
}

function makeOrderInput(testId){
  const input = document.createElement("input");
  input.className = "order-input";
  input.type = "text";
  input.inputMode = "decimal";
  try { input.dataset.testid = String(testId); } catch (e) { /* ignore */ }
  input.value = "";
  return input;
}

function makeTestNameWrap(testId, testName){
  const wrap = document.createElement("div");
  wrap.className = "test-name-wrap";
  wrap.appendChild(makeOrderInput(testId));
  const b = document.createElement("b");
  b.textContent = testName == null ? "" : String(testName);
  wrap.appendChild(b);
  return wrap;
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

  return parts.join("\n");
}

function resolveNormalText(test, param, index){
  const direct =
    normalizeNormalForDisplay(
      param?.normalText || param?.normal_text || param?.normal
    );
  if (direct) {
    return direct;
  }

  const fromRanges =
    formatNormalRanges(param?.normalRanges || param?.normal_ranges);
  if (fromRanges) {
    return normalizeNormalForDisplay(fromRanges);
  }

  const testNormals = asArray(test?.normalValues || test?.normal_values)
    .map(readNormalEntry)
    .map(normalizeNormalForDisplay)
    .filter(Boolean);
  if (testNormals.length) {
    if (typeof index === "number" && testNormals[index]) {
      return testNormals[index];
    }
    return normalizeNormalForDisplay(testNormals.join("\n"));
  }

  return normalizeNormalForDisplay(test?.normalValue || test?.normal_value);
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
    const label = i === 0 ? baseName : "";
    addSlot(suffix, label, defaults[i] || "");
  }

  if (normalizedBase) {
    Object.keys(savedBySub).forEach(key => {
      if (key.startsWith(normalizedBase + "::")) {
        const rawSuffix = key.slice(normalizedBase.length + 2);
        addSlot(rawSuffix, "", "");
      }
    });
  }

  return slots;
}

function parseSuffixNumber(subTest, baseName){
  const text = normalizeText(subTest);
  if (!text) {
    return null;
  }
  const prefix = normalizeText(baseName);
  const match = text.match(/::\s*(.+)\s*$/);
  if (!match) {
    return null;
  }
  const suffix = match[1];
  const asNumber = Number(suffix);
  if (!Number.isNaN(asNumber) && Number.isFinite(asNumber)) {
    return asNumber;
  }
  const extraMatch = suffix.match(/^extra-(\d+)$/i);
  if (extraMatch) {
    return 1000 + Number(extraMatch[1]);
  }
  return 2000;
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
  const defaultText = defaultValue == null ? "" : String(defaultValue);
  const savedText = savedValue == null ? "" : String(savedValue);
  const safeValue = savedText.trim() !== "" ? savedText : defaultText;

  const input = document.createElement("input");
  input.className = "result-input";
  input.id = inputId;
  input.name = inputId;
  try { input.dataset.testid = String(testId); } catch (e) { /* ignore */ }
  if (subTest) {
    try { input.dataset.sub = String(subTest); } catch (e) { /* ignore */ }
  }
  try { input.dataset.default = safeValue; } catch (e) { /* ignore */ }
  input.value = safeValue;
  input.defaultValue = safeValue;
  return input;
}

/* ================= RENDER TESTS ================= */
function renderTests(tests) {
  const body = document.getElementById("resultBody");
  clearNode(body);
  body.removeEventListener("input", markTouched);
  body.addEventListener("input", markTouched);
  body.removeEventListener("click", handleAddLineClick);
  body.addEventListener("click", handleAddLineClick);

  const frag = document.createDocumentFragment();
  tests.forEach(test => {
    const params = Array.isArray(test.parameters) ? test.parameters : [];
    const hasParams = params.length > 0;
    const isMulti = (hasParams && params.length > 1)
      || (!hasParams && asArray(test.units || test.testUnits).length > 1);

    /* ===== SINGLE VALUE TEST ===== */
    if (!isMulti) {
      const savedBySub = {};
      savedResults.forEach(r => {
        if (r && r.testId == test.id) {
          savedBySub[normalizeKey(r.subTest)] = r;
        }
      });

      const singleParam = params[0] || {};
      const unit = resolveUnitText(test, singleParam, 0);
      const normalText = resolveNormalText(test, singleParam);
      const allowNewLines = !!singleParam.allowNewLines;
      const baseName = normalizeText(singleParam.name) || normalizeText(test.testName);
      const groupKey = allowNewLines ? makeGroupKey(test.id, baseName) : "";
      const defaultResults = Array.isArray(singleParam.defaultResults)
        ? singleParam.defaultResults
        : [];

      const saved =
        savedResults.find(
          r => r && r.testId == test.id && (!r.subTest || String(r.subTest).trim() === "")
        )
        || (baseName
          ? savedResults.find(
            r =>
              r && r.testId == test.id
              && r.subTest
              && !String(r.subTest).includes("::")
              && normalizeKey(r.subTest) === normalizeKey(baseName)
          )
          : null);
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

      {
        const tr = document.createElement("tr");
        tr.setAttribute("data-testgroup", String(test.id));
        if (groupKey) {
          tr.dataset.lineGroup = groupKey;
        }

        const tdName = document.createElement("td");
        tdName.appendChild(makeTestNameWrap(test.id, test.testName));

        const tdResult = document.createElement("td");
        tdResult.appendChild(inputHtml);
        if (allowNewLines) {
          const addBtn = document.createElement("button");
          addBtn.type = "button";
          addBtn.className = "small-btn add-line-btn";
          try {
            addBtn.dataset.testid = String(test.id);
            addBtn.dataset.base = String(baseName);
            addBtn.dataset.unit = String(unit);
            addBtn.dataset.normal = String(normalText || "");
            addBtn.dataset.valuetype = String(singleParam.valueType || "");
            addBtn.dataset.group = String(groupKey);
          } catch (e) {
            // ignore
          }
          addBtn.textContent = "Add";
          tdResult.appendChild(addBtn);
        }

        const tdUnit = document.createElement("td");
        tdUnit.textContent = unit;

        const tdNormal = document.createElement("td");
        tdNormal.className = "normal";
        appendTextWithLineBreaks(tdNormal, normalText);

        tr.appendChild(tdName);
        tr.appendChild(tdResult);
        tr.appendChild(tdUnit);
        tr.appendChild(tdNormal);
        frag.appendChild(tr);
      }

      if (allowNewLines) {
        const rendered = new Set();

        for (let i = 1; i < defaultResults.length; i++) {
          const suffix = String(i + 1);
          const subKey = baseName ? `${baseName}::${suffix}` : suffix;
          const savedItem = savedBySub[normalizeKey(subKey)];
          const inputId = `result-${test.id}-preset-${suffix}`;
          const extraInput = renderResultControl(
            test.id,
            inputId,
            subKey,
            singleParam,
            savedItem?.resultValue || savedItem?.value || "",
            defaultResults[i] || ""
          );

          rendered.add(normalizeKey(subKey));
          const tr = document.createElement("tr");
          tr.setAttribute("data-testgroup", String(test.id));
          tr.dataset.lineGroup = groupKey;

          const tdEmpty = document.createElement("td");
          const tdResult = document.createElement("td");
          tdResult.appendChild(extraInput);

          const removeBtn = document.createElement("button");
          removeBtn.type = "button";
          removeBtn.className = "small-btn remove-line-row-btn";
          try { removeBtn.dataset.group = groupKey; } catch (e) { /* ignore */ }
          removeBtn.textContent = "Remove";
          tdResult.appendChild(removeBtn);

          const tdUnit = document.createElement("td");
          tdUnit.textContent = unit;

          const tdNormal = document.createElement("td");
          tdNormal.className = "normal";
          appendTextWithLineBreaks(tdNormal, normalText);

          tr.appendChild(tdEmpty);
          tr.appendChild(tdResult);
          tr.appendChild(tdUnit);
          tr.appendChild(tdNormal);
          frag.appendChild(tr);
        }

        const extraSaved = savedResults
          .filter(r =>
            r && r.testId == test.id && r.subTest && String(r.subTest).includes("::")
          )
          .sort((a, b) => {
            const aKey = parseSuffixNumber(a.subTest, baseName) ?? 0;
            const bKey = parseSuffixNumber(b.subTest, baseName) ?? 0;
            return aKey - bKey;
          });

        extraSaved.forEach((row, index) => {
          const subKey = row.subTest;
          if (rendered.has(normalizeKey(subKey))) {
            return;
          }
          const inputId = `result-${test.id}-line-${index + 2}`;
          const extraInput = renderResultControl(
            test.id,
            inputId,
            subKey,
            singleParam,
            row?.resultValue || row?.value || "",
            ""
          );

          const tr = document.createElement("tr");
          tr.setAttribute("data-testgroup", String(test.id));
          tr.dataset.lineGroup = groupKey;

          const tdEmpty = document.createElement("td");
          const tdResult = document.createElement("td");
          tdResult.appendChild(extraInput);

          const removeBtn = document.createElement("button");
          removeBtn.type = "button";
          removeBtn.className = "small-btn remove-line-row-btn";
          try { removeBtn.dataset.group = groupKey; } catch (e) { /* ignore */ }
          removeBtn.textContent = "Remove";
          tdResult.appendChild(removeBtn);

          const tdUnit = document.createElement("td");
          tdUnit.textContent = unit;

          const tdNormal = document.createElement("td");
          tdNormal.className = "normal";
          appendTextWithLineBreaks(tdNormal, normalText);

          tr.appendChild(tdEmpty);
          tr.appendChild(tdResult);
          tr.appendChild(tdUnit);
          tr.appendChild(tdNormal);
          frag.appendChild(tr);
        });
      }
      return;
    }

    /* ===== MULTI VALUE TEST ===== */
    {
      const tr = document.createElement("tr");
      tr.setAttribute("data-testgroup", String(test.id));
      tr.className = "test-header-row";
      const td = document.createElement("td");
      td.colSpan = 4;
      td.appendChild(makeTestNameWrap(test.id, test.testName));
      tr.appendChild(td);
      frag.appendChild(tr);
    }

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
        sectionName: p.sectionName || "",
        allowNewLines: !!p.allowNewLines
      }))
      : asArray(test.units || test.testUnits).map((u, i) => ({
        name: (u && typeof u === "object") ? (u.unit || "") : String(u || ""),
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
          const tr = document.createElement("tr");
          tr.setAttribute("data-testgroup", String(test.id));
          tr.className = "section-header";
          const td = document.createElement("td");
          td.colSpan = 4;
          td.textContent = sectionName;
          tr.appendChild(td);
          frag.appendChild(tr);
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
      const groupKey = param.allowNewLines
        ? makeGroupKey(test.id, param.name || "")
        : "";

      slots.forEach((slot, slotIndex) => {
        const inputEl = renderResultControl(
          test.id,
          `result-${test.id}-${i}-${slotIndex}`,
          slot.subKey,
          param,
          slot.savedValue,
          slot.defaultValue
        );
        const unitText = resolveUnitText(test, param, i);
        const normalText = resolveNormalText(test, param, i);

        const tr = document.createElement("tr");
        tr.setAttribute("data-testgroup", String(test.id));
        if (groupKey) {
          tr.dataset.lineGroup = groupKey;
        }

        const tdLabel = document.createElement("td");
        tdLabel.className = "param-indent";
        tdLabel.textContent = slot.label || "";

        const tdResult = document.createElement("td");
        tdResult.appendChild(inputEl);
        if (param.allowNewLines && slotIndex > 0) {
          const removeBtn = document.createElement("button");
          removeBtn.type = "button";
          removeBtn.className = "small-btn remove-line-row-btn";
          try { removeBtn.dataset.group = groupKey; } catch (e) { /* ignore */ }
          removeBtn.textContent = "Remove";
          tdResult.appendChild(removeBtn);
        }
        if (param.allowNewLines && slotIndex === 0) {
          const addBtn = document.createElement("button");
          addBtn.type = "button";
          addBtn.className = "small-btn add-line-btn";
          try {
            addBtn.dataset.testid = String(test.id);
            addBtn.dataset.base = String(param.name || "");
            addBtn.dataset.unit = String(unitText);
            addBtn.dataset.normal = String(normalText);
            addBtn.dataset.valuetype = String(param.valueType || "");
            addBtn.dataset.group = String(groupKey);
          } catch (e) {
            // ignore
          }
          addBtn.textContent = "Add";
          tdResult.appendChild(addBtn);
        }

        const tdUnit = document.createElement("td");
        tdUnit.textContent = unitText;

        const tdNormal = document.createElement("td");
        tdNormal.className = "normal";
        appendTextWithLineBreaks(tdNormal, normalText);

        tr.appendChild(tdLabel);
        tr.appendChild(tdResult);
        tr.appendChild(tdUnit);
        tr.appendChild(tdNormal);
        frag.appendChild(tr);
      });
    });
  });

  body.appendChild(frag);
}

let dynamicLineCounter = 0;

function findLastRowInGroup(body, groupKey){
  if (!body || !groupKey) {
    return null;
  }
  const rows = [...body.querySelectorAll("tr")];
  let last = null;
  rows.forEach(r => {
    if (r?.dataset?.lineGroup === groupKey) {
      last = r;
    }
  });
  return last;
}

function findDynamicRowsInGroup(body, groupKey){
  if (!body || !groupKey) {
    return [];
  }
  return [...body.querySelectorAll("tr")]
    .filter(r => r?.dataset?.lineGroup === groupKey && r?.dataset?.dynamicLine === "1");
}

function handleAddLineClick(event) {
  if (reportLocked) {
    return;
  }
  const removeRowBtn = event.target.closest(".remove-line-row-btn");
  if (removeRowBtn) {
    const body = document.getElementById("resultBody");
    if (!body || !body.contains(removeRowBtn)) {
      return;
    }
    const row = removeRowBtn.closest("tr");
    if (row) {
      const groupKey = removeRowBtn.dataset.group || row.dataset.lineGroup || "";
      row.remove();
      void groupKey;
    }
    return;
  }

  const btn = event.target.closest(".add-line-btn");
  if (!btn) {
    return;
  }
  const body = document.getElementById("resultBody");
  if (!body.contains(btn)) {
    return;
  }

  const testId = Number(btn.dataset.testid);
  if (!testId) {
    return;
  }

  const baseName = btn.dataset.base || "";
  const unit = btn.dataset.unit || "";
  const normal = btn.dataset.normal || "";
  const valueType = btn.dataset.valuetype || "";
  const groupKey = btn.dataset.group || makeGroupKey(testId, baseName);

  const row = btn.closest("tr");
  if (!row) {
    return;
  }

  const inputs = [...document.querySelectorAll(`.result-input[data-testid="${testId}"]`)];
  const normalizedBase = normalizeKey(baseName);
  let maxSuffix = 1;
  inputs.forEach(input => {
    const sub = input?.dataset?.sub;
    if (!sub) {
      return;
    }
    if (!normalizedBase || !normalizeKey(sub).startsWith(normalizedBase + "::")) {
      return;
    }
    const rawSuffix = normalizeText(sub).split("::").pop();
    const n = Number(rawSuffix);
    if (!Number.isNaN(n) && Number.isFinite(n)) {
      maxSuffix = Math.max(maxSuffix, n);
    }
  });
  const nextSuffix = maxSuffix + 1;
  const suffix = String(nextSuffix);
  const subKey = baseName ? `${baseName}::${suffix}` : suffix;
  dynamicLineCounter += 1;
  const inputId = `result-${testId}-dyn-${dynamicLineCounter}`;

  const param = { valueType, unit, normalText: normal };
  const inputEl = renderResultControl(
    testId,
    inputId,
    subKey,
    param,
    "",
    ""
  );

  const hasParamIndent =
    !!row.querySelector(".param-indent") &&
    row.querySelector(".param-indent").textContent.trim() !== "";

  const newRow = document.createElement("tr");
  newRow.dataset.lineGroup = groupKey;
  newRow.dataset.dynamicLine = "1";

  const td1 = document.createElement("td");
  td1.className = hasParamIndent ? "param-indent" : "";

  const td2 = document.createElement("td");
  td2.appendChild(inputEl);
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "small-btn remove-line-row-btn";
  try { removeBtn.dataset.group = groupKey; } catch (e) { /* ignore */ }
  removeBtn.textContent = "Remove";
  td2.appendChild(removeBtn);

  const td3 = document.createElement("td");
  td3.textContent = unit;

  const td4 = document.createElement("td");
  td4.className = "normal";
  appendTextWithLineBreaks(td4, normal);

  newRow.appendChild(td1);
  newRow.appendChild(td2);
  newRow.appendChild(td3);
  newRow.appendChild(td4);

  const insertAfter = findLastRowInGroup(body, groupKey) || row;
  if (insertAfter && insertAfter.parentNode) {
    insertAfter.parentNode.insertBefore(newRow, insertAfter.nextSibling);
  }
}

function markTouched(event) {
  const target = event.target;
  if (target && target.classList.contains("result-input")) {
    target.dataset.touched = "1";
  }
}

/* ================= COLLECT RESULTS ================= */
function collectResults() {
  return [...document.querySelectorAll(".result-input")]
    .map(i => {
      const rawValue = i.value || "";
      const hasRaw = rawValue.trim() !== "";
      const touched = i.dataset.touched === "1";
      const fallback = i.dataset.default || i.getAttribute("value") || i.defaultValue || "";
      const finalValue = hasRaw ? rawValue : (touched ? "" : fallback);
      return {
        patientId: patient.id,
        testId: Number(i.dataset.testid),
        subTest: i.dataset.sub || null,
        resultValue: finalValue
      };
    })
    .filter(r => r.resultValue && r.resultValue.trim() !== "");
}

/* ================= SAVE ONLY ================= */
async function saveOnly() {
  if (reportLocked) {
    await window.ssdcAlert("Report is COMPLETED (locked). Editing is disabled.", {
      title: "Locked"
    });
    location.href = "reports.html";
    return;
  }

  const results = collectResults();
  let selectedIds = [];
  try {
    selectedIds = JSON.parse(localStorage.getItem("selectedTests") || "[]");
  } catch (e) {
    selectedIds = [];
  }
  if (!Array.isArray(selectedIds) || !selectedIds.length) {
    if (Array.isArray(selectedTestsCache) && selectedTestsCache.length) {
      selectedIds = selectedTestsCache
        .map(t => Number(t?.id))
        .filter(n => Number.isFinite(n) && n > 0);
    } else {
      selectedIds = [...new Set(
        [...document.querySelectorAll(".order-input")]
          .map(i => Number(i?.dataset?.testid))
          .filter(n => Number.isFinite(n) && n > 0)
      )];
    }
  }

  // Ensure reports.html always knows the selected test list, even if the initial
  // /patient-tests/{id} fetch hasn't completed yet.
  try {
    localStorage.setItem("selectedTests", JSON.stringify(selectedIds || []));
  } catch (e) {
    // ignore storage errors
  }

  const finishSave = () => {
    localStorage.setItem("patientResults", JSON.stringify(results));
    location.href = "reports.html";
  };

  if (results.length === 0) {
    finishSave();
    return;
  }

  Promise.resolve(saveSelectedTestsToDb(selectedIds))
    .finally(() => {
      fetch(API_BASE_URL + "/patient-tests/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(results)
      })
        .then(async (res) => {
          if (!res.ok) {
            const msg = await res.text().catch(() => "");
            throw new Error(msg || "Failed to save results");
          }
          finishSave();
        })
        .catch(err => {
          console.error(err);
          window.ssdcAlert(err?.message || "Failed to save results", { title: "Error" });
        });
    });
}
