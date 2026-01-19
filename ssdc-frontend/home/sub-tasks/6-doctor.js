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

const table = document.getElementById("doctorTable");
const searchInput = document.getElementById("searchInput");
const editModal = document.getElementById("editModal");
const editForm = document.getElementById("editForm");
const editName = document.getElementById("editName");
const editSpecialization = document.getElementById("editSpecialization");
const editPhone = document.getElementById("editPhone");
const editHospital = document.getElementById("editHospital");
const editCommissionRate = document.getElementById("editCommissionRate");
const cancelEdit = document.getElementById("cancelEdit");
let doctors = [];
let editDoctorId = null;
let monthlyStats = new Map();
function parseNumber(value){
  const cleaned = String(value ?? "").replace(/,/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}
function formatMoney(value){
  return String(Math.round(parseNumber(value)));
}
function normalizeName(value){
  return String(value || "").trim().toLowerCase();
}
function parseDateValue(value){
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    return new Date(Date.UTC(year, month - 1, day));
  }
  const parts = raw.split(/[\/-]/);
  if (parts.length === 3) {
    let year;
    let month;
    let day;
    if (parts[0].length === 4) {
      year = Number(parts[0]);
      month = Number(parts[1]);
      day = Number(parts[2]);
    } else {
      day = Number(parts[0]);
      month = Number(parts[1]);
      year = Number(parts[2]);
    }
    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      return new Date(Date.UTC(year, month - 1, day));
    }
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return new Date(Date.UTC(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate()
  ));
}
function isCurrentMonth(date){
  if (!date) {
    return false;
  }
  const now = new Date();
  return date.getUTCFullYear() === now.getUTCFullYear()
    && date.getUTCMonth() === now.getUTCMonth();
}
function buildMonthlyStats(rows){
  const stats = new Map();
  (Array.isArray(rows) ? rows : []).forEach(row => {
    const date = parseDateValue(row?.date);
    if (!isCurrentMonth(date)) {
      return;
    }
    const key = normalizeName(row?.doctorName);
    if (!key) {
      return;
    }
    const current = stats.get(key) || { revenue: 0, commission: 0 };
    current.revenue += parseNumber(row?.billAmount);
    current.commission += parseNumber(row?.commissionAmount);
    stats.set(key, current);
  });
  return stats;
}
function closeAllMenus() {
  document.querySelectorAll(".menu-list").forEach(m => {
    m.style.display = "none";
  });
  document.querySelectorAll("#doctorTable tr.menu-open").forEach(row => {
    row.classList.remove("menu-open");
  });
  document.body.classList.remove("menu-open");
}
function toggleMenu(btn) {
  const menu = btn.nextElementSibling;
  const isOpen = menu && menu.style.display === "block";
  closeAllMenus();
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
function applySearch() {
  const search = searchInput.value.toLowerCase();
  document.querySelectorAll("#doctorTable tr").forEach(row => {
    row.style.display = row.innerText.toLowerCase().includes(search) ? "" : "none";
  });
}
function renderDoctors() {
  table.innerHTML = "";
  doctors.forEach((d, i) => {
    const key = normalizeName(d.name);
    const stats = key ? (monthlyStats.get(key) || { revenue: 0, commission: 0 }) : { revenue: 0, commission: 0 };
    const profit = stats.revenue - stats.commission;
    table.innerHTML += `
      <tr>
        <td class="sno">${i + 1}</td>
        <td class="name">${d.name || "-"}</td>
        <td class="specialization">${d.specialization || "-"}</td>
        <td class="hospital">${d.hospital || "-"}</td>
        <td class="phone">${d.phone || "-"}</td>
        <td class="num profit">₹${formatMoney(profit)}</td>
        <td class="num share">₹${formatMoney(stats.commission)}</td>
        <td class="center">
          <div class="menu">
            <span class="menu-btn" onclick="toggleMenu(this)">⋮</span>
            <div class="menu-list">
              <div onclick="openEdit(${d.id})">Edit</div>
              <div class="danger" onclick="deleteDoctor(${d.id})">Delete</div>
            </div>
          </div>
        </td>
      </tr>
    `;
  });
  applySearch();
}
function loadDoctors() {
  Promise.all([
    fetch(API_BASE_URL + "/doctors").then(res => res.json()),
    fetch(API_BASE_URL + "/accounts/details")
      .then(res => res.json())
      .catch(err => {
        console.error("Error loading account details", err);
        return [];
      })
  ])
  .then(([doctorData, detailRows]) => {
    doctors = Array.isArray(doctorData) ? doctorData : [];
    monthlyStats = buildMonthlyStats(detailRows);
    renderDoctors();
  })
  .catch(err => {
    console.error("Error loading doctors", err);
    table.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; Failed to load doctors
        </td>
      </tr>
    `; }); }
function openEdit(id) {
  closeAllMenus(); const doctor = doctors.find(d => d.id === id); if (!doctor) {
    alert("Doctor not found");
    return;
  }
  editDoctorId = id;
  editName.value = doctor.name || "";
  editSpecialization.value = doctor.specialization || "";
  editPhone.value = doctor.phone || "";
  editHospital.value = doctor.hospital || "";
  editCommissionRate.value =
    doctor.commissionRate == null ? "" : doctor.commissionRate;
  editModal.style.display = "flex";
}
function closeEditModal() {
  editDoctorId = null;
  editForm.reset();
  editModal.style.display = "none";
}
function deleteDoctor(id) {
  closeAllMenus();
  if (!confirm("Delete doctor permanently?")) return;
  fetch(`${API_BASE_URL}/doctors/${id}`, {
    method: "DELETE"
  })
  .then(res => {
    if (!res.ok) {
      return res.text().then(text => {
        throw new Error(text || "Failed to delete doctor");
      });
    }
    return res;
  })
  .then(() => loadDoctors())
  .catch(err => {
    console.error("Error deleting doctor", err);
    alert(err.message || "Error deleting doctor");
  });
}
editForm.addEventListener("submit", function (e) {
  e.preventDefault();
  if (editDoctorId == null) return;
  const doctor = {
    id: editDoctorId,
    name: editName.value.trim(),
    specialization: editSpecialization.value.trim(),
    phone: editPhone.value.trim(),
    hospital: editHospital.value.trim()
  };
  const commissionRateRaw = editCommissionRate.value.trim();
  const commissionRate =
    commissionRateRaw === "" ? null : Number(commissionRateRaw);
  if (commissionRate !== null && Number.isFinite(commissionRate)) {
    doctor.commissionRate = commissionRate;
  }
  fetch(API_BASE_URL + "/doctors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(doctor)
  })
  .then(res => {
    if (!res.ok) {
      throw new Error("Failed to save doctor");
    }
  })
  .then(() => {
    closeEditModal();
    loadDoctors();
  })
  .catch(err => {
    console.error("Error saving doctor", err);
    alert(err.message || "Error saving doctor");
  });
});
cancelEdit.addEventListener("click", closeEditModal);
editModal.addEventListener("click", function (e) {
  if (e.target === editModal) closeEditModal();
});
document.addEventListener("click", function (e) {
  if (!e.target.closest(".menu")) closeAllMenus();
});
searchInput.addEventListener("keyup", applySearch);
loadDoctors();
