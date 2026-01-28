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

function normalizeNormalForDisplay(value){
  const text = normalizeText(value);
  if (!text) {
    return "";
  }
  // Backend joins multiple normal values with " / ". Show them on new lines.
  return text.replace(/\s+\/\s+/g, "\n");
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
      selectedTestIds = (list || [])
        .map(x => Number(x.testId))
        .filter(id => !Number.isNaN(id));
      try {
        localStorage.setItem("selectedTests", JSON.stringify(selectedTestIds));
      } catch (e) {
        // ignore storage errors
      }
      return selectedTestIds;
    })
    .catch(() => {
      const stored =
        JSON.parse(localStorage.getItem("selectedTests") || "[]");
      selectedTestIds = (stored || [])
        .map(id => Number(id))
        .filter(id => Number.isFinite(id));
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

function readStorageJson(key, fallback){
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function writeStorageJson(key, value){
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // ignore
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

function deriveSelectedFromResultsList(list){
  const ids = new Set(
    (Array.isArray(list) ? list : [])
      .map(r => Number(r?.testId))
      .filter(id => Number.isFinite(id))
  );
  return [...ids];
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

function renderReport(tests, resultList, selectedIds){
  const body = document.getElementById("reportBody");
  if (!body) {
    return;
  }

  const safeTests = Array.isArray(tests) ? tests : [];
  const safeResults = Array.isArray(resultList) ? resultList : [];
  const ids = (Array.isArray(selectedIds) && selectedIds.length)
    ? selectedIds
    : deriveSelectedFromResultsList(safeResults);

  if (!ids.length) {
    body.innerHTML = `<tr><td colspan="4">No results found</td></tr>`;
    return;
  }
  if (!safeTests.length) {
    body.innerHTML = `<tr><td colspan="4">Loading report...</td></tr>`;
    return;
  }

  const selectedTests = safeTests.filter(t => ids.includes(Number(t?.id)));
  if (!selectedTests.length) {
    body.innerHTML = `<tr><td colspan="4">No tests found</td></tr>`;
    return;
  }

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

  const out = [];

  selectedTests.forEach(test => {
    const params = Array.isArray(test.parameters) ? test.parameters : [];
    const hasParams = params.length > 0;
    const rawItemMap = grouped[test.id] || {};
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

        out.push(`
          <tr>
            <td>${index === 0 ? `<b>${escapeHtml(test.testName)}</b>` : ""}</td>
            <td class="${abnormal ? "is-abnormal" : ""}">${escapeHtml(value)}</td>
            <td>${escapeHtml(unitText)}</td>
            <td>${formatHtmlLines(normalText)}</td>
          </tr>
        `);
      });
      return;
    }

    if (isMultiParam || isMultiUnits) {
      out.push(`
        <tr>
          <td colspan="4"><b>${escapeHtml(test.testName)}</b></td>
        </tr>
      `);

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
            out.push(`
              <tr class="section-header">
                <td colspan="4">${escapeHtml(sectionName)}</td>
              </tr>
            `);
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

          out.push(`
            <tr>
              <td class="param-indent">${escapeHtml(slot.label)}</td>
              <td class="${abnormal ? "is-abnormal" : ""}">
                ${escapeHtml(displayValue)}
              </td>
              <td>${escapeHtml(unitText)}</td>
              <td>${formatHtmlLines(normalText)}</td>
            </tr>
          `);
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

    out.push(`
      <tr>
        <td><b>${escapeHtml(test.testName)}</b></td>
        <td class="${abnormal ? "is-abnormal" : ""}">
          ${escapeHtml(resultValue)}
        </td>
        <td>${escapeHtml(unit)}</td>
        <td>${formatHtmlLines(normalText)}</td>
      </tr>
    `);
  });

  body.innerHTML = out.join("");
}

/* ================= FAST CACHE RENDER ================= */
const cachedResults = readCachedResults();
const cachedSelectedIds = readCachedSelectedTests();
const cachedTests = readCachedTests();

if (cachedResults.length || cachedSelectedIds.length) {
  renderReport(cachedTests, cachedResults, cachedSelectedIds);
} else {
  const body = document.getElementById("reportBody");
  if (body) {
    body.innerHTML = `<tr><td colspan="4">Loading report...</td></tr>`;
  }
}

/* ================= REFRESH FROM API (PARALLEL) ================= */
Promise.all([loadResults(), loadSelectedTests(), loadTestsActive()])
  .then(([freshResults, freshSelectedIds, freshTests]) => {
    renderReport(freshTests, freshResults, freshSelectedIds);
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
