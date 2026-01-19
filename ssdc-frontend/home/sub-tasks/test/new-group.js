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

const title = document.getElementById("title");
const groupName = document.getElementById("groupName");
const shortcut = document.getElementById("shortcut");
const category = document.getElementById("category");
const cost = document.getElementById("cost");
const active = document.getElementById("active");
const slotList = document.getElementById("slotList");
const addTestBtn = document.getElementById("addTestBtn");
const status = document.getElementById("status");
const saveBtn = document.getElementById("saveBtn");
const params = new URLSearchParams(location.search);
const editId = params.get("edit");
let tests = [];
let testMap = new Map();
let slots = [];
let slotCounter = 0;
addTestBtn.addEventListener("click", () => addSlot());
saveBtn.addEventListener("click", () => saveGroup());
function setStatus(message, type){
  status.textContent = message || "";
  status.className = "message" + (type ? " " + type : "");
}
function normalizeId(value){
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}
function getSelectedIds(excludeSlotId){
  return new Set(
    slots
      .filter(slot => slot.testId && slot.id !== excludeSlotId)
      .map(slot => slot.testId)
  );
}
function normalizeQuery(value){
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
function formatValue(value, fallback){
  if (value === null || value === undefined || value === "") {
    return fallback || "—";
  }
  return String(value);
}
function formatCost(value){
  const num = Number(value);
  return Number.isFinite(num) ? `₹${num}` : "—";
}
function getParamNormals(param){
  if (!param) return "";
  if (Array.isArray(param.normalRanges) && param.normalRanges.length) {
    return param.normalRanges
      .map(r => (r && r.textValue ? String(r.textValue) : ""))
      .filter(Boolean)
      .join(" | ");
  }
  if (param.normalText) {
    return String(param.normalText);
  }
  return "";
}
function renderParamList(test){
  const params = Array.isArray(test.parameters) ? test.parameters : [];
  if (params.length) {
    return params.map((param, index) => {
      const name = param.name || `Parameter ${index + 1}`;
      const unit = param.unit || "—";
      const type = param.valueType || "—";
      const normals = getParamNormals(param);
      const normalText = normals ? `<div class="param-normal">Normal: ${normals}</div>` : "";
      return `
        <div class="param-item">
          <div class="param-title">${name}</div>
          <div class="param-meta">Unit: ${unit} · Type: ${type}</div>
          ${normalText}
        </div>
      `;
    }).join("");
  }
  const normalValues = Array.isArray(test.normalValues) ? test.normalValues : [];
  const normals = normalValues
    .map(n => (n && n.normalValue ? String(n.normalValue) : ""))
    .filter(Boolean)
    .join(" | ");
  if (!normals) {
    return '<div class="param-item"><div class="param-title">No parameters</div></div>';
  }
  return `
    <div class="param-item">
      <div class="param-title">Normal Values</div>
      <div class="param-normal">${normals}</div>
    </div>
  `;
}
function renderDetails(slot){
  const detail = slot.detail;
  const test = testMap.get(slot.testId);
  if (!test) {
    detail.innerHTML = '<div class="muted">Select a test to see details.</div>';
    return;
  }
  const shortcutText = test.shortcut || "—";
  const categoryText = test.category || "—";
  const activeText = test.active ? "Active" : "Inactive";
  detail.innerHTML = `
    <div class="detail-grid">
      <div>
        <div class="detail-label">Test Name</div>
        <div class="detail-value">${formatValue(test.testName, "—")}</div>
      </div>
      <div>
        <div class="detail-label">Shortcut</div>
        <div class="detail-value">${shortcutText}</div>
      </div>
      <div>
        <div class="detail-label">Category</div>
        <div class="detail-value">${categoryText}</div>
      </div>
      <div>
        <div class="detail-label">Cost</div>
        <div class="detail-value">${formatCost(test.cost)}</div>
      </div>
      <div>
        <div class="detail-label">Status</div>
        <div class="detail-value">${activeText}</div>
      </div>
    </div>
    <div class="param-list">
      ${renderParamList(test)}
    </div>
  `;
}
function setSlotInputFromSelection(slot){
  const test = testMap.get(slot.testId);
  if (!test) {
    slot.searchInput.value = "";
    return;
  }
  const shortcutText = test.shortcut ? ` (${test.shortcut})` : "";
  slot.searchInput.value = `${test.testName || ""}${shortcutText}`.trim();
}
function rankSuggestion(test, query){
  const name = normalizeQuery(test.testName);
  const shortcut = normalizeQuery(test.shortcut);
  if (shortcut && shortcut.startsWith(query)) {
    return 0;
  }
  if (name.startsWith(query)) {
    return 1;
  }
  if (shortcut && shortcut.includes(query)) {
    return 2;
  }
  return 3;
}
function setActiveSuggestion(slot, index){
  if (!slot.suggestionItems.length) {
    slot.activeSuggestionIndex = -1;
    return;
  }
  if (index < 0) {
    slot.activeSuggestionIndex = slot.suggestionItems.length - 1;
  } else if (index >= slot.suggestionItems.length) {
    slot.activeSuggestionIndex = 0;
  } else {
    slot.activeSuggestionIndex = index;
  }
  const items = slot.suggestions.querySelectorAll(".suggestion");
  items.forEach((item, idx) => {
    item.classList.toggle("active", idx === slot.activeSuggestionIndex);
  });
}
function updateSlotSuggestions(slot){
  const query = normalizeQuery(slot.searchInput.value);
  if (!query) {
    slot.suggestionItems = [];
    slot.activeSuggestionIndex = -1;
    slot.suggestions.innerHTML = "";
    slot.suggestions.classList.add("hidden");
    slot.noResult.classList.add("hidden");
    return;
  }
  const selectedElsewhere = getSelectedIds(slot.id);
  const matches = tests
    .filter(test => {
      const id = Number(test?.id);
      if (!Number.isFinite(id)) {
        return false;
      }
      if (selectedElsewhere.has(id)) {
        return false;
      }
      const name = normalizeQuery(test.testName);
      const shortcut = normalizeQuery(test.shortcut);
      return name.includes(query) || shortcut.includes(query);
    })
    .map(test => ({
      id: Number(test.id),
      name: test.testName || "",
      shortcut: test.shortcut || "",
      cost: Number(test.cost) || 0,
      rank: rankSuggestion(test, query)
    }))
    .sort((a, b) => {
      const rankDiff = a.rank - b.rank;
      if (rankDiff !== 0) {
        return rankDiff;
      }
      return (a.id || 0) - (b.id || 0);
    })
    .slice(0, 8);
  slot.suggestionItems = matches;
  slot.activeSuggestionIndex = matches.length ? 0 : -1;
  slot.suggestions.innerHTML = "";
  matches.forEach((item, index) => {
    const shortcut = item.shortcut ? item.shortcut : "";
    const activeClass = index === slot.activeSuggestionIndex ? " active" : "";
    const meta = shortcut ? shortcut : " ";
    slot.suggestions.innerHTML += `
      <div class="suggestion${activeClass}" data-id="${item.id}">
        <div class="suggestion-main">
          <div class="suggestion-name">${item.name || ""}</div>
          <div class="suggestion-meta">${meta}</div>
        </div>
        <div class="suggestion-cost">₹${item.cost}</div>
      </div>
    `;
  });
  slot.suggestions.classList.toggle("hidden", !matches.length);
  slot.noResult.classList.toggle("hidden", matches.length > 0);
}
function chooseSlotTest(slot, testId){
  const id = Number(testId);
  if (!Number.isFinite(id)) {
    return;
  }
  const selectedElsewhere = getSelectedIds(slot.id);
  if (selectedElsewhere.has(id)) {
    setStatus("This test is already selected in another slot.", "error");
    return;
  }
  slot.testId = id;
  setSlotInputFromSelection(slot);
  renderDetails(slot);
  slots.forEach(other => {
    if (other.suggestions && !other.suggestions.classList.contains("hidden")) {
      updateSlotSuggestions(other);
    }
  });
}
function handleSlotSuggestionClick(slot, event){
  const item = event.target.closest(".suggestion");
  if (!item) {
    return;
  }
  chooseSlotTest(slot, item.dataset.id);
  slot.suggestions.classList.add("hidden");
  slot.noResult.classList.add("hidden");
}
function handleSlotSuggestionKeys(slot, event){
  if (event.key === "ArrowDown") {
    if (slot.suggestionItems.length) {
      event.preventDefault();
      setActiveSuggestion(slot, slot.activeSuggestionIndex + 1);
    }
    return;
  }
  if (event.key === "ArrowUp") {
    if (slot.suggestionItems.length) {
      event.preventDefault();
      setActiveSuggestion(slot, slot.activeSuggestionIndex - 1);
    }
    return;
  }
  if (event.key === "Enter") {
    if (slot.suggestionItems.length) {
      event.preventDefault();
      const active = slot.suggestionItems[slot.activeSuggestionIndex] || slot.suggestionItems[0];
      if (active) {
        chooseSlotTest(slot, active.id);
      }
      slot.suggestions.classList.add("hidden");
      slot.noResult.classList.add("hidden");
    }
    return;
  }
  if (event.key === "Escape") {
    slot.suggestions.classList.add("hidden");
    slot.noResult.classList.add("hidden");
  }
}
function addSlot(testId){
  const slotId = `slot-${slotCounter++}`;
  const wrapper = document.createElement("div");
  wrapper.className = "slot-card";
  wrapper.innerHTML = `
    <div class="slot-header">
      <h4 class="slot-title"></h4>
      <button class="btn link" type="button">Remove</button>
    </div>
    <div class="grid-2">
      <div>
        <label>Select Test</label>
        <div class="search-wrap">
          <input class="test-search" placeholder="Search test..." autocomplete="off">
          <div class="suggestions hidden"></div>
        </div>
        <div class="no-result hidden">❌ No test available</div>
      </div>
      <div class="inline">
        <input type="checkbox" disabled>
        <label style="margin: 0">Details (read-only)</label>
      </div>
    </div>
    <div class="detail-card"></div>
  `;
  const searchInput = wrapper.querySelector(".test-search");
  const suggestions = wrapper.querySelector(".suggestions");
  const noResult = wrapper.querySelector(".no-result");
  const removeBtn = wrapper.querySelector(".btn.link");
  const titleEl = wrapper.querySelector(".slot-title");
  const detail = wrapper.querySelector(".detail-card");
  const slot = {
    id: slotId,
    testId: normalizeId(testId),
    wrapper,
    searchInput,
    suggestions,
    noResult,
    suggestionItems: [],
    activeSuggestionIndex: -1,
    detail,
    titleEl
  };
  slots.push(slot);
  searchInput.addEventListener("input", () => updateSlotSuggestions(slot));
  searchInput.addEventListener("keydown", event => handleSlotSuggestionKeys(slot, event));
  suggestions.addEventListener("click", event => handleSlotSuggestionClick(slot, event));
  searchInput.addEventListener("focus", () => updateSlotSuggestions(slot));
  searchInput.addEventListener("blur", () => {
    setTimeout(() => {
      slot.suggestions.classList.add("hidden");
      slot.noResult.classList.add("hidden");
      setSlotInputFromSelection(slot);
    }, 120);
  });
  removeBtn.addEventListener("click", () => {
    slots = slots.filter(item => item.id !== slot.id);
    wrapper.remove();
    slots.forEach(other => updateSlotSuggestions(other));
    refreshSlotTitles();
  });
  slotList.appendChild(wrapper);
  setSlotInputFromSelection(slot);
  renderDetails(slot);
  refreshSlotTitles();
}
function refreshSlotTitles(){
  slots.forEach((slot, index) => {
    slot.titleEl.textContent = `Test ${index + 1}`;
  });
}
async function loadData(){
  setStatus("Loading tests...");
  try {
    const testRes = await fetch(API_BASE_URL + "/tests/active");
    if (!testRes.ok) {
      setStatus("Failed to load tests.", "error");
      return;
    }
    tests = await testRes.json();
    tests = Array.isArray(tests) ? tests : [];
    testMap = new Map(tests.map(t => [Number(t.id), t]));
    if (editId) {
      const groupRes = await fetch(API_BASE_URL + "/groups/" + editId);
      if (groupRes.ok) {
        const group = await groupRes.json();
        title.textContent = "Edit Group";
        groupName.value = group.groupName || "";
        shortcut.value = group.shortcut || "";
        cost.value = group.cost == null ? "" : group.cost;
        if (group.category) {
          category.value = group.category;
        }
        if (typeof group.active === "boolean") {
          active.checked = group.active;
        }
        const ids = Array.isArray(group.testIds) ? group.testIds : [];
        ids.forEach(id => addSlot(id));
      } else {
        setStatus("Failed to load group.", "error");
      }
    }
    if (!slots.length) {
      addSlot();
    }
    setStatus("");
  } catch (err) {
    console.error(err);
    setStatus("Failed to load data. Check backend connection.", "error");
  }
}
async function saveGroup(){
  const nameValue = groupName.value.trim();
  const shortcutValue = shortcut.value.trim();
  const categoryValue = category.value.trim();
  const costValue = cost.value.trim();
  let costNumber = null;
  if (!nameValue) {
    setStatus("Group name is required.", "error");
    groupName.focus();
    return;
  }
  if (!shortcutValue) {
    setStatus("Shortcut is required.", "error");
    shortcut.focus();
    return;
  }
  if (costValue !== "") {
    costNumber = Number(costValue);
    if (Number.isNaN(costNumber)) {
      setStatus("Price must be a number.", "error");
      cost.focus();
      return;
    }
  }
  const testIds = slots
    .map(slot => slot.testId)
    .filter(id => Number.isFinite(id));
  const uniqueIds = [...new Set(testIds)];
  if (!uniqueIds.length) {
    setStatus("Select at least one test.", "error");
    return;
  }
  const payload = {
    groupName: nameValue,
    shortcut: shortcutValue,
    category: categoryValue || null,
    cost: costNumber,
    active: active.checked,
    testIds: uniqueIds
  };
  setStatus("Saving...");
  saveBtn.disabled = true;
  try {
    const url = editId
      ? API_BASE_URL + "/groups/" + editId
      : API_BASE_URL + "/groups";
    const method = editId ? "PUT" : "POST";
    const res = await fetch(url, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const errText = await res.text();
      setStatus(errText || "Save failed.", "error");
      saveBtn.disabled = false;
      return;
    }
    setStatus("Saved successfully.");
    setTimeout(() => {
      window.location.href = "../5-tests.html";
    }, 600);
  } catch (err) {
    console.error(err);
    setStatus("Backend not running or network error.", "error");
  } finally {
    saveBtn.disabled = false;
  }
}
loadData();
