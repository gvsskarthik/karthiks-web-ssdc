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

const paramList = document.getElementById("paramList");
const addParamBtn = document.getElementById("addParamBtn");
const saveBtn = document.getElementById("saveBtn");
const formMessage = document.getElementById("formMessage");
const shortcutInput = document.getElementById("shortcut");
const shortcutMsg = document.getElementById("shortcutMsg");
let shortcutsLoaded = false;
let existingShortcuts = new Set();
let paramIdCounter = 0;
let normalIdCounter = 0;
addParamBtn.addEventListener("click", () => addParameter());
saveBtn.addEventListener("click", () => saveTest());
shortcutInput.addEventListener("input", () => validateShortcut());
shortcutInput.addEventListener("blur", () => validateShortcut());
function addParameter() {
  const card = document.createElement("div");
  card.className = "param-card";
  const paramId = `param-${paramIdCounter++}`;
  const nameId = `${paramId}-name`;
  const unitId = `${paramId}-unit`;
  const typeId = `${paramId}-type`;
  card.innerHTML = `
    <div class="param-header">
      <h4 class="param-title">Parameter</h4>
      <button class="btn link remove-param" type="button">Remove</button>
    </div>
    <div class="grid-3">
      <div>
        <label for="${nameId}">Parameter Name</label>
        <input id="${nameId}" type="text" class="param-name" placeholder="Parameter Name">
      </div>
      <div>
        <label for="${unitId}">Unit</label>
        <input id="${unitId}" type="text" class="param-unit" placeholder="Unit">
      </div>
      <div>
        <label for="${typeId}">Value Type</label>
        <select id="${typeId}" class="param-type">
          <option value="">Select value type</option>
          <option value="NUMBER">NUMBER</option>
          <option value="TEXT">TEXT</option>
        </select>
      </div>
    </div>
    <div class="section-row normal-section">
      <h4>Normal Ranges</h4>
      <button class="btn small add-normal" type="button">Add Normal</button>
    </div>
    <div class="normals"></div>
  `;
  paramList.appendChild(card);
  card.querySelector(".remove-param").addEventListener("click", () => {
    card.remove();
    refreshParameterLabels();
  });
  card.querySelector(".add-normal").addEventListener("click", () => {
    addNormalRow(card.querySelector(".normals"));
  });
  addNormalRow(card.querySelector(".normals"));
  refreshParameterLabels();
}
function addNormalRow(container) {
  const row = document.createElement("div");
  row.className = "normal-row";
  const normalId = `normal-${normalIdCounter++}`;
  row.innerHTML = `
    <input id="${normalId}" name="${normalId}" type="text" class="normal-text" placeholder="Normal value (e.g. [Male : 14.0 - 16.0 gms])">
    <button class="btn link remove-normal" type="button">Remove</button>
    <div class="row-error"></div>
  `;
  container.appendChild(row);
  row.querySelector(".remove-normal").addEventListener("click", () => row.remove());
}
function refreshParameterLabels() {
  const cards = [...document.querySelectorAll(".param-card")];
  cards.forEach((card, index) => {
    const title = card.querySelector(".param-title");
    title.textContent = "Parameter " + (index + 1);
  });
}
function setMessage(text, type) {
  formMessage.textContent = text || "";
  formMessage.className = "message" + (type ? " " + type : "");
}
function clearErrors() {
  document.querySelectorAll(".error").forEach(el => el.classList.remove("error"));
  document.querySelectorAll(".row-error").forEach(el => el.textContent = "");
}
function normalizeShortcut(value) {
  return (value || "").trim().toLowerCase();
}
async function loadShortcuts() {
  try {
    const res = await fetch(API_BASE_URL + "/tests");
    if (!res.ok) {
      return;
    }
    const list = await res.json();
    existingShortcuts = new Set(
      (list || [])
        .map(t => normalizeShortcut(t.shortcut))
        .filter(Boolean)
    );
    shortcutsLoaded = true;
    validateShortcut();
  } catch (err) {
    console.error(err);
  }
}
function validateShortcut() {
  const value = shortcutInput.value;
  const normalized = normalizeShortcut(value);
  if (!normalized) {
    shortcutMsg.textContent = "";
    shortcutInput.classList.remove("error");
    return false;
  }
  if (shortcutsLoaded && existingShortcuts.has(normalized)) {
    shortcutMsg.textContent = "Shortcut already exists.";
    shortcutInput.classList.add("error");
    return true;
  }
  shortcutMsg.textContent = "";
  shortcutInput.classList.remove("error");
  return false;
}
function normalizeNormalText(value) {
  return (value || "").trim();
}
function collectPayload() {
  clearErrors();
  const errors = [];
  const testName = document.getElementById("testName");
  const shortcut = document.getElementById("shortcut");
  const category = document.getElementById("category");
  const cost = document.getElementById("cost");
  const active = document.getElementById("active");
  if (!testName.value.trim()) {
    testName.classList.add("error");
    errors.push("Test name is required.");
  }
  if (!shortcut.value.trim()) {
    shortcut.classList.add("error");
    errors.push("Shortcut is required.");
  }
  if (validateShortcut()) {
    errors.push("Shortcut already exists.");
  }
  if (!category.value.trim()) {
    category.classList.add("error");
    errors.push("Category is required.");
  }
  const costRaw = cost.value.trim();
  let costValue = null;
  if (!costRaw) {
    cost.classList.add("error");
    errors.push("Cost is required.");
  } else {
    costValue = Number(costRaw);
    if (Number.isNaN(costValue)) {
      cost.classList.add("error");
      errors.push("Cost must be a number.");
    }
  }
  const parameters = [];
  const cards = [...document.querySelectorAll(".param-card")];
  if (cards.length === 0) {
    errors.push("Add at least one parameter.");
  }
  cards.forEach((card, index) => {
    const nameInput = card.querySelector(".param-name");
    const unitInput = card.querySelector(".param-unit");
    const typeSelect = card.querySelector(".param-type");
    const name = nameInput.value.trim();
    if (!typeSelect.value) {
      typeSelect.classList.add("error");
      errors.push("Value type is required.");
      return;
    }
    const normals = [];
    const normalRows = [...card.querySelectorAll(".normal-row")];
    normalRows.forEach(row => {
      const textValueRaw = normalizeNormalText(
        row.querySelector(".normal-text").value
      );
      if (!textValueRaw) {
        return;
      }
      normals.push({
        textValue: textValueRaw
      });
    });
    parameters.push({
      name: name || `Parameter ${index + 1}`,
      unit: unitInput.value.trim() || null,
      valueType: typeSelect.value,
      normalRanges: normals
    });
  });
  if (errors.length) {
    setMessage("Please fix the highlighted errors.", "error");
    return null;
  }
  return {
    testName: testName.value.trim(),
    shortcut: shortcut.value.trim(),
    category: category.value.trim(),
    cost: costValue,
    active: active.checked,
    parameters: parameters
  };
}
async function saveTest() {
  const payload = collectPayload();
  if (!payload) {
    return;
  }
  setMessage("Saving...", "");
  saveBtn.disabled = true;
  try {
    const res = await fetch(API_BASE_URL + "/tests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const errText = await res.text();
      setMessage(errText || "Save failed.", "error");
      saveBtn.disabled = false;
      return;
    }
    setMessage("Saved successfully.", "success");
    setTimeout(() => {
      window.location.href = "../5-tests.html";
    }, 600);
  } catch (err) {
    console.error(err);
    setMessage("Backend not running or network error.", "error");
  } finally {
    saveBtn.disabled = false;
  }
}
addParameter();
loadShortcuts();
