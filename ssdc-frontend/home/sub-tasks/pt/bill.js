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

const patient =
  JSON.parse(localStorage.getItem("currentPatient") || "{}");
function setText(id, value){
  const el = document.getElementById(id);
  if (el) {
    el.innerText = value;
  }
}
function formatMoney(value){
  const num = Number(value);
  if (!Number.isFinite(num)) return "0";
  return String(Math.round(num * 100) / 100);
}
function formatMoneyWithSymbol(value){
  return `₹${formatMoney(value)}`;
}
function resolveGroupCost(group, testMap){
  const cost = Number(group.cost);
  if (Number.isFinite(cost)) {
    return cost;
  }
  let sum = 0;
  (group.testIds || []).forEach(id => {
    const test = testMap.get(id);
    sum += Number(test?.cost) || 0;
  });
  return Math.round(sum * 100) / 100;
}
function hydratePatient(){
  const age = patient.age ? String(patient.age) : "";
  const gender = patient.gender || "";
  const ageSex =
    age && gender ? `${age} / ${gender}` : `${age}${gender}`;
  setText("pName", patient.name || "");
  setText("pDate", patient.visitDate || new Date().toLocaleDateString());
  setText("pAddress", patient.address || "");
  setText("pAgeSex", ageSex);
  setText("pDoctor", patient.doctor || "SELF");
  setText("pMobile", patient.mobile || "");
}
function loadSelectedTests(){
  if (!patient || !patient.id) {
    return Promise.resolve([]);
  }
  return fetch(`${API_BASE_URL}/patient-tests/${patient.id}`)
    .then(res => res.json())
    .then(list => (list || [])
      .map(x => Number(x.testId))
      .filter(id => !Number.isNaN(id)))
    .catch(() => {
      const stored =
        JSON.parse(localStorage.getItem("selectedTests") || "[]");
      return (stored || [])
        .map(id => Number(id))
        .filter(id => !Number.isNaN(id));
    });
}
function setTotals(subtotalValue, discountValue, totalValue){
  setText("subtotal", formatMoneyWithSymbol(subtotalValue));
  setText("discount", formatMoneyWithSymbol(discountValue));
  setText("total", formatMoneyWithSymbol(totalValue));
}
function renderBill(){
  const body = document.getElementById("billBody");
  if (!patient || !patient.id) {
    body.innerHTML = `<tr><td colspan="2">No patient selected</td></tr>`;
    setTotals(0, 0, 0);
    return;
  }
  loadSelectedTests()
    .then(ids => {
      const uniqueIds = [...new Set(ids)];
      if (!uniqueIds.length) {
        body.innerHTML = `<tr><td colspan="2">No tests found</td></tr>`;
        const amount = Number(patient.amount) || 0;
        setTotals(0, 0, amount);
        return;
      }
      return Promise.all([
        fetch(`${API_BASE_URL}/tests/active`).then(res => res.json()),
        fetch(`${API_BASE_URL}/groups`).then(res => res.json()).catch(() => [])
      ])
        .then(([tests, groups]) => {
          const testList = Array.isArray(tests) ? tests : [];
          const testMap = new Map(testList.map(t => [Number(t.id), t]));
          const selected =
            testList.filter(t => uniqueIds.includes(t.id));
          if (!selected.length) {
            body.innerHTML = `<tr><td colspan="2">No tests found</td></tr>`;
            const amount = Number(patient.amount) || 0;
            setTotals(0, 0, amount);
            return;
          }
          const normalizedGroups = (Array.isArray(groups) ? groups : [])
            .map(group => {
              const ids = Array.isArray(group.testIds) ? group.testIds : [];
              const testIds = ids
                .map(id => Number(id))
                .filter(id => Number.isFinite(id) && testMap.has(id));
              return { ...group, testIds };
            })
            .filter(group => group.testIds.length)
            .sort((a, b) => {
              const diff = b.testIds.length - a.testIds.length;
              if (diff !== 0) return diff;
              return (Number(a.id) || 0) - (Number(b.id) || 0);
            });
          const selectedSet = new Set(uniqueIds);
          const selectedGroups = [];
          const coveredTests = new Set();
          normalizedGroups.forEach(group => {
            const allSelected = group.testIds.every(id => selectedSet.has(id));
            if (!allSelected) {
              return;
            }
            const overlaps = group.testIds.some(id => coveredTests.has(id));
            if (overlaps) {
              return;
            }
            selectedGroups.push(group);
            group.testIds.forEach(id => coveredTests.add(id));
          });
          let subtotal = 0;
          body.innerHTML = "";
          selectedGroups.forEach(group => {
            const cost = resolveGroupCost(group, testMap);
            subtotal += cost;
            body.innerHTML += `
              <tr>
                <td>${group.groupName || "Group"} (Group)</td>
                <td class="amount">₹${formatMoney(cost)}</td>
              </tr>
            `;
          });
          selected
            .filter(test => !coveredTests.has(Number(test.id)))
            .forEach(test => {
              const cost = Number(test.cost) || 0;
              subtotal += cost;
              body.innerHTML += `
                <tr>
                  <td>${test.testName || "-"}</td>
                  <td class="amount">₹${formatMoney(cost)}</td>
                </tr>
              `;
            });
          const patientAmount = Number(patient.amount);
          const total = Number.isFinite(patientAmount)
            ? patientAmount
            : subtotal;
          const discount = Math.max(0, subtotal - total);
          setTotals(subtotal, discount, total);
        })
        .catch(() => {
          body.innerHTML = `<tr><td colspan="2">Failed to load tests</td></tr>`;
          const amount = Number(patient.amount) || 0;
          setTotals(0, 0, amount);
        });
    })
    .catch(() => {
      body.innerHTML = `<tr><td colspan="2">Failed to load tests</td></tr>`;
      const amount = Number(patient.amount) || 0;
      setTotals(0, 0, amount);
    });
}
function goPatients(){
  if (parent?.loadPage) {
    parent.loadPage("home/sub-tasks/2-patient.html", "patient");
  } else {
    location.href = "../2-patient.html";
  }
}
hydratePatient();
renderBill();
