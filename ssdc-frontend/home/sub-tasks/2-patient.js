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

if(parent?.setActiveMenu){ parent.setActiveMenu("patient"); }
const datePicker = document.getElementById("datePicker");
const searchBox  = document.getElementById("searchBox");
const dateToggle = document.getElementById("dateToggle");
const searchToggle = document.getElementById("searchToggle");
const tableBody  = document.getElementById("patientTable");
const bulkBar    = document.getElementById("bulkBar");
const checkHead  = document.getElementById("checkHead");
const selectedCount = document.getElementById("selectedCount");
let allPatients = [];
let selectMode = false;
let isAutoDate = true;
function getLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
datePicker.value = getLocalDateInputValue();
loadByDate(datePicker.value);
function setDateToToday(){
  const today = getLocalDateInputValue();
  if (datePicker.value !== today) {
    datePicker.value = today;
    loadByDate(today);
  }
}
function scheduleMidnightUpdate(){
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  const delay = Math.max(0, nextMidnight.getTime() - now.getTime() + 1000);
  setTimeout(() => {
    if (isAutoDate) {
      setDateToToday();
    }
    scheduleMidnightUpdate();
  }, delay);
}
datePicker.onchange = () => {
  isAutoDate = datePicker.value === getLocalDateInputValue();
  loadByDate(datePicker.value);
};
scheduleMidnightUpdate();
function loadByDate(date){
  fetch(`${API_BASE_URL}/patients/by-date/${date}`)
    .then(r=>r.json())
    .then(d=>{ allPatients=d; renderTable(d); })
    .catch(()=>renderEmpty());
}
function searchPatient(){
  const q = searchBox.value.toLowerCase();
  renderTable(allPatients.filter(p =>
    (p.name||"").toLowerCase().includes(q)
  ));
}
function openDatePicker(){
  datePicker.focus();
  if (typeof datePicker.showPicker === "function") {
    datePicker.showPicker();
  }
}
function focusSearch(){
  searchBox.focus();
}
dateToggle.addEventListener("click", openDatePicker);
searchToggle.addEventListener("click", focusSearch);
function renderTable(data){
  tableBody.innerHTML="";
  if(!data.length){ renderEmpty(); return; }
  const checkClass = selectMode ? "check-col round-left" : "check-col";
  const snoClass = selectMode ? "sno" : "sno round-left";
  data.forEach((p,i)=>{
    tableBody.innerHTML+=`
    <tr>
      <td class="${checkClass}" style="display: ${selectMode?'table-cell':'none'}">
        <input type="checkbox"
               id="patient-${p.id}"
               name="patient-${p.id}"
               class="row-check"
               data-id="${p.id}"
               onchange="updateCount()">
      </td>
      <td class="${snoClass}">${i+1}</td>
      <td class="name">${p.name || "-"}</td>
      <td class="doctor">${p.doctor||'-'}</td>
      <td class="amount">₹${p.amount}</td>
      <td class="status-col"><span class="status">${p.status}</span></td>
      <td class="options">
        <div class="menu">
          <button class="menu-btn" type="button" onclick="toggleMenu(${p.id})">⋮</button>
          <div class="menu-list" id="menu-${p.id}">
            <div onclick="enterSelectMode()">Select</div>
            <div onclick="editPatient(${p.id})">Edit</div>
            <div onclick='openBill(${JSON.stringify(p)})'>Bill</div>
            <div class="danger" onclick="deleteOne(${p.id})">Delete</div>
          </div>
        </div>
      </td>
    </tr>`;
  });
}
function renderEmpty(){
  tableBody.innerHTML=`<tr>
    <td colspan="7" class="no-data">
      No patients found
    </td></tr>`;
}
function closeMenus(){
  document.querySelectorAll(".menu-list")
    .forEach(m=>m.style.display="none");
  document.querySelectorAll("#patientTable tr.menu-open")
    .forEach(row => row.classList.remove("menu-open"));
  document.body.classList.remove("menu-open");
}
function toggleMenu(id){
  const m=document.getElementById(`menu-${id}`);
  const isOpen = m && m.style.display === "block";
  closeMenus();
  if (m) {
    m.style.display=isOpen?"none":"block";
    if (!isOpen) {
      const row = m.closest("tr");
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
function enterSelectMode(){
  selectMode=true;
  bulkBar.style.display="flex";
  checkHead.style.display="table-cell";
  closeMenus();
  renderTable(allPatients);
}
function exitSelectMode(){
  selectMode=false;
  bulkBar.style.display="none";
  checkHead.style.display="none";
  closeMenus();
  renderTable(allPatients);
}
function updateCount(){
  const c=document.querySelectorAll(".row-check:checked").length;
  selectedCount.innerText=`${c} items selected`;
}
function deleteOne(id){
  if(!confirm("Delete patient and all related data?")) return;
  fetch(`${API_BASE_URL}/patients/${id}`, {
    method: "DELETE"
  })
  .then(() => {
    // 🔥 clear localStorage if this patient was open
    const current =
      JSON.parse(localStorage.getItem("currentPatient") || "{}");
    if(current.id === id){
      localStorage.removeItem("currentPatient");
      localStorage.removeItem("selectedTests");
      localStorage.removeItem("patientResults");
    }
    loadByDate(datePicker.value);
  })
  .catch(err => {
    console.error(err);
    alert("Failed to delete patient");
  });
}
function deleteSelected(){
  const checked = document.querySelectorAll(".row-check:checked");
  if(!checked.length){
    alert("No patients selected");
    return;
  }
  if(!confirm("Delete selected patients and all related data?")) return;
  const ids = [...checked].map(cb => Number(cb.dataset.id));
  Promise.all(
    ids.map(id =>
      fetch(`${API_BASE_URL}/patients/${id}`, {
        method: "DELETE"
      })
  .then(() => {
    // 🔥 clear localStorage if deleted patient was active
    const current =
      JSON.parse(localStorage.getItem("currentPatient") || "{}");
    if(ids.includes(current.id)){
      localStorage.removeItem("currentPatient");
      localStorage.removeItem("selectedTests");
      localStorage.removeItem("patientResults");
    }
    exitSelectMode();
    loadByDate(datePicker.value);
  })
  .catch(err => {
    console.error(err);
    alert("Bulk delete failed");
  });
}
function editPatient(id){
  alert("Edit coming soon");
}
function openBill(patient){
  if (!patient || !patient.id) {
    alert("Patient not found");
    return;
  }
  localStorage.setItem("currentPatient", JSON.stringify(patient));
  localStorage.removeItem("selectedTests");
  localStorage.removeItem("patientResults");
  if (parent?.loadPage) {
    parent.loadPage("home/sub-tasks/pt/bill.html", "patient");
  } else {
    location.href = "pt/bill.html";
  }
}
