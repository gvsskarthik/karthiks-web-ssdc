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

let tests=[], groups=[], mode="all";
let normalIdCounter = 0;
let editTest=null, editGroup=null;
/* LOAD */
Promise.all([
fetch(API_BASE_URL + "/tests").then(r=>r.json()),
 fetch(API_BASE_URL + "/groups").then(r=>r.json())
]).then(([t,g])=>{
 tests=t;
 groups=g;
 render();
});
/* TABS */
function setMode(m,b){
 mode=m;
 document.querySelectorAll(".tabs button").forEach(x=>x.classList.remove("active"));
 b.classList.add("active");
 render();
}
/* MENU */
function closeMenus(){
 document.querySelectorAll(".menu-list").forEach(m=>m.style.display="none");
 document.querySelectorAll("#tbody tr.menu-open").forEach(row => row.classList.remove("menu-open"));
 document.body.classList.remove("menu-open");
}
function toggleMenu(btn){
 const menu = btn.nextElementSibling;
 const isOpen = menu && menu.style.display === "block";
 closeMenus();
 if (menu) {
  menu.style.display = isOpen ? "none" : "block";
  if (!isOpen) {
   const row = btn.closest("tr");
   if (row) {
     row.classList.add("menu-open");
   }
   document.body.classList.add("menu-open");
  }
 }
}
document.addEventListener("click", (event) => {
 if (!event.target.closest(".menu")) {
  closeMenus();
 }
});
function normalizeText(value){
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}
function formatCost(value){
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `₹${numeric}` : "—";
}
function renderNormalValues(test){
 const params = Array.isArray(test.parameters) ? test.parameters : [];
 const hasMultiple = params.length > 1;
 const paramLines = params
  .map(param => {
    const normalText = normalizeText(param.normalText);
    if (!normalText) {
      return "";
    }
    const name = hasMultiple ? normalizeText(param.name) : "";
    return name ? `${name}: ${normalText}` : normalText;
  })
  .filter(Boolean);
 if (paramLines.length) {
  return paramLines.join("\n");
 }
 return (test.normalValues || [])
  .map(n => normalizeText(n.normalValue))
  .filter(Boolean)
  .join("\n");
}
/* RENDER */
function render(){
 tbody.innerHTML="";
 let i=1;
 if(mode!=="group"){
  tests.forEach(t=>{
   tbody.innerHTML+=`
   <tr>
    <td class="sno">${i++}</td>
    <td class="name">${t.testName || "-"}</td>
    <td class="category">${t.category || "—"}</td>
    <td class="shortcut">${t.shortcut || "—"}</td>
    <td class="normal">${renderNormalValues(t) || "—"}</td>
    <td class="cost">${formatCost(t.cost)}</td>
      <td class="active-col">
         <label class="switch">
           <input type="checkbox"
           id="active-test-${t.id}"
           name="active-test-${t.id}"
           ${t.active ? "checked" : ""}
           onchange="toggleActive(${t.id}, this.checked)">
            <span class="slider"></span>
         </label>
      </td>
      <td class="options">
     <div class="menu">
      <button class="menu-btn" type="button" onclick="toggleMenu(this)">⋮</button>
      <div class="menu-list">
       <div onclick='openTest(${JSON.stringify(t)})'>Edit</div>
      ${t.used ? "" : `<div onclick='deleteTest(${t.id})'>Delete</div>`}      </div>
     </div>
    </td>
   </tr>`;
  });
 }
 if(mode!=="single"){
  groups.forEach(g=>{
   tbody.innerHTML+=`
   <tr>
    <td class="sno">${i++}</td>
    <td class="name">${g.groupName || "-"}</td>
    <td class="category">Group</td>
    <td class="shortcut">${g.shortcut || "—"}</td>
    <td class="normal">—</td>
    <td class="cost">${formatCost(g.cost)}</td>
    <td class="active-col">
      <label class="switch">
        <input type="checkbox"
          id="active-group-${g.id}"
          name="active-group-${g.id}"
          ${(g.active === false) ? "" : "checked"}
          onchange="toggleGroupActive(${g.id}, this.checked)">
        <span class="slider"></span>
      </label>
    </td>
    <td class="options">
     <div class="menu">
      <button class="menu-btn" type="button" onclick="toggleMenu(this)">⋮</button>
      <div class="menu-list">
       <div onclick='openGroup(${JSON.stringify(g)})'>Edit</div>
       <div onclick='deleteGroup(${g.id})'>Delete</div>
      </div>
     </div>
    </td>
   </tr>`;
  });
}
}
/* ===== SINGLE TEST ===== */
function openTest(t){
 editTest=t;
 tName.value=t.testName;
 tShortcut.value=t.shortcut;
 tCategory.value=t.category;
 tCost.value=t.cost;
 nBox.innerHTML="";
 normalIdCounter = 0;
 (t.normalValues||[]).forEach(n=>{
  const normalId = `normal-${t.id}-${normalIdCounter++}`;
  nBox.innerHTML+=`<div class="inline"><textarea id="${normalId}" name="${normalId}">${n.normalValue}</textarea></div>`;
 });
 testModal.style.display="flex";
}
function addNormal(){
  const normalId = `normal-${editTest ? editTest.id : "new"}-${normalIdCounter++}`;
  nBox.innerHTML+=`<textarea id="${normalId}" name="${normalId}"></textarea>`;
}
function saveTest(){
 fetch(API_BASE_URL + "/tests/" + editTest.id,{
  method:"PUT",
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({
    testName:tName.value,
    shortcut:tShortcut.value,
    category:tCategory.value,
    cost:+tCost.value,
    normalValues:[...nBox.querySelectorAll("textarea")].map(t=>({normalValue:t.value}))
  })
 }).then(()=>location.reload());
}
function closeTest(){testModal.style.display="none"}
/* ===== GROUP EDIT (MODAL, NO REDIRECT) ===== */
function openGroup(g){
 editGroup=g;
 gName.value=g.groupName;
 gShortcut.value=g.shortcut;
 gCost.value=g.cost;
 fetch(API_BASE_URL + "/groups/" + g.id)
 .then(r=>r.json())
 .then(d=>{
  editGroup = { ...editGroup, ...d };
  groupTests.innerHTML="";
  tests.forEach(t=>{
   groupTests.innerHTML+=`
    <div class="inline neo" style="padding: 8px">
      <input type="checkbox" id="group-test-${g.id}-${t.id}" name="group-test-${g.id}-${t.id}" value="${t.id}"
        ${(d.testIds||[]).includes(t.id)?"checked":""}>
      ${t.testName} (${t.shortcut})
    </div>`;
  });
  groupModal.style.display="flex";
 });
}
function saveGroup(){
 const ids=[...groupTests.querySelectorAll("input:checked")].map(i=>+i.value);
 fetch(API_BASE_URL + "/groups/" + editGroup.id,{
  method:"PUT",
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({
   groupName:gName.value,
   shortcut:gShortcut.value,
   cost:+gCost.value,
   testIds:ids,
   category: editGroup.category || undefined,
   active: typeof editGroup.active === "boolean" ? editGroup.active : undefined
  })
 }).then(()=>location.reload());
}
function closeGroup(){groupModal.style.display="none"}
/* DELETE */
function deleteTest(id){
  if(!confirm("Delete test?")) return;
  fetch(API_BASE_URL + "/tests/" + id,{
    method:"DELETE"
  })
  .then(res=>{
    if(!res.ok){
      return res.text().then(msg=>alert(msg));
    }
    location.reload();
  })
  .catch(()=>{
    alert("Server error");
  });
}
function deleteGroup(id){
 if(confirm("Delete group?"))
  fetch(API_BASE_URL + "/groups/" + id,{method:"DELETE"})
   .then(()=>location.reload());
}
/* TOGGLE ACTIVE */
function toggleActive(id, state){
  fetch(`${API_BASE_URL}/tests/${id}/active`,{
    method:"PUT",
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ active: state })
  })
  .then(res=>{
    if(!res.ok){
      alert("Failed to update test status");
      location.reload(); // revert UI
    }
  })
  .catch(()=>{
    alert("Server error");
    location.reload();
  });
}
function toggleGroupActive(id, state){
  fetch(`${API_BASE_URL}/groups/${id}/active`,{
    method:"PUT",
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ active: state })
  })
  .then(res=>{
    if(!res.ok){
      alert("Failed to update group status");
      location.reload(); // revert UI
    }
  })
  .catch(()=>{
    alert("Server error");
    location.reload();
  });
}
