/* ================= LOAD DATA ================= */
const patient =
  JSON.parse(localStorage.getItem("currentPatient") || "{}");

let results = [];
let selectedTestIds = [];

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

function appendMessageRow(tbody, message){
  clearNode(tbody);
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 4;
  td.textContent = message == null ? "" : String(message);
  tr.appendChild(td);
  tbody.appendChild(tr);
}

function appendIndentText(node, level){
  if (!node) return;
  const count = Math.max(0, Number(level) || 0);
  if (!count) return;
  node.appendChild(document.createTextNode("\u00A0".repeat(4 * count)));
}

function isCompletedStatus(status){
  return String(status || "").trim().toUpperCase() === "COMPLETED";
}

function persistPatient(){
  try {
    localStorage.setItem("currentPatient", JSON.stringify(patient || {}));
  } catch (e) {
    // ignore storage errors
  }
}

function syncReportLockUi(){
  const completed = isCompletedStatus(patient?.status);
  const btnPrint = document.getElementById("btnPrint");
  const btnDownload = document.getElementById("btnDownload");
  const btnWhatsapp = document.getElementById("btnWhatsapp");
  const btnComplete = document.getElementById("btnComplete");

  [btnPrint, btnDownload, btnWhatsapp].forEach(btn => {
    if (btn) {
      btn.disabled = !completed;
    }
  });

  if (btnComplete) {
    btnComplete.disabled = completed;
  }
}

