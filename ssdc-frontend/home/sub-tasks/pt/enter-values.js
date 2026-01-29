/* ================= LOAD SAVED RESULTS (LOCAL) ================= */
let savedResults = [];
let selectedTestsCache = [];
let testOrders = {};

function testOrderStorageKey(){
  const id = patient && patient.id ? String(patient.id) : "";
  return `testOrders:${id}`;
}

function readTestOrders(){
  try {
    const raw = localStorage.getItem(testOrderStorageKey());
    const parsed = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch (e) {
    // ignore
  }
  return {};
}

function writeTestOrders(map){
  try {
    localStorage.setItem(testOrderStorageKey(), JSON.stringify(map || {}));
  } catch (e) {
    // ignore
  }
}

function normalizeOrderValue(value){
  const raw = String(value == null ? "" : value).trim();
  if (!raw) {
    return null;
  }

  // Accept: 1, 1.2, 1.23. Normalize to 2 decimal places (scale=2).
  // Reject more than 2 decimals to avoid ambiguous ordering.
  const m = raw.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) {
    return null;
  }

  const intPart = m[1];
  const frac = m[2] || "";
  const frac2 = frac.length === 0 ? "00" : (frac.length === 1 ? `${frac}0` : frac);
  return `${intPart}.${frac2}`;
}

function getTestOrder(testId){
  const n = normalizeOrderValue(testOrders[String(testId)]);
  return n == null ? "" : n;
}

function setTestOrder(testId, value){
  const key = String(testId);
  const n = normalizeOrderValue(value);
  if (n == null) {
    delete testOrders[key];
  } else {
    testOrders[key] = n;
  }
  writeTestOrders(testOrders);
}

/* ================= LOAD PATIENT ================= */
const patient =
  JSON.parse(localStorage.getItem("currentPatient") || "{}");

if (!patient || !patient.id) {
  alert("Patient ID missing. Please open patient from Patient / Reports page.");
  throw new Error("Patient ID missing");
}

testOrders = readTestOrders();

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

