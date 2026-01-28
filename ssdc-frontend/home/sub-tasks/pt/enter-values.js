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
        renderTests(selectedTests);
      });
  });

function normalizeKey(value){
  return (value || "").trim().toLowerCase();
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
        <tr${groupKey ? ` data-line-group="${escapeAttr(groupKey)}"` : ""}>
          <td><b>${escapeHtml(test.testName)}</b></td>
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
            <tr data-line-group="${escapeAttr(groupKey)}">
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
            <tr data-line-group="${escapeAttr(groupKey)}">
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
      `<tr><td colspan="4"><b>${escapeHtml(test.testName)}</b></td></tr>`;

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
            <tr class="section-header">
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
          <tr${groupKey ? ` data-line-group="${escapeAttr(groupKey)}"` : ""}>
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
}