function markCompleted(){
  if (!patient || !patient.id) {
    window.ssdcAlert("Patient ID missing", { title: "Missing Patient" });
    return;
  }
  if (isCompletedStatus(patient.status)) {
    syncReportLockUi();
    return;
  }

  const btnComplete = document.getElementById("btnComplete");
  if (btnComplete) {
    btnComplete.disabled = true;
  }

  fetch(`${API_BASE_URL}/patients/${patient.id}/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "COMPLETED" })
  })
    .then(async (res) => {
      const text = await res.text().catch(() => "");
      if (!res.ok) {
        throw new Error(text || "Failed to mark completed");
      }
      return text ? JSON.parse(text) : null;
    })
    .then((updated) => {
      patient.status = "COMPLETED";
      if (updated && typeof updated === "object" && updated.status) {
        patient.status = updated.status;
      }
      persistPatient();
      syncReportLockUi();
      window.ssdcAlert("Report marked as COMPLETED. Editing is locked.", { title: "Completed" });
    })
    .catch((err) => {
      console.error(err);
      if (btnComplete) {
        btnComplete.disabled = false;
      }
      window.ssdcAlert(err?.message || "Failed to mark completed", { title: "Error" });
    });
}

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
  patient.visitDate || (window.formatIstDateDisplay
    ? window.formatIstDateDisplay(new Date())
    : new Date().toLocaleDateString());

syncReportLockUi();

/* ================= RANGE CHECK ================= */
function isOutOfRange(value, normalText, gender){
  const valueText = value == null ? "" : String(value).trim();
  const normalValueText = normalizeNormalForDisplay(normalText);
  if (!valueText || !normalValueText) {
    return false;
  }

  const normalizedGender = normalizeGenderLabel(gender);
  const normalLines = splitNormalLines(normalValueText);
  const genderLines = filterGenderLines(normalLines, normalizedGender);

  // Numeric ranges (e.g. 13-17, <=5, >=2). If result is numeric, only use
  // numeric comparison; do not fall back to qualitative checks.
  const numMatch = valueText.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (numMatch) {
    const num = Number(numMatch[0]);
    if (Number.isFinite(num)) {
      const ranges = collectNumericRanges(
        genderLines.length ? genderLines : normalLines
      );
      if (!ranges.length && genderLines.length && genderLines !== normalLines) {
        ranges.push(...collectNumericRanges(normalLines));
      }
      if (!ranges.length) {
        return false;
      }
      return !ranges.some(range => isNumberWithinRange(num, range));
    }
    return false;
  }

  // Qualitative normals (e.g. Negative/Positive). Mark abnormal when value != normal.
  const valueComparable = normalizeComparableText(valueText);
  if (!valueComparable) {
    return false;
  }
  const allowed = genderLines
    .map(stripGenderPrefix)
    .map(line => normalizeNormalForDisplay(line))
    .flatMap(line => splitNormalLines(line))
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => line.length <= 40)
    .filter(line => !/\d/.test(line))
    .map(normalizeComparableText)
    .filter(Boolean);

  if (!allowed.length) {
    return false;
  }
  if (allowed.includes("any")) {
    return false;
  }
  return !allowed.includes(valueComparable);
}

function normalizeKey(value){
  return (value || "").trim().toLowerCase();
}

function normalizeGenderLabel(value){
  const text = String(value == null ? "" : value).trim().toLowerCase();
  if (!text) {
    return "";
  }
  if (text.includes("female") || text.startsWith("f")) {
    return "female";
  }
  if (text.includes("male") || text.startsWith("m")) {
    return "male";
  }
  return "";
}

function isNumberWithinRange(num, range){
  if (range == null || !Number.isFinite(num)) {
    return false;
  }
  const min = range.min;
  const max = range.max;

  if (min != null && Number.isFinite(min)) {
    if (range.minInclusive === false ? num <= min : num < min) {
      return false;
    }
  }

  if (max != null && Number.isFinite(max)) {
    if (range.maxInclusive === false ? num >= max : num > max) {
      return false;
    }
  }

  return true;
}

function collectNumericRanges(lines){
  const list = Array.isArray(lines) ? lines : [];
  const ranges = [];
  const seen = new Set();

  list.forEach(line => {
    const segments = String(line == null ? "" : line)
      .split(/\s+\/\s+/)
      .map(part => part.trim())
      .filter(Boolean);

    segments.forEach(segment => {
      const stripped = stripGenderPrefix(segment);
      const tail = stripped.split(":").slice(-1)[0] || stripped;
      const parsed = parseNormalRanges(tail).length
        ? parseNormalRanges(tail)
        : parseNormalRanges(stripped);

      parsed.forEach(range => {
        const min = range.min;
        const max = range.max;
        if (min != null && !Number.isFinite(min)) {
          return;
        }
        if (max != null && !Number.isFinite(max)) {
          return;
        }

        const key = `${min ?? ""}|${max ?? ""}|${range.minInclusive === false ? 0 : 1}|${range.maxInclusive === false ? 0 : 1}`;
        if (seen.has(key)) {
          return;
        }
        seen.add(key);
        ranges.push(range);
      });
    });
  });

  return ranges;
}

function splitNormalLines(value){
  return String(value == null ? "" : value)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

function stripGenderPrefix(value){
  return String(value == null ? "" : value)
    .replace(/^\s*[\[\(\{]*\s*(m\b|male\b|f\b|female\b)\s*:?\s*/i, "")
    .trim();
}

function normalizeComparableText(value){
  return String(value == null ? "" : value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function filterGenderLines(lines, gender){
  const list = Array.isArray(lines) ? lines : [];
  const hasGenderLines = list.some(line => {
    const text = String(line == null ? "" : line);
    return (
      /\b(male|female)\b/i.test(text)
      || /^\s*[\[\(\{]*\s*(m\b|m\s*:|f\b|f\s*:)/i.test(text)
    );
  });
  if (!hasGenderLines || !gender) {
    return list;
  }
  const pattern = gender === "female"
    ? /^\s*[\[\(\{]*\s*(f\b|f\s*:|female\b)/i
    : /^\s*[\[\(\{]*\s*(m\b|m\s*:|male\b)/i;
  const filtered = list.filter(line =>
    pattern.test(line) || new RegExp(`\\b${gender}\\b`, "i").test(line)
  );
  return filtered.length ? filtered : list;
}

function pickGenderNormalLine(normalText, gender){
  const lines = String(normalText == null ? "" : normalText)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  if (!lines.length) {
    return "";
  }

  const findLine = (pattern) => lines.find(line => pattern.test(line));
  if (gender === "male") {
    return (
      findLine(/^\s*(m\b|m\s*:|male\b)/i) ||
      findLine(/\bmale\b/i) ||
      lines[0]
    );
  }
  if (gender === "female") {
    return (
      findLine(/^\s*(f\b|f\s*:|female\b)/i) ||
      findLine(/\bfemale\b/i) ||
      lines[0]
    );
  }

  return lines[0];
}

function parseNormalRange(text){
  const ranges = parseNormalRanges(text);
  return ranges.length ? ranges[0] : null;
}

function parseNormalRanges(text){
  const rawText = String(text == null ? "" : text);
  // Remove thousands separators inside numbers (e.g. 11,000 -> 11000) but keep
  // commas used as separators between different normal values.
  const withoutThousands = rawText.replace(/(\d),(?=\d)/g, "$1");
  const raw = withoutThousands.replace(/,/g, " ");
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return [];
  }

  const ranges = [];

  const betweenRe =
    /(-?\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(-?\d+(?:\.\d+)?)/gi;
  let match;
  while ((match = betweenRe.exec(cleaned)) !== null) {
    ranges.push({
      min: Number(match[1]),
      max: Number(match[2]),
      minInclusive: true,
      maxInclusive: true
    });
  }

  const opRe =
    /(<=|>=|≤|≥|<|>)\s*(-?\d+(?:\.\d+)?)/g;
  while ((match = opRe.exec(cleaned)) !== null) {
    const op = match[1];
    const num = Number(match[2]);
    if (op === "<=" || op === "≤") {
      ranges.push({ max: num, maxInclusive: true });
    } else if (op === "<") {
      ranges.push({ max: num, maxInclusive: false });
    } else if (op === ">=" || op === "≥") {
      ranges.push({ min: num, minInclusive: true });
    } else if (op === ">") {
      ranges.push({ min: num, minInclusive: false });
    }
  }

  return ranges;
}

function normalizeText(value){
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

const categoryPriority =
  window.SSDC?.utils?.categoryPriority || ((_) => 99);

function normalizeNormalForDisplay(value){
  const text = normalizeText(value);
  if (!text) {
    return "";
  }
  return text.replace(/\r\n/g, "\n");
}

function splitLinesForTable(text){
  const raw = String(text == null ? "" : text);
  const parts = raw.split(/\r?\n/).map(p => p.trimEnd());
  const lines = parts.filter(p => p !== "");
  return lines.length ? lines : [""];
}

function pushRowsWithNormalLinesDom(frag, opts){
  const testId = opts?.testId;
  const col1Node = opts?.col1Node || null;
  const col1Text = opts?.col1Text ?? "";
  const col2Text = opts?.col2Text ?? "";
  const col3Text = opts?.col3Text ?? "";
  const col1Class = opts?.col1Class ?? "";
  const col2Class = opts?.col2Class ?? "";
  const col3Class = opts?.col3Class ?? "";
  const normalText = opts?.normalText ?? "";

  const normalLines = splitLinesForTable(normalText);

  const makeRow = (normalLine, first) => {
    const tr = document.createElement("tr");
    if (testId != null) {
      tr.dataset.testid = String(testId);
    }

    const td1 = document.createElement("td");
    const td2 = document.createElement("td");
    const td3 = document.createElement("td");
    const td4 = document.createElement("td");

    if (first) {
      if (col1Node) {
        td1.appendChild(col1Node);
      } else {
        td1.textContent = col1Text == null ? "" : String(col1Text);
      }
      td2.textContent = col2Text == null ? "" : String(col2Text);
      td3.textContent = col3Text == null ? "" : String(col3Text);
      if (col1Class) td1.className = col1Class;
      if (col2Class) td2.className = col2Class;
      if (col3Class) td3.className = col3Class;
    }

    td4.textContent = normalLine == null ? "" : String(normalLine);

    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
    tr.appendChild(td4);
    frag.appendChild(tr);
  };

  makeRow(normalLines[0] || "", true);
  for (let i = 1; i < normalLines.length; i++) {
    makeRow(normalLines[i] || "", false);
  }
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
    .map(normalizeNormalForDisplay);
  if (testNormals.length) {
    // IMPORTANT: keep index alignment with parameters.
    // Do not filter empty strings before index lookup, otherwise values "shift"
    // to the wrong parameter when some parameters have no normal values.
    if (typeof index === "number") {
      return testNormals[index] || "";
    }
    const filtered = testNormals.filter(Boolean);
    if (filtered.length) {
      return normalizeNormalForDisplay(filtered.join("\n"));
    }
  }

  return normalizeNormalForDisplay(test?.normalValue || test?.normal_value);
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

function lineSortKey(key){
  if (!key || key === "__single__") {
    return 0;
  }
  const match = String(key).match(/::\s*(.+)\s*$/);
  if (!match) {
    return 1;
  }
  const suffix = match[1];
  const n = Number(suffix);
  if (!Number.isNaN(n) && Number.isFinite(n)) {
    return n;
  }
  const extra = String(suffix).match(/^extra-(\d+)$/i);
  if (extra) {
    return 1000 + Number(extra[1]);
  }
  return 2000;
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
      const fromApi = (list || [])
        .map(x => Number(x.testId))
        .filter(id => !Number.isNaN(id));
      // Don't let a partial API response overwrite a more complete cached selection.
      // (e.g., when coming from enter-values and selectedTests is already known)
      const cached = readCachedSelectedTests();
      const merged = [...new Set([...cached, ...fromApi])]
        .filter(id => Number.isFinite(id));
      selectedTestIds = merged;
      try {
        localStorage.setItem("selectedTests", JSON.stringify(selectedTestIds));
      } catch (e) {
        // ignore storage errors
      }
      return selectedTestIds;
    })
    .catch(() => {
      selectedTestIds = readCachedSelectedTests();
      return selectedTestIds;
    });
}

function deriveSelectedFromResults(){
  const ids = new Set(
    results.map(r => Number(r.testId)).filter(id => !Number.isNaN(id))
  );
  return [...ids];
}

const TESTS_CACHE_KEY = "testsActiveCache";
const TESTS_CACHE_AT_KEY = "testsActiveCacheAt";
const GROUPS_CACHE_KEY = "groupsCache";

function readStorageJson(key, fallback){
  const fn = window.SSDC?.utils?.readStorageJson;
  return typeof fn === "function" ? fn(key, fallback) : fallback;
}

function writeStorageJson(key, value){
  const fn = window.SSDC?.utils?.writeStorageJson;
  if (typeof fn === "function") {
    fn(key, value);
  }
}

function readCachedResults(){
  const list = readStorageJson("patientResults", []);
  return Array.isArray(list) ? list : [];
}

function readCachedSelectedTests(){
  const list = readStorageJson("selectedTests", []);
  return (Array.isArray(list) ? list : [])
    .map(id => Number(id))
    .filter(id => Number.isFinite(id));
}

function readCachedTests(){
  const list = readStorageJson(TESTS_CACHE_KEY, []);
  return Array.isArray(list) ? list : [];
}

function readCachedGroups(){
  const list = readStorageJson(GROUPS_CACHE_KEY, []);
  return Array.isArray(list) ? list : [];
}

function deriveSelectedFromResultsList(list){
  const ids = new Set(
    (Array.isArray(list) ? list : [])
      .map(r => Number(r?.testId))
      .filter(id => Number.isFinite(id))
  );
  return [...ids];
}

function loadGroupsAll(){
  return fetch(API_BASE_URL + "/groups")
    .then(res => res.json())
    .then(list => {
      const groups = Array.isArray(list) ? list : [];
      writeStorageJson(GROUPS_CACHE_KEY, groups);
      return groups;
    })
    .catch(() => readCachedGroups());
}

function loadTestsActive(){
  return fetch(API_BASE_URL + "/tests/active")
    .then(res => res.json())
    .then(list => {
      const tests = Array.isArray(list) ? list : [];
      writeStorageJson(TESTS_CACHE_KEY, tests);
      try {
        localStorage.setItem(TESTS_CACHE_AT_KEY, String(Date.now()));
      } catch (e) {
        // ignore
      }
      return tests;
    })
    .catch(() => readCachedTests());
}

function renderReport(tests, resultList, selectedIds, groupList){
  const body = document.getElementById("reportBody");
  if (!body) {
    return;
  }

  const safeTests = Array.isArray(tests) ? tests : [];
  const safeResults = Array.isArray(resultList) ? resultList : [];
  const safeGroups = Array.isArray(groupList) ? groupList : [];
  const ids = (Array.isArray(selectedIds) && selectedIds.length)
    ? selectedIds
    : deriveSelectedFromResultsList(safeResults);

  if (!ids.length) {
    appendMessageRow(body, "No results found");
    renderScreenPages();
    return;
  }
  if (!safeTests.length) {
    appendMessageRow(body, "Loading report...");
    renderScreenPages();
    return;
  }

  const selectedTests = safeTests.filter(t => ids.includes(Number(t?.id)));
  if (!selectedTests.length) {
    appendMessageRow(body, "No tests found");
    renderScreenPages();
    return;
  }

  const selectionIndex = new Map();
  ids.forEach((id, index) => {
    const n = Number(id);
    if (Number.isFinite(n) && !selectionIndex.has(n)) {
      selectionIndex.set(n, index);
    }
  });

  const defaultKeyByTestId = new Map();
  safeTests.forEach((t, index) => {
    const id = Number(t?.id);
    if (!Number.isFinite(id)) {
      return;
    }
    defaultKeyByTestId.set(id, {
      categoryRank: categoryPriority(t?.category),
      index,
      name: String(t?.testName || "")
    });
  });

  selectedTests.sort((a, b) => {
    const aId = Number(a?.id);
    const bId = Number(b?.id);
    const ak = defaultKeyByTestId.get(aId);
    const bk = defaultKeyByTestId.get(bId);
    const ar = ak?.categoryRank ?? 99;
    const br = bk?.categoryRank ?? 99;
    if (ar !== br) return ar - br;
    // Within the same category, keep the original selection order (first selected comes first).
    const ai = selectionIndex.has(aId) ? selectionIndex.get(aId) : Number.MAX_SAFE_INTEGER;
    const bi = selectionIndex.has(bId) ? selectionIndex.get(bId) : Number.MAX_SAFE_INTEGER;
    if (ai !== bi) return ai - bi;
    return (ak?.index ?? 0) - (bk?.index ?? 0);
  });

  safeResults.sort((a, b) => (a?.id || 0) - (b?.id || 0));

  const grouped = {};
  safeResults.forEach(r => {
    const tid = r?.testId;
    if (!tid) {
      return;
    }
    if(!grouped[tid]) grouped[tid] = {};
    const key = r.subTest || "__single__";
    grouped[tid][key] = r;
  });

  const frag = document.createDocumentFragment();

  const selectedIdSet = new Set(
    ids.map(id => Number(id)).filter(id => Number.isFinite(id))
  );

  const testById = new Map();
  safeTests.forEach(test => {
    const id = Number(test?.id);
    if (Number.isFinite(id)) {
      testById.set(id, test);
    }
  });

  function parseReportLayout(value){
    if (!value) {
      return null;
    }
    if (typeof value === "object") {
      return value;
    }
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch (err) {
        return null;
      }
    }
    return null;
  }

  function normalizeReportLayout(value){
    const layout = parseReportLayout(value);
    if (!layout || Number(layout.version) !== 1) {
      return null;
    }
    const directTestIds = Array.isArray(layout.directTestIds) ? layout.directTestIds : [];
    const subGroups = Array.isArray(layout.subGroups) ? layout.subGroups : [];
    if (!directTestIds.length && !subGroups.length) {
      return null;
    }
    return { directTestIds, subGroups };
  }

  function buildIndentedTextNode(text, indentLevel){
    const span = document.createElement("span");
    appendIndentText(span, indentLevel);
    span.appendChild(document.createTextNode(text == null ? "" : String(text)));
    return span;
  }

  function appendHeaderRow(testId, className, indentLevel, contentBuilder){
    const tr = document.createElement("tr");
    if (className) {
      tr.className = className;
    }
    if (testId != null) {
      tr.dataset.testid = String(testId);
    }
    const td = document.createElement("td");
    td.colSpan = 4;
    appendIndentText(td, indentLevel);
    if (typeof contentBuilder === "function") {
      contentBuilder(td);
    }
    tr.appendChild(td);
    frag.appendChild(tr);
  }

  function renderOneTest(test, indentLevel){
    const testId = Number(test?.id);
    if (!Number.isFinite(testId)) {
      return;
    }
    const indent = Math.max(0, Number(indentLevel) || 0);
    const showTestNameInReport = test?.showTestNameInReport !== false;

    const params = Array.isArray(test.parameters) ? test.parameters : [];
    const hasParams = params.length > 0;
    const rawItemMap = grouped[testId] || {};
    const hasLineSlots = Object.keys(rawItemMap)
      .some(key => key && String(key).includes("::"));
    const isMultiParam = hasParams && params.length > 1;
    const isMultiUnits =
      !hasParams && asArray(test.units || test.testUnits).length > 1;
    const isSingleWithLines = hasParams && params.length === 1 && hasLineSlots;

    if (isSingleWithLines) {
      const param = params[0] || {};
      const unitText = resolveUnitText(test, param, 0);
      const normalText = resolveNormalText(test, param, 0);

      const lines = Object.entries(rawItemMap)
        .filter(([, item]) => {
          const value = item?.resultValue || "";
          return value && value.trim() !== "";
        })
        .sort(([a], [b]) => lineSortKey(a) - lineSortKey(b));

      lines.forEach(([, item], index) => {
        const value = item?.resultValue || "";
        const abnormal = isOutOfRange(value, normalText, patient.gender);

        // For multi-line single tests: show normal values only once (first row),
        // and split normal values into separate bordered rows.
        if (index === 0) {
          pushRowsWithNormalLinesDom(frag, {
            testId: testId,
            col1Node: buildIndentedTextNode(test.testName || "", indent),
            col2Text: value,
            col3Text: unitText,
            col2Class: abnormal ? "is-abnormal" : "",
            normalText
          });
          return;
        }

        const tr = document.createElement("tr");
        tr.dataset.testid = String(testId);
        const td1 = document.createElement("td");
        const td2 = document.createElement("td");
        const td3 = document.createElement("td");
        const td4 = document.createElement("td");
        td2.textContent = value;
        if (abnormal) {
          td2.className = "is-abnormal";
        }
        td3.textContent = unitText;
        tr.appendChild(td1);
        tr.appendChild(td2);
        tr.appendChild(td3);
        tr.appendChild(td4);
        frag.appendChild(tr);
      });
      return;
    }

    if (isMultiParam || isMultiUnits) {
      const hideHeaderRow = isMultiParam && !showTestNameInReport;
      if (!hideHeaderRow) {
        appendHeaderRow(testId, "test-header-row", indent, (td) => {
          td.appendChild(document.createTextNode(test.testName || ""));
        });
      }

      const normalizedItems = {};
      Object.entries(rawItemMap).forEach(([key, value]) => {
        const normalized = normalizeKey(key === "__single__" ? "" : key);
        normalizedItems[normalized] = value;
      });

      const rows = isMultiParam
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
            appendHeaderRow(testId, "section-header", indent, (td) => {
              td.appendChild(document.createTextNode(sectionName));
            });
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

          const abnormal = isOutOfRange(
            valueForDisplay,
            normalText,
            patient.gender
          );

          const labelNode = buildIndentedTextNode(slot.label || "", indent);
          pushRowsWithNormalLinesDom(frag, {
            testId: testId,
            col1Node: labelNode,
            col1Class: "param-indent",
            col2Text: displayValue,
            col2Class: abnormal ? "is-abnormal" : "",
            col3Text: unitText,
            normalText
          });
        });
      });
      return;
    }

    let item = rawItemMap["__single__"];
    if (!item) {
      const fallbackKey = Object.keys(rawItemMap)
        .find(k => k && !String(k).includes("::"));
      item = fallbackKey ? rawItemMap[fallbackKey] : null;
    }
    const normalText = resolveNormalText(test, params[0] || {});
    const resultValue = item?.resultValue || "";

    const abnormal = isOutOfRange(
      resultValue,
      normalText,
      patient.gender
    );

    const unit = resolveUnitText(test, params[0] || {}, 0);

    pushRowsWithNormalLinesDom(frag, {
      testId: testId,
      col1Node: buildIndentedTextNode(test.testName || "", indent),
      col2Text: resultValue,
      col2Class: abnormal ? "is-abnormal" : "",
      col3Text: unit,
      normalText
    });
  }

  const normalizedGroups = safeGroups
    .map(group => {
      const id = Number(group?.id);
      if (!Number.isFinite(id)) {
        return null;
      }
      const ids = Array.isArray(group.testIds) ? group.testIds : [];
      const testIds = ids
        .map(testId => Number(testId))
        .filter(testId => Number.isFinite(testId));
      return { ...group, id, testIds };
    })
    .filter(group => group && Array.isArray(group.testIds) && group.testIds.length);

  const groupById = new Map(normalizedGroups.map(group => [Number(group.id), group]));

  const layoutCandidates = normalizedGroups
    .map(group => {
      const layout = normalizeReportLayout(group.reportLayout);
      if (!layout) {
        return null;
      }
      const allSelected = group.testIds.every(id => selectedIdSet.has(id));
      if (!allSelected) {
        return null;
      }
      return { ...group, __layout: layout };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const diff = (b.testIds?.length || 0) - (a.testIds?.length || 0);
      if (diff !== 0) return diff;
      return (Number(a.id) || 0) - (Number(b.id) || 0);
    });

  const selectedGroups = [];
  const covered = new Set();
  layoutCandidates.forEach(group => {
    if (group.testIds.some(id => covered.has(id))) {
      return;
    }
    selectedGroups.push(group);
    group.testIds.forEach(id => covered.add(id));
  });

  function minSelectionIndexForIds(testIds){
    let min = Number.MAX_SAFE_INTEGER;
    (Array.isArray(testIds) ? testIds : []).forEach(id => {
      const value = selectionIndex.get(id);
      if (typeof value === "number" && value < min) {
        min = value;
      }
    });
    return min;
  }

  selectedGroups.sort((a, b) => {
    const aMin = minSelectionIndexForIds(a.testIds);
    const bMin = minSelectionIndexForIds(b.testIds);
    if (aMin !== bMin) return aMin - bMin;
    return String(a.groupName || "").localeCompare(String(b.groupName || ""));
  });

  const rendered = new Set();

  function resolveSubGroupName(sub){
    const groupId = Number(sub?.groupId);
    const group = Number.isFinite(groupId) ? groupById.get(groupId) : null;
    return String(group?.groupName || sub?.groupName || "Group").trim() || "Group";
  }

  function renderGroupWithLayout(group){
    const layout = group.__layout;
    const groupShowName = group?.showGroupName !== false;
    const groupTestSet = new Set((group.testIds || []).map(id => Number(id)).filter(id => Number.isFinite(id)));

    const directIds = [];
    (layout.directTestIds || [])
      .map(id => Number(id))
      .filter(id => Number.isFinite(id)
        && selectedIdSet.has(id)
        && groupTestSet.has(id)
        && testById.has(id)
        && !rendered.has(id))
      .forEach(id => {
        directIds.push(id);
        rendered.add(id);
      });

    const subGroups = [];
    (layout.subGroups || []).forEach(sub => {
      const raw = Array.isArray(sub?.testIds) ? sub.testIds : [];
      const testIds = raw
        .map(id => Number(id))
        .filter(id => Number.isFinite(id)
          && selectedIdSet.has(id)
          && groupTestSet.has(id)
          && testById.has(id)
          && !rendered.has(id));

      if (!testIds.length) {
        return;
      }
      testIds.forEach(id => rendered.add(id));

      subGroups.push({
        groupId: Number(sub?.groupId),
        showName: sub?.showName !== false,
        name: resolveSubGroupName(sub),
        testIds
      });
    });

    const remainingIds = (group.testIds || [])
      .map(id => Number(id))
      .filter(id => Number.isFinite(id)
        && selectedIdSet.has(id)
        && testById.has(id)
        && !rendered.has(id));
    remainingIds.forEach(id => rendered.add(id));

    const firstTestId =
      directIds[0]
      || subGroups[0]?.testIds?.[0]
      || remainingIds[0]
      || null;

    if (!firstTestId) {
      // No renderable tests (inactive/missing master data). Undo coverage marks.
      directIds.forEach(id => rendered.delete(id));
      subGroups.forEach(sub => sub.testIds.forEach(id => rendered.delete(id)));
      remainingIds.forEach(id => rendered.delete(id));
      return;
    }

    if (groupShowName) {
      appendHeaderRow(firstTestId, "group-header-row", 0, (td) => {
        const h4 = document.createElement("h4");
        h4.className = "group-heading";
        h4.textContent = group.groupName || "Group";
        td.appendChild(h4);
      });
    }

    directIds.forEach(id => {
      renderOneTest(testById.get(id), 0);
    });

    subGroups.forEach(sub => {
      const attachId = sub.testIds[0];
      if (sub.showName) {
        const sectionIndent = groupShowName ? 1 : 0;
        appendHeaderRow(attachId, "section-header", sectionIndent, (td) => {
          const b = document.createElement("b");
          b.textContent = sub.name;
          td.appendChild(b);
        });
      }

      const subIndent = sub.showName
        ? (groupShowName ? 2 : 1)
        : 0;
      sub.testIds.forEach(id => {
        renderOneTest(testById.get(id), subIndent);
      });
    });

    remainingIds.forEach(id => {
      renderOneTest(testById.get(id), 0);
    });
  }

  selectedGroups.forEach(group => renderGroupWithLayout(group));

  const remainingTests = selectedTests
    .filter(test => {
      const id = Number(test?.id);
      return Number.isFinite(id) && !rendered.has(id);
    });

  remainingTests.forEach(test => {
    renderOneTest(test, 0);
  });

  clearNode(body);
  body.appendChild(frag);
  renderScreenPages();
}

/* ================= FAST CACHE RENDER ================= */
const cachedResults = readCachedResults();
const cachedSelectedIds = readCachedSelectedTests();
const cachedTests = readCachedTests();
const cachedGroups = readCachedGroups();

if (cachedResults.length || cachedSelectedIds.length) {
  renderReport(cachedTests, cachedResults, cachedSelectedIds, cachedGroups);
} else {
  const body = document.getElementById("reportBody");
  if (body) {
    appendMessageRow(body, "Loading report...");
  }
  renderScreenPages();
}

/* ================= REFRESH FROM API (PARALLEL) ================= */
Promise.all([loadResults(), loadSelectedTests(), loadTestsActive(), loadGroupsAll()])
  .then(([freshResults, freshSelectedIds, freshTests, freshGroups]) => {
    renderReport(freshTests, freshResults, freshSelectedIds, freshGroups);
  });

/* ================= ACTIONS ================= */
function goPatients(){
  parent.loadPage("home/sub-tasks/2-patient.html");
}

// Inline handler replacements (CSP-safe)
{
  const btnBack = document.getElementById("btnBack");
  if (btnBack) {
    btnBack.addEventListener("click", goPatients);
  }
  const btnComplete = document.getElementById("btnComplete");
  if (btnComplete) {
    btnComplete.addEventListener("click", markCompleted);
  }
  const btnPrint = document.getElementById("btnPrint");
  if (btnPrint) {
    btnPrint.addEventListener("click", printLetterhead);
  }
  const btnDownload = document.getElementById("btnDownload");
  if (btnDownload) {
    btnDownload.addEventListener("click", downloadPDF);
  }
  const btnWhatsapp = document.getElementById("btnWhatsapp");
  if (btnWhatsapp) {
    btnWhatsapp.addEventListener("click", shareWhatsApp);
  }
}

function downloadPDF(){
  setReportMode("pdf").then(() => nextPaint()).then(() => {
    window.print(); // browser save as PDF
  });
}

/* ================= PRINT (LETTERHEAD) ================= */
const defaultPrintSettings = {
  topLines: 0,
  bottomLines: 0,
  leftLines: 0,
  rightLines: 0
};

let cachedPrintSettings = { ...defaultPrintSettings };
let cachedPrintSettingsLoaded = false;
let restoreModeAfterPrint = null;

function clampLines(value){
  const n = Number.parseInt(String(value ?? "0"), 10);
  if (!Number.isFinite(n) || Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 200) return 200;
  return n;
}

function applyLetterheadCssVars(settings){
  const s = settings || defaultPrintSettings;
  document.documentElement.style.setProperty(
    "--ssdc-letterhead-top-lines",
    String(clampLines(s.topLines))
  );
  document.documentElement.style.setProperty(
    "--ssdc-letterhead-bottom-lines",
    String(clampLines(s.bottomLines))
  );
  document.documentElement.style.setProperty(
    "--ssdc-letterhead-left-lines",
    String(clampLines(s.leftLines))
  );
  document.documentElement.style.setProperty(
    "--ssdc-letterhead-right-lines",
    String(clampLines(s.rightLines))
  );
}

function loadPrintSettingsOnce(){
  if (cachedPrintSettingsLoaded) {
    return Promise.resolve(cachedPrintSettings);
  }
  return fetch(API_BASE_URL + "/print-settings")
    .then((res) => {
      if (!res.ok) {
        throw new Error("Failed to load print settings");
      }
      return res.json();
    })
    .then((data) => {
      cachedPrintSettings = {
        topLines: clampLines(data?.topLines),
        bottomLines: clampLines(data?.bottomLines),
        leftLines: clampLines(data?.leftLines),
        rightLines: clampLines(data?.rightLines)
      };
      cachedPrintSettingsLoaded = true;
      return cachedPrintSettings;
    })
    .catch(() => {
      cachedPrintSettingsLoaded = true;
      cachedPrintSettings = { ...defaultPrintSettings };
      return cachedPrintSettings;
    });
}

function nextPaint(){
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function getReportMode(){
  return (document.body?.dataset?.reportMode || "pdf").toLowerCase();
}

function setReportMode(mode){
  const normalized = String(mode || "pdf").toLowerCase();
  document.body.dataset.reportMode = normalized;

  if (normalized === "letterhead") {
    return loadPrintSettingsOnce().then((settings) => {
      applyLetterheadCssVars(settings);
      renderScreenPages();
    });
  }

  renderScreenPages();
  return Promise.resolve();
}

function printLetterhead(){
  const before = getReportMode();
  restoreModeAfterPrint = before || "pdf";
  setReportMode("letterhead").then(() => nextPaint()).then(() => {
    window.print();
  });
}

window.addEventListener("afterprint", () => {
  if (!restoreModeAfterPrint) {
    return;
  }
  const toRestore = restoreModeAfterPrint;
  restoreModeAfterPrint = null;
  setReportMode(toRestore);
});

function shareWhatsApp(){
  let mobile = (patient.mobile || "").replace(/\D/g, "");

  if(!mobile){
    window.ssdcAlert("Patient mobile number not available", { title: "Missing Mobile" });
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

/* ================= SCREEN (A4 NEO-CARDS) ================= */
function isHeaderLikeRow(row){
  if (!row || row.nodeType !== 1) {
    return false;
  }
  if (row.classList.contains("section-header")) {
    return true;
  }
  const tds = row.querySelectorAll("td");
  if (tds.length === 1) {
    const colspan = tds[0]?.getAttribute("colspan");
    return String(colspan || "") === "4";
  }
  return false;
}

function buildPatientBoxNode(){
  const pName = document.getElementById("pName")?.textContent || "";
  const pDate = document.getElementById("pDate")?.textContent || "";
  const pAddress = document.getElementById("pAddress")?.textContent || "";
  const pAgeSex = document.getElementById("pAgeSex")?.textContent || "";
  const pDoctor = document.getElementById("pDoctor")?.textContent || "";
  const pMobile = document.getElementById("pMobile")?.textContent || "";

  const makeField = (labelText, valueText) => {
    const wrap = document.createElement("div");
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = labelText;
    wrap.appendChild(label);
    wrap.appendChild(document.createTextNode(" : "));
    const value = document.createElement("span");
    value.textContent = valueText == null ? "" : String(valueText);
    wrap.appendChild(value);
    return wrap;
  };

  const box = document.createElement("div");
  box.className = "patient-box";

  const row1 = document.createElement("div");
  row1.className = "row";
  row1.appendChild(makeField("PATIENT", pName));
  row1.appendChild(makeField("DATE", pDate));

  const row2 = document.createElement("div");
  row2.className = "row";
  row2.appendChild(makeField("ADDRESS", pAddress));
  row2.appendChild(makeField("AGE / SEX", pAgeSex));

  const row3 = document.createElement("div");
  row3.className = "row";
  row3.appendChild(makeField("REF BY Dr.", pDoctor));
  row3.appendChild(makeField("MOBILE", pMobile));

  box.appendChild(row1);
  box.appendChild(row2);
  box.appendChild(row3);
  return box;
}

function buildHeaderNode(){
  const header = document.createElement("div");
  header.className = "header";

  const h2 = document.createElement("h2");
  h2.setAttribute("spellcheck", "false");
  h2.setAttribute("data-ssdc-lab-name", "");
  h2.textContent = "SAI SREE SWETHA DIAGNOSTICS";

  const p = document.createElement("p");
  const b = document.createElement("b");
  b.textContent = "BLOOD EXAMINATION REPORT";
  p.appendChild(b);

  header.appendChild(h2);
  header.appendChild(p);
  return header;
}

function renderScreenPages(){
  const pages = document.getElementById("reportPages");
  const tbody = document.getElementById("reportBody");
  const printCard = document.querySelector(".report-print-card");

  if (!pages || !tbody || !printCard) {
    return;
  }

  const mode = getReportMode();

  const colsRow = printCard.querySelector(".report-table thead .report-cols");
  const footerLegend = printCard.querySelector(".report-table tfoot .legend");
  const footerBlock = printCard.querySelector(".report-table tfoot .report-footer");
  const sourceRows = Array.from(tbody.querySelectorAll("tr"));

  clearNode(pages);

  if (!sourceRows.length) {
    return;
  }

  const showHeader = mode !== "letterhead";

  const colsFallback = () => {
    const tr = document.createElement("tr");
    tr.className = "report-cols";
    ["TEST", "RESULT", "UNIT", "NORMAL VALUES"].forEach(text => {
      const th = document.createElement("th");
      th.textContent = text;
      tr.appendChild(th);
    });
    return tr;
  };

  function createPage(){
    const card = document.createElement("div");
    card.className = "neo-card report-page-card" + (mode === "letterhead" ? " is-letterhead" : "");

    const content = document.createElement("div");
    content.className = "report-page-content";

    if (showHeader) {
      content.appendChild(buildHeaderNode());
    }

    const patient = document.createElement("div");
    patient.appendChild(buildPatientBoxNode());

    const tableWrap = document.createElement("div");
    tableWrap.className = "report-page-table-wrap";

    const table = document.createElement("table");
    table.className = "report-table";

    const thead = document.createElement("thead");
    thead.appendChild(colsRow ? colsRow.cloneNode(true) : colsFallback());

    const pageBody = document.createElement("tbody");

    table.appendChild(thead);
    table.appendChild(pageBody);
    tableWrap.appendChild(table);

    const footer = document.createElement("div");
    footer.className = "report-page-footer";
    if (footerLegend) {
      footer.appendChild(footerLegend.cloneNode(true));
    }
    if (footerBlock) {
      footer.appendChild(footerBlock.cloneNode(true));
    }

    content.appendChild(patient);
    content.appendChild(tableWrap);
    content.appendChild(footer);

    card.appendChild(content);
    pages.appendChild(card);

    return { tableWrap, pageBody };
  }

  // Build contiguous blocks by test id so we can keep groups together.
  const blocks = [];
  let currentBlock = null;
  sourceRows.forEach((srcRow) => {
    const testId = srcRow.dataset?.testid || "";
    if (!currentBlock || currentBlock.testId !== testId) {
      currentBlock = {
        testId,
        isGroup: false,
        rows: []
      };
      blocks.push(currentBlock);
    }
    const cloned = srcRow.cloneNode(true);
    if (cloned.classList && cloned.classList.contains("test-header-row")) {
      currentBlock.isGroup = true;
    }
    currentBlock.rows.push(cloned);
  });

  const fits = (page) =>
    page.tableWrap.scrollHeight <= page.tableWrap.clientHeight + 1;

  const appendBlock = (page, block) => {
    block.rows.forEach(r => page.pageBody.appendChild(r));
  };

  const removeBlock = (page, block) => {
    block.rows.forEach(r => {
      if (r.parentNode === page.pageBody) {
        page.pageBody.removeChild(r);
      }
    });
  };

  let current = createPage();
  const pending = blocks.slice();

  const placeRowsAcrossPages = (rows, startPage) => {
    let page = startPage;
    let carry = [];
    rows.forEach(srcRow => {
      const row = srcRow;
      page.pageBody.appendChild(row);

      const overflow = !fits(page);
      if (overflow) {
        page.pageBody.removeChild(row);

        const toMove = carry.length ? carry.slice() : [];
        carry.length = 0;
        toMove.forEach(node => {
          if (node.parentNode === page.pageBody) {
            page.pageBody.removeChild(node);
          }
        });

        page = createPage();
        toMove.forEach(node => page.pageBody.appendChild(node));
        page.pageBody.appendChild(row);
      }

      if (isHeaderLikeRow(row)) {
        carry.push(row);
      } else {
        carry.length = 0;
      }
    });
    return page;
  };

  while (pending.length) {
    const block = pending[0];
    appendBlock(current, block);

    if (fits(current)) {
      pending.shift();
      continue;
    }

    // Overflow
    removeBlock(current, block);

    // If page is empty, we must place it anyway (very large block); fall back to row behavior.
    if (!current.pageBody.children.length) {
      pending.shift();
      current = placeRowsAcrossPages(block.rows, current);
      current = createPage();
      continue;
    }

    // Special rule: if a GROUP would split, move it to next page and try to fill remaining space
    // with any later blocks that fit.
    if (block.isGroup) {
      const deferred = pending.shift();

      let movedAny = true;
      while (movedAny) {
        movedAny = false;
        for (let i = 0; i < pending.length; i++) {
          const candidate = pending[i];
          appendBlock(current, candidate);
          if (fits(current)) {
            pending.splice(i, 1);
            movedAny = true;
            break;
          }
          removeBlock(current, candidate);
        }
      }

      current = createPage();
      pending.unshift(deferred);
      continue;
    }

    // Non-group: start a new page and retry.
    current = createPage();
  }

  if (typeof window.applyLabNameToDom === "function") {
    window.applyLabNameToDom();
  }
}

window.addEventListener("resize", () => {
  renderScreenPages();
});