/* ================= LOAD SELECTED TEST IDS ================= */
function loadSelectedIds(){
  const local =
    JSON.parse(localStorage.getItem("selectedTests") || "[]");
  if (local.length) {
    saveSelectedTestsToDb(local, testOrders);
    return Promise.resolve(local);
  }

  return fetch(`${API_BASE_URL}/patient-tests/${patient.id}`)
    .then(res => res.json())
    .then(list => {
      const rows = Array.isArray(list) ? list : [];
      const ids = rows.map(x => x && x.testId).filter(Boolean);
      rows.forEach(row => {
        const tid = row && row.testId;
        const order = row && row.testOrder;
        if (tid == null || order == null) {
          return;
        }
        const n = normalizeOrderValue(order);
        if (n == null) {
          return;
        }
        testOrders[String(tid)] = n;
      });
      writeTestOrders(testOrders);
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

function saveSelectedTestsToDb(selectedIds, orders){
  if (!selectedIds.length) {
    return Promise.resolve();
  }

  const orderMap =
    orders && typeof orders === "object" ? orders : {};
  const payload = selectedIds.map(id => ({
    patientId: patient.id,
    testId: Number(id),
    testOrder: normalizeOrderValue(orderMap[String(id)])
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
    if (r && r.testId != null && r.testOrder != null) {
      const n = normalizeOrderValue(r.testOrder);
      if (n != null && testOrders[String(r.testId)] == null) {
        testOrders[String(r.testId)] = n;
      }
    }
  });
  writeTestOrders(testOrders);
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
        scheduleAutoPaginate();
        scheduleAfterFonts();
      });
  });

function sortTestsByOrder(tests){
  const list = Array.isArray(tests) ? tests : [];
  const indexById = new Map();
  list.forEach((t, i) => indexById.set(Number(t?.id), i));
  const categoryById = new Map();
  list.forEach(t => categoryById.set(Number(t?.id), t?.category || ""));

  const readOrder = (testId) => {
    const raw = testOrders[String(testId)];
    const n = normalizeOrderValue(raw);
    return n == null ? null : Number(n);
  };

  return [...list].sort((a, b) => {
    const aId = Number(a?.id);
    const bId = Number(b?.id);
    const ar = categoryPriority(categoryById.get(aId));
    const br = categoryPriority(categoryById.get(bId));
    if (ar !== br) return ar - br;
    const ao = readOrder(aId);
    const bo = readOrder(bId);
    if (ao == null && bo == null) {
      return (indexById.get(aId) ?? 0) - (indexById.get(bId) ?? 0);
    }
    if (ao == null) return 1;
    if (bo == null) return -1;
    const cmp = ao - bo;
    if (cmp !== 0) return cmp;
    return (indexById.get(aId) ?? 0) - (indexById.get(bId) ?? 0);
  });
}

function normalizeKey(value){
  return (value || "").trim().toLowerCase();
}

function normalizeCategoryKey(value){
  return String(value == null ? "" : value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function categoryPriority(value){
  const key = normalizeCategoryKey(value);
  if (key.includes("hematology")) return 0;
  if (key.includes("biochemistry")) return 1;
  if (key.includes("serology")) return 2;
  if (key.includes("microbiology")) return 3;
  if (key.includes("clinical pathology") && key.includes("urine")) return 4;
  if (key.includes("clinical pathology")) return 4;
  if (key.includes("endocrinology")) return 5;
  if (key.includes("thyroid")) return 5;
  if (key.includes("hormone")) return 5;
  return 99;
}

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
  const valueType = (param.valueType || "").toUpperCase();
  const subAttr = subTest ? ` data-sub="${subTest}"` : "";
  const defaultText =
    defaultValue == null ? "" : String(defaultValue);
  const savedText =
    savedValue == null ? "" : String(savedValue);
  const safeValue =
    savedText.trim() !== "" ? savedText : defaultText;
  const safeAttr = escapeAttr(safeValue);

  return `
    <input class="result-input"
           id="${inputId}"
           name="${inputId}"
           data-testid="${testId}"${subAttr}
           data-default="${safeAttr}"
           value="${safeAttr}">
  `;
}

/* ================= RENDER TESTS ================= */
function renderTests(tests) {
  const body = document.getElementById("resultBody");
  body.innerHTML = "";
  body.removeEventListener("input", markTouched);
  body.addEventListener("input", markTouched);
  body.removeEventListener("click", handleAddLineClick);
  body.addEventListener("click", handleAddLineClick);
  body.removeEventListener("change", handleOrderChange);
  body.addEventListener("change", handleOrderChange);
  body.removeEventListener("change", handleResultChange);
  body.addEventListener("change", handleResultChange);

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

      body.innerHTML += `
        <tr data-testgroup="${escapeAttr(test.id)}"${groupKey ? ` data-line-group="${escapeAttr(groupKey)}"` : ""}>
          <td>
            <div class="test-name-wrap">
              <input
                class="order-input"
                type="text"
                inputmode="decimal"
                data-testid="${escapeAttr(test.id)}"
                value="${escapeAttr(getTestOrder(test.id))}"
              >
              <b>${escapeHtml(test.testName)}</b>
            </div>
          </td>
          <td>
            ${inputHtml}
            ${allowNewLines ? `
              <button
                type="button"
                class="small-btn add-line-btn"
                data-testid="${test.id}"
                data-base="${escapeAttr(baseName)}"
                data-unit="${escapeAttr(unit)}"
                data-normal="${escapeAttr(normalText || '')}"
                data-valuetype="${escapeAttr(singleParam.valueType || '')}"
                data-group="${escapeAttr(groupKey)}"
              >Add</button>
              <button
                type="button"
                class="small-btn remove-line-btn"
                data-testid="${test.id}"
                data-group="${escapeAttr(groupKey)}"
                style="display:none;"
              >Remove</button>` : ""}
          </td>
          <td>${escapeHtml(unit)}</td>
          <td class="normal">
            ${formatHtmlLines(normalText)}
          </td>
        </tr>`;

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
          body.innerHTML += `
            <tr data-testgroup="${escapeAttr(test.id)}" data-line-group="${escapeAttr(groupKey)}">
              <td></td>
              <td>${extraInput}</td>
              <td>${escapeHtml(unit)}</td>
              <td class="normal">${formatHtmlLines(normalText)}</td>
            </tr>`;
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

          body.innerHTML += `
            <tr data-testgroup="${escapeAttr(test.id)}" data-line-group="${escapeAttr(groupKey)}">
              <td></td>
              <td>${extraInput}</td>
              <td>${escapeHtml(unit)}</td>
              <td class="normal">${formatHtmlLines(normalText)}</td>
            </tr>`;
        });
      }
      return;
    }

    /* ===== MULTI VALUE TEST ===== */
    body.innerHTML +=
      `<tr data-testgroup="${escapeAttr(test.id)}" class="test-header-row">
        <td colspan="4">
          <div class="test-name-wrap">
            <input
              class="order-input"
              type="text"
              inputmode="decimal"
              data-testid="${escapeAttr(test.id)}"
              value="${escapeAttr(getTestOrder(test.id))}"
            >
            <b>${escapeHtml(test.testName)}</b>
          </div>
        </td>
      </tr>`;

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
          body.innerHTML += `
            <tr data-testgroup="${escapeAttr(test.id)}" class="section-header">
              <td colspan="4">${escapeHtml(sectionName)}</td>
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
      const groupKey = param.allowNewLines
        ? makeGroupKey(test.id, param.name || "")
        : "";

      slots.forEach((slot, slotIndex) => {
        const inputHtml = renderResultControl(
          test.id,
          `result-${test.id}-${i}-${slotIndex}`,
          slot.subKey,
          param,
          slot.savedValue,
          slot.defaultValue
        );
        const unitText = resolveUnitText(test, param, i);
        const normalText = resolveNormalText(test, param, i);

        body.innerHTML += `
          <tr data-testgroup="${escapeAttr(test.id)}"${groupKey ? ` data-line-group="${escapeAttr(groupKey)}"` : ""}>
            <td class="param-indent">${escapeHtml(slot.label)}</td>
            <td>
              ${inputHtml}
              ${param.allowNewLines && slotIndex === 0 ? `
                <button
                  type="button"
                  class="small-btn add-line-btn"
                  data-testid="${test.id}"
                  data-base="${escapeAttr(param.name || '')}"
                  data-unit="${escapeAttr(unitText)}"
                  data-normal="${escapeAttr(normalText)}"
                  data-valuetype="${escapeAttr(param.valueType || '')}"
                  data-group="${escapeAttr(groupKey)}"
                >Add</button>
                <button
                  type="button"
                  class="small-btn remove-line-btn"
                  data-testid="${test.id}"
                  data-group="${escapeAttr(groupKey)}"
                  style="display:none;"
                >Remove</button>` : ""}
            </td>
            <td>${escapeHtml(unitText)}</td>
            <td class="normal">${formatHtmlLines(normalText)}</td>
          </tr>`;
      });
    });
  });
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
  const removeBtn = event.target.closest(".remove-line-btn");
  if (removeBtn) {
    const body = document.getElementById("resultBody");
    if (!body || !body.contains(removeBtn)) {
      return;
    }
    const testId = Number(removeBtn.dataset.testid);
    const groupKey = removeBtn.dataset.group || "";
    if (!groupKey) {
      return;
    }
    const dynamicRows = findDynamicRowsInGroup(body, groupKey);
    const last = dynamicRows[dynamicRows.length - 1];
    if (last) {
      last.remove();
    }
    if (findDynamicRowsInGroup(body, groupKey).length === 0) {
      removeBtn.style.display = "none";
    }
    if (Number.isFinite(testId) && testId > 0) {
      invalidateBlockHeight(testId);
    } else {
      blockHeightCache.clear();
    }
    scheduleAutoPaginate();
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
  const inputHtml = renderResultControl(
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

  const newRowHtml = `
    <tr data-line-group="${escapeAttr(groupKey)}" data-dynamic-line="1">
      <td class="${hasParamIndent ? "param-indent" : ""}"></td>
      <td>
        ${inputHtml}
      </td>
      <td>${escapeHtml(unit)}</td>
      <td class="normal">
        ${formatHtmlLines(normal)}
      </td>
    </tr>
  `;

  const insertAfter = findLastRowInGroup(body, groupKey) || row;
  insertAfter.insertAdjacentHTML("afterend", newRowHtml);

  const remove = btn.parentElement?.querySelector(".remove-line-btn");
  if (remove) {
    remove.style.display = "";
  }

  invalidateBlockHeight(testId);
  scheduleAutoPaginate();
}

function applyTestOrderToDom(){
  const body = document.getElementById("resultBody");
  if (!body || !Array.isArray(selectedTestsCache) || !selectedTestsCache.length) {
    return;
  }

  const ids = selectedTestsCache
    .map(t => Number(t?.id))
    .filter(id => Number.isFinite(id) && id > 0);

  ids.forEach(id => {
    const rows = [...body.querySelectorAll(`tr[data-testgroup="${id}"]`)];
    rows.forEach(row => body.appendChild(row));
  });
}

function handleOrderChange(event){
  const target = event.target;
  if (!target || !target.classList || !target.classList.contains("order-input")) {
    return;
  }

  const testId = Number(target.dataset.testid);
  if (!Number.isFinite(testId) || testId <= 0) {
    return;
  }

  const normalized = normalizeOrderValue(target.value);
  if (target.value && !normalized) {
    alert("Invalid order. Use numbers like 1, 1.20, 2.05");
    target.value = getTestOrder(testId);
    return;
  }

  setTestOrder(testId, target.value);

  // Apply user ordering immediately, then auto-repaginate for A4 and renumber.
  selectedTestsCache = sortTestsByOrder(selectedTestsCache);
  applyTestOrderToDom();
  scheduleAutoPaginate();
}

function markTouched(event) {
  const target = event.target;
  if (target && target.classList.contains("result-input")) {
    target.dataset.touched = "1";
  }
}

function handleResultChange(event){
  const target = event.target;
  if (!target || !target.classList || !target.classList.contains("result-input")) {
    return;
  }
  const testId = Number(target.dataset.testid);
  if (!Number.isFinite(testId) || testId <= 0) {
    return;
  }
  invalidateBlockHeight(testId);
  scheduleAutoPaginate();
}

let paginateQueued = false;
let paginateBusy = false;
let paginateTimer = null;
let measurePage = null;
const blockHeightCache = new Map();
let fontsSettled = false;

function scheduleAutoPaginate(){
  if (paginateTimer) {
    clearTimeout(paginateTimer);
  }
  paginateTimer = setTimeout(() => {
    paginateTimer = null;
    if (paginateQueued) {
      return;
    }
    paginateQueued = true;
    requestAnimationFrame(() => {
      paginateQueued = false;
      autoPaginateAndNumber();
    });
  }, 60);
}

function scheduleAfterFonts(){
  if (fontsSettled) {
    return;
  }
  const fonts = document.fonts;
  if (fonts && typeof fonts.ready?.then === "function") {
    fonts.ready
      .catch(() => {})
      .then(() => {
        if (fontsSettled) {
          return;
        }
        fontsSettled = true;
        blockHeightCache.clear();
        scheduleAutoPaginate();
      });
    return;
  }

  // Fallback for browsers without Font Loading API.
  setTimeout(() => {
    if (fontsSettled) {
      return;
    }
    fontsSettled = true;
    blockHeightCache.clear();
    scheduleAutoPaginate();
  }, 400);
}

function buildReportPatientBoxHtml(){
  const pName = document.getElementById("pName")?.textContent || "";
  const pDate = document.getElementById("pDate")?.textContent || "";
  const pAddress = document.getElementById("pAddress")?.textContent || "";
  const pAgeSex = document.getElementById("pAgeSex")?.textContent || "";
  const pDoctor = document.getElementById("pDoctor")?.textContent || "";
  const pMobile = patient?.mobile || "";

  return `
    <div class="patient-box">
      <div class="row">
        <div><span class="label">PATIENT</span> : <span>${escapeHtml(pName)}</span></div>
        <div><span class="label">DATE</span> : <span>${escapeHtml(pDate)}</span></div>
      </div>
      <div class="row">
        <div><span class="label">ADDRESS</span> : <span>${escapeHtml(pAddress)}</span></div>
        <div><span class="label">AGE / SEX</span> : <span>${escapeHtml(pAgeSex)}</span></div>
      </div>
      <div class="row">
        <div><span class="label">REF BY Dr.</span> : <span>${escapeHtml(pDoctor)}</span></div>
        <div><span class="label">MOBILE</span> : <span>${escapeHtml(pMobile)}</span></div>
      </div>
    </div>
  `;
}

function ensureMeasurePage(){
  if (measurePage && measurePage.container && document.body.contains(measurePage.container)) {
    return measurePage;
  }

  const container = document.createElement("div");
  container.className = "a4-measure-page";
  container.style.cssText = `
