/* === THEME INIT (inlined) === */
(function () {
  try {
    const stored = localStorage.getItem("darkMode");
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = stored === "enabled" ? true : stored === "disabled" ? false : prefersDark;
    document.body.classList.toggle("dark", isDark);
  } catch {
    /* noop */
  }
})();
/* === API INIT (inlined) === */
(function () {
  const defaultBase = "/api";
  let stored = null;
  if (window.localStorage) {
    stored = window.localStorage.getItem("SSDC_API_BASE_URL");
  }
  if (stored) {
    stored = stored.trim();
  }
  const isAbsoluteApiBase = stored && /^https?:\/\//i.test(stored);
  const isValidRelativeApiBase = stored && stored.indexOf("/api") === 0;
  window.API_BASE_URL =
    isAbsoluteApiBase || isValidRelativeApiBase ? stored : defaultBase;
  window.apiUrl = function (path) {
    if (!path) {
      return window.API_BASE_URL;
    }
    return path.charAt(0) === "/"
      ? window.API_BASE_URL + path
      : window.API_BASE_URL + "/" + path;
  };
  if (!window.fetch) {
    return;
  }
  const CACHE_VERSION = 1;
  const CACHE_PREFIX = "SSDC_API_CACHE:";
  const CACHE_INDEX_KEY = CACHE_PREFIX + "INDEX";
  const cacheConfig = {
    ttlMs: 10 * 1000,
    staleMs: 5 * 60 * 1000,
    maxEntries: 60,
    maxBodyBytes: 200 * 1024
  };
  const memCache = new Map();
  const inflight = new Map();
  const nativeFetch = window.fetch.bind(window);
  function canUseStorage() {
    try {
      return Boolean(window.localStorage);
    } catch (err) {
      return false;
    }
  }
  function toAbsoluteUrl(url) {
    try {
      return new URL(String(url), window.location.origin).toString();
    } catch (err) {
      return String(url);
    }
  }
  const apiPrefixAbs = toAbsoluteUrl(window.API_BASE_URL);
  function isApiUrl(url) {
    return url.indexOf(apiPrefixAbs) === 0;
  }
  function storageKey(url) {
    return CACHE_PREFIX + url;
  }
  function readIndex() {
    if (!canUseStorage()) {
      return [];
    }
    try {
      const raw = window.localStorage.getItem(CACHE_INDEX_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (err) {
      return [];
    }
  }
  function writeIndex(list) {
    if (!canUseStorage()) {
      return;
    }
    try {
      window.localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(list));
    } catch (err) {
      // Ignore storage write errors.
    }
  }
  function updateIndex(key, timestamp) {
    const list = readIndex();
    const existing = list.find((item) => item.key === key);
    if (existing) {
      existing.ts = timestamp;
    } else {
      list.push({ key, ts: timestamp });
    }
    list.sort((a, b) => b.ts - a.ts);
    while (list.length > cacheConfig.maxEntries) {
      const removed = list.pop();
      if (removed && canUseStorage()) {
        window.localStorage.removeItem(removed.key);
        memCache.delete(removed.key.slice(CACHE_PREFIX.length));
      }
    }
    writeIndex(list);
  }
  function readCache(url) {
    const existing = memCache.get(url);
    if (existing) {
      return existing;
    }
    if (!canUseStorage()) {
      return null;
    }
    try {
      const raw = window.localStorage.getItem(storageKey(url));
      if (!raw) {
        return null;
      }
      const entry = JSON.parse(raw);
      if (!entry || entry.v !== CACHE_VERSION) {
        window.localStorage.removeItem(storageKey(url));
        return null;
      }
      memCache.set(url, entry);
      return entry;
    } catch (err) {
      window.localStorage.removeItem(storageKey(url));
      return null;
    }
  }
  function writeCache(url, entry) {
    memCache.set(url, entry);
    if (!canUseStorage()) {
      return;
    }
    try {
      window.localStorage.setItem(storageKey(url), JSON.stringify(entry));
      updateIndex(storageKey(url), entry.ts);
    } catch (err) {
      // Ignore storage errors (quota, etc).
    }
  }
  function clearCache() {
    memCache.clear();
    if (!canUseStorage()) {
      return;
    }
    const list = readIndex();
    list.forEach((item) => {
      if (item && item.key) {
        window.localStorage.removeItem(item.key);
      }
    });
    window.localStorage.removeItem(CACHE_INDEX_KEY);
  }
  function shouldBypassCache(request, init) {
    if (!request) {
      return true;
    }
    const cacheMode = init && init.cache;
    if (cacheMode === "no-store" || cacheMode === "reload") {
      return true;
    }
    const headerValue = request.headers && request.headers.get("Cache-Control");
    return headerValue === "no-store";
  }
  function buildResponse(entry, cacheStatus) {
    const headers = new Headers();
    if (entry.contentType) {
      headers.set("content-type", entry.contentType);
    }
    if (cacheStatus) {
      headers.set("x-cache", cacheStatus);
    }
    return new Response(entry.body, { status: entry.status || 200, headers });
  }
  function cacheResponse(url, response) {
    if (!response || !response.ok) {
      return;
    }
    const contentType = response.headers.get("content-type") || "";
    if (contentType.indexOf("application/json") === -1) {
      return;
    }
    response.clone().text().then((body) => {
      if (!body || body.length > cacheConfig.maxBodyBytes) {
        return;
      }
      writeCache(url, {
        v: CACHE_VERSION,
        ts: Date.now(),
        status: response.status,
        contentType,
        body
      });
    }).catch(() => {
      // Ignore cache write errors.
    });
  }
  function revalidate(url, request) {
    if (inflight.has(url)) {
      return;
    }
    const promise = nativeFetch(request)
      .then((response) => {
        cacheResponse(url, response);
        inflight.delete(url);
        return response;
      })
      .catch(() => {
        inflight.delete(url);
      });
    inflight.set(url, promise);
  }
  window.fetch = function (input, init) {
    const request = input instanceof Request
      ? (init ? new Request(input, init) : input)
      : new Request(input, init);
    const method = String(request.method || "GET").toUpperCase();
    const absUrl = toAbsoluteUrl(request.url);
    if (method !== "GET") {
      return nativeFetch(request).then((response) => {
        if (response && response.ok && isApiUrl(absUrl)) {
          clearCache();
        }
        return response;
      });
    }
    if (!isApiUrl(absUrl) || shouldBypassCache(request, init)) {
      return nativeFetch(request);
    }
    const cached = readCache(absUrl);
    const now = Date.now();
    if (cached) {
      const age = now - cached.ts;
      if (age <= cacheConfig.ttlMs) {
        return Promise.resolve(buildResponse(cached, "HIT"));
      }
      if (age <= cacheConfig.staleMs) {
        revalidate(absUrl, request);
        return Promise.resolve(buildResponse(cached, "STALE"));
      }
    }
    return nativeFetch(request).then((response) => {
      cacheResponse(absUrl, response);
      return response;
    });
  };
})();

/* === PATIENT INFO (inlined) === */
(function () {
  const container = document.getElementById("patient-info");
  if (!container) return;

  container.innerHTML = `
    <div class="pi-grid">
      <div class="pi-item">
        <div class="pi-label">Name</div>
        <div class="pi-value" id="pName"></div>
      </div>
      <div class="pi-item">
        <div class="pi-label">Age / Sex</div>
        <div class="pi-value" id="pAgeSex"></div>
      </div>
      <div class="pi-item">
        <div class="pi-label">Date</div>
        <div class="pi-value" id="pDate"></div>
      </div>
      <div class="pi-item">
        <div class="pi-label">Doctor</div>
        <div class="pi-value" id="pDoctor"></div>
      </div>
      <div class="pi-item">
        <div class="pi-label">Mobile</div>
        <div class="pi-value" id="pMobile"></div>
      </div>
      <div class="pi-item">
        <div class="pi-label">Address</div>
        <div class="pi-value" id="pAddress"></div>
      </div>
    </div>
  `;
})();

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
                <td style="padding-left: 20px">${param.name}</td>
                <td style="${displayValue}
                </td>
                <td>${unitText}</td>
                <td>${normalText}</td>
              </tr>
            `; }); } else {
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
              <td style="${resultValue}
              </td>
              <td>${unit}</td>
              <td>${normalText || fallbackNormal}</td>
            </tr>
          `; }
      }); }); }); /* ================= ACTIONS ================= */
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