position:fixed;
left:-10000px;
top:0;
width:210mm;
height:297mm;
padding:10mm;
box-sizing:border-box;
visibility:hidden;
background:#fff;
color:#000;
font-family: var(--font-sans, Poppins, Arial, sans-serif);
`;

  const style = document.createElement("style");
  style.textContent = `
.a4-measure-page { line-height:1.25; }
.a4-measure-page .header{ text-align:center; }
.a4-measure-page .header h2{ margin:0; }
.a4-measure-page .header p{ margin:0; }

.a4-measure-page .patient-box{
  border:1px solid #000;
  padding:12px;
  font-size:13px;
  margin:0;
}
.a4-measure-page .row{
  display:flex;
  justify-content:space-between;
  margin-bottom:6px;
}
.a4-measure-page .row:last-child{ margin-bottom:0; }
.a4-measure-page .label{ font-weight:700; }

.a4-measure-page .report-page-content{
  height:calc(297mm - 20mm);
  display:grid;
  grid-template-rows:auto auto 1fr auto;
  gap:10px;
  overflow:hidden;
}
.a4-measure-page .report-page-table-wrap{ overflow:hidden; }
.a4-measure-page .legend{ margin-top:10px; font-size:11px; }
.a4-measure-page .legend-abnormal{ font-weight:700; }
.a4-measure-page .report-footer{
  display:flex;
  flex-direction:column;
  gap:0px;
  font-size:11px;
  font-weight:700;
  letter-spacing:0.3px;
}
.a4-measure-page .report-signature{ text-align:right; padding-right:100px; }
.a4-measure-page .report-clinical{ text-align:left; }

.a4-measure-page table { width:100%; border-collapse:collapse; font-size:10px; margin:0; }
.a4-measure-page th, .a4-measure-page td { border:1px solid #000; padding:4px; vertical-align:top; }
.a4-measure-page th { background:#fff; }
.a4-measure-page .param-indent { padding-left:20px !important; }
.a4-measure-page .section-header td { padding-top:8px !important; font-size:11px !important; font-weight:700 !important; }
.a4-measure-page .normal { white-space:pre-line; font-size:10px; }
.a4-measure-page .test-name-wrap { display:block; }
`;

  const content = document.createElement("div");
  content.className = "report-page-content";

  const header = document.createElement("div");
  header.className = "header";
  header.innerHTML = `
    <h2 style="margin:0;">SAI SREE SWETHA DIAGNOSTICS</h2>
    <p style="margin:0;"><b>BLOOD EXAMINATION REPORT</b></p>
  `;

  const patient = document.createElement("div");
  patient.innerHTML = buildReportPatientBoxHtml();

  const tableWrap = document.createElement("div");
  tableWrap.className = "report-page-table-wrap";

  const table = document.createElement("table");

  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th style="border:1px solid #000; padding:4px;">TEST</th>
      <th style="border:1px solid #000; padding:4px;">RESULT</th>
      <th style="border:1px solid #000; padding:4px;">UNIT</th>
      <th style="border:1px solid #000; padding:4px;">NORMAL VALUES</th>
    </tr>
  `;

  const tbody = document.createElement("tbody");
  table.appendChild(thead);
  table.appendChild(tbody);
  tableWrap.appendChild(table);

  const footer = document.createElement("div");
  footer.innerHTML = `
    <div class="legend">
      <span class="legend-abnormal">Red</span> = Abnormal value
    </div>
    <div class="report-footer">
      <div class="report-signature">SIGNATURE</div>
      <div class="report-clinical">SUGGESTED CLINICAL CORRELATION</div>
    </div>
  `;

  content.appendChild(header);
  content.appendChild(patient);
  content.appendChild(tableWrap);
  content.appendChild(footer);
  container.appendChild(style);
  container.appendChild(content);
  document.body.appendChild(container);

  measurePage = {
    container,
    content,
    thead,
    tbody,
    tableWrap
  };
  return measurePage;
}

function invalidateBlockHeight(testId){
  const prefix = `${Number(testId)}:`;
  for (const key of blockHeightCache.keys()) {
    if (String(key).startsWith(prefix)) {
      blockHeightCache.delete(key);
    }
  }
}

function cloneRowForMeasure(row){
  const c = row.cloneNode(true);

  // Replace result inputs with plain text so height matches `reports.html`.
  c.querySelectorAll("input.result-input").forEach(input => {
    const text =
      input.value ||
      input.getAttribute("value") ||
      input.dataset.default ||
      "";
    const span = document.createElement("span");
    span.textContent = text;
    input.replaceWith(span);
  });

  // Remove ordering inputs and action buttons.
  c.querySelectorAll("input.order-input,button,select,textarea").forEach(el => el.remove());
  return c;
}

function isHeaderLikeRow(row){
  if (!row) {
    return false;
  }
  if (row.classList && row.classList.contains("section-header")) {
    return true;
  }
  const td = row.querySelector("td");
  if (!td) {
    return false;
  }
  const colspan = td.getAttribute("colspan");
  return String(colspan || "") === "4";
}

function splitTextLines(value){
  const raw = String(value == null ? "" : value);
  const parts = raw.split(/\r?\n/).map(s => s.trimEnd());
  const lines = parts.filter(s => s.trim() !== "");
  return lines.length ? lines : [""];
}

function cloneRowsForMeasureFromBlock(blockRows){
  const source = Array.isArray(blockRows) ? blockRows : [];
  if (!source.length) {
    return [];
  }

  const hasMeta = source.some(r => isHeaderLikeRow(r));
  const data = source
    .map((r, idx) => ({ r, idx }))
    .filter(x => !isHeaderLikeRow(x.r))
    .filter(x => (x.r?.querySelectorAll("td")?.length || 0) >= 4);

  // Heuristic: single-test with multiple result lines (Add line feature).
  // In reports.html, normal values show only once (on first result row).
  let suppressNormalAfterFirst = false;
  let firstDataIndex = -1;
  if (!hasMeta && data.length > 1) {
    const first = data[0]?.r;
    const second = data[1]?.r;
    const firstName = first?.querySelectorAll("td")?.[0]?.textContent?.trim() || "";
    const secondName = second?.querySelectorAll("td")?.[0]?.textContent?.trim() || "";
    if (firstName && !secondName) {
      suppressNormalAfterFirst = true;
      firstDataIndex = data[0].idx;
    }
  }

  const out = [];

  source.forEach((row, idx) => {
    if (isHeaderLikeRow(row)) {
      out.push(cloneRowForMeasure(row));
      return;
    }

    const c = cloneRowForMeasure(row);
    const tds = c.querySelectorAll("td");
    if (tds.length < 4) {
      out.push(c);
      return;
    }

    const normalTd = tds[3];
    if (suppressNormalAfterFirst && idx !== firstDataIndex) {
      normalTd.textContent = "";
      out.push(c);
      return;
    }

    const normalLines = splitTextLines(normalTd.innerText || normalTd.textContent || "");
    normalTd.textContent = normalLines[0] || "";
    out.push(c);

    for (let i = 1; i < normalLines.length; i++) {
      const tr = document.createElement("tr");
      const td1 = document.createElement("td");
      const td2 = document.createElement("td");
      const td3 = document.createElement("td");
      const td4 = document.createElement("td");
      td4.textContent = normalLines[i] || "";
      tr.appendChild(td1);
      tr.appendChild(td2);
      tr.appendChild(td3);
      tr.appendChild(td4);
      out.push(tr);
    }
  });

  return out;
}

function applyOrderInputs(){
  document.querySelectorAll(".order-input").forEach(input => {
    const testId = Number(input?.dataset?.testid);
    if (!Number.isFinite(testId) || testId <= 0) {
      return;
    }
    input.value = getTestOrder(testId);
  });
}

function autoPaginateAndNumber(){
  if (paginateBusy) {
    return;
  }
  paginateBusy = true;
  try {
    if (!Array.isArray(selectedTestsCache) || !selectedTestsCache.length) {
      return;
    }

    // Make sure measurements use the final loaded fonts (matches reports.html).
    scheduleAfterFonts();

    // Ensure DOM blocks are currently in the same order as selectedTestsCache.
    applyTestOrderToDom();

    const body = document.getElementById("resultBody");
    if (!body) {
      return;
    }

    const ids = selectedTestsCache
      .map(t => Number(t?.id))
      .filter(id => Number.isFinite(id) && id > 0);

    const page = ensureMeasurePage();
    // Refresh patient box (might change date) before measuring.
    page.content.children[1].innerHTML = buildReportPatientBoxHtml();

    const availableTbodyHeight =
      page.tableWrap.clientHeight - page.thead.getBoundingClientRect().height;

    // Build blocks (DOM rows) per test id.
    const blocks = ids.map(id => ({
      testId: id,
      rows: [...body.querySelectorAll(`tr[data-testgroup="${id}"]`)]
    }));

    let pageNumber = 1;
    let positionOnPage = 0;
    let usedHeight = 0;

    const assignOrder = (testId, pageNum, pos) => {
      const pos2 = String(pos).padStart(2, "0");
      testOrders[String(testId)] = `${pageNum}.${pos2}`;
    };

    const missingBlocks = blocks.filter(block => {
      if (!block.rows.length) return false;
      const cacheKey = `${block.testId}:${block.rows.length}`;
      return blockHeightCache.get(cacheKey) == null;
    });

    if (missingBlocks.length) {
      page.tbody.innerHTML = "";
      const starts = [];

      missingBlocks.forEach(block => {
        if (!block.rows.length) {
          return;
        }
        let firstEl = null;
        const clones = cloneRowsForMeasureFromBlock(block.rows);
        clones.forEach((c, idx) => {
          if (idx === 0) {
            firstEl = c;
          }
          page.tbody.appendChild(c);
        });
        if (firstEl) {
          starts.push({ testId: block.testId, rowCount: block.rows.length, el: firstEl });
        }
      });

      const tbodyRect = page.tbody.getBoundingClientRect();
      const totalHeight = page.tbody.getBoundingClientRect().height;
      const startData = starts
        .map(s => ({
          testId: s.testId,
          rowCount: s.rowCount,
          top: s.el.getBoundingClientRect().top - tbodyRect.top
        }))
        .filter(x => Number.isFinite(x.testId) && x.rowCount > 0)
        .sort((a, b) => a.top - b.top);

      for (let i = 0; i < startData.length; i++) {
        const cur = startData[i];
        const next = startData[i + 1];
        const height = Math.max(0, (next ? next.top : totalHeight) - cur.top);
        const cacheKey = `${cur.testId}:${cur.rowCount}`;
        blockHeightCache.set(cacheKey, height);
      }

      page.tbody.innerHTML = "";
    }

    blocks.forEach(block => {
      if (!block.rows.length) {
        return;
      }

      const cacheKey = `${block.testId}:${block.rows.length}`;
      const blockHeight = blockHeightCache.get(cacheKey) ?? 0;

      if (usedHeight > 0 && usedHeight + blockHeight > availableTbodyHeight + 1) {
        pageNumber += 1;
        positionOnPage = 0;
        usedHeight = 0;
      }

      usedHeight += blockHeight;
      positionOnPage += 1;
      assignOrder(block.testId, pageNumber, positionOnPage);
    });

    writeTestOrders(testOrders);
    applyOrderInputs();

    // Keep selectedTestsCache sorted by the (new) order.
    selectedTestsCache = sortTestsByOrder(selectedTestsCache);
    applyTestOrderToDom();
  } finally {
    paginateBusy = false;
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
function saveOnly() {

  const results = collectResults();
  let selectedIds = [];
  try {
    selectedIds = JSON.parse(localStorage.getItem("selectedTests") || "[]");
  } catch (e) {
    selectedIds = [];
  }
  if (!Array.isArray(selectedIds) || !selectedIds.length) {
    selectedIds = [...new Set(
      [...document.querySelectorAll(".order-input")]
        .map(i => Number(i?.dataset?.testid))
        .filter(n => Number.isFinite(n) && n > 0)
    )];
  }

  const finishSave = () => {
    localStorage.setItem("patientResults", JSON.stringify(results));
    location.href = "reports.html";
  };

  if (results.length === 0) {
    finishSave();
    return;
  }

  Promise.resolve(saveSelectedTestsToDb(selectedIds, testOrders))
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
          alert(err?.message || "Failed to save results");
        });
    });
}
