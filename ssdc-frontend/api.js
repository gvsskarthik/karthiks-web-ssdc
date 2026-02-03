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

  // ===== Time zone helpers (IST / Hyderabad) =====
  // Use these for UI date/time so midnight behaves correctly in IST even if
  // device/browser timezone is misconfigured.
  window.IST_TIME_ZONE = "Asia/Kolkata";

  window.formatIstDateDisplay = function (date) {
    const d = date instanceof Date ? date : new Date();
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: window.IST_TIME_ZONE
    }).format(d);
  };

  window.formatIstDateTimeDisplay = function (date) {
    const d = date instanceof Date ? date : new Date();
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: window.IST_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(d);
  };

  window.getIstDateInputValue = function (date) {
    const d = date instanceof Date ? date : new Date();
    // "en-CA" reliably produces YYYY-MM-DD.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: window.IST_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(d);
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
  const AUTH_TOKEN_KEY = "SSDC_AUTH_TOKEN";
  const LAB_NAME_KEY = "SSDC_LAB_NAME";
  const LOGOUT_BROADCAST_KEY = "SSDC_LOGOUT_BROADCAST";
  const SESSION_REQUEST_KEY = "SSDC_SESSION_REQUEST";
  const SESSION_RESPONSE_KEY = "SSDC_SESSION_RESPONSE";

  function canUseSessionStorage() {
    try {
      return Boolean(window.sessionStorage);
    } catch (err) {
      return false;
    }
  }

  function canUseStorage() {
    try {
      return Boolean(window.localStorage);
    } catch (err) {
      return false;
    }
  }

  function readStorageValue(storage, key) {
    try {
      if (!storage) {
        return null;
      }
      const raw = storage.getItem(key);
      const value = raw ? String(raw).trim() : "";
      return value ? value : null;
    } catch (err) {
      return null;
    }
  }

  function writeStorageValue(storage, key, value) {
    try {
      if (!storage) {
        return;
      }
      storage.setItem(key, String(value || ""));
    } catch (err) {
      // Ignore storage write errors.
    }
  }

  function removeStorageValue(storage, key) {
    try {
      if (!storage) {
        return;
      }
      storage.removeItem(key);
    } catch (err) {
      // Ignore storage remove errors.
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

  function getAuthToken() {
    const sessionToken = readStorageValue(
      canUseSessionStorage() ? window.sessionStorage : null,
      AUTH_TOKEN_KEY
    );
    if (sessionToken) {
      return sessionToken;
    }

    // Legacy migration: previously we stored tokens in localStorage.
    const legacy = readStorageValue(
      canUseStorage() ? window.localStorage : null,
      AUTH_TOKEN_KEY
    );
    if (!legacy) {
      return null;
    }

    // Move token to sessionStorage (logout on tab close) and remove from localStorage.
    if (canUseSessionStorage()) {
      writeStorageValue(window.sessionStorage, AUTH_TOKEN_KEY, legacy);
    }
    if (canUseStorage()) {
      removeStorageValue(window.localStorage, AUTH_TOKEN_KEY);
    }
    return legacy;
  }

  function setAuthToken(token) {
    const value = String(token || "").trim();
    if (!value) {
      clearAuthToken();
      return;
    }
    if (canUseSessionStorage()) {
      writeStorageValue(window.sessionStorage, AUTH_TOKEN_KEY, value);
    }
    if (canUseStorage()) {
      removeStorageValue(window.localStorage, AUTH_TOKEN_KEY);
    }
  }

  function clearAuthToken() {
    if (canUseSessionStorage()) {
      removeStorageValue(window.sessionStorage, AUTH_TOKEN_KEY);
    }
    if (canUseStorage()) {
      removeStorageValue(window.localStorage, AUTH_TOKEN_KEY);
    }
    clearLabName();
  }

  function getLabName() {
    const fromSession = readStorageValue(
      canUseSessionStorage() ? window.sessionStorage : null,
      LAB_NAME_KEY
    );
    if (fromSession) {
      return fromSession;
    }

    // Legacy migration (if ever stored in localStorage).
    const legacy = readStorageValue(
      canUseStorage() ? window.localStorage : null,
      LAB_NAME_KEY
    );
    if (!legacy) {
      return null;
    }
    if (canUseSessionStorage()) {
      writeStorageValue(window.sessionStorage, LAB_NAME_KEY, legacy);
    }
    if (canUseStorage()) {
      removeStorageValue(window.localStorage, LAB_NAME_KEY);
    }
    return legacy;
  }

  function setLabName(name) {
    const value = String(name || "").trim();
    if (!value) {
      clearLabName();
      return;
    }
    if (canUseSessionStorage()) {
      writeStorageValue(window.sessionStorage, LAB_NAME_KEY, value);
    }
    if (canUseStorage()) {
      removeStorageValue(window.localStorage, LAB_NAME_KEY);
    }
  }

  function clearLabName() {
    if (canUseSessionStorage()) {
      removeStorageValue(window.sessionStorage, LAB_NAME_KEY);
    }
    if (canUseStorage()) {
      removeStorageValue(window.localStorage, LAB_NAME_KEY);
    }
  }

  // Share sessionStorage auth token across tabs while the browser is open
  // (new tabs should stay logged in), without persisting the token in
  // localStorage (so closing the browser ends the session).
  function installSessionSync() {
    if (!canUseSessionStorage() || !canUseStorage()) {
      return;
    }
    if (window.__ssdcSessionSyncInstalled) {
      return;
    }
    window.__ssdcSessionSyncInstalled = true;

    let pendingRequestId = null;

    function parsePayload(raw) {
      try {
        return raw ? JSON.parse(String(raw)) : null;
      } catch (err) {
        return null;
      }
    }

    function broadcastResponse(requestId) {
      const token = getAuthToken();
      if (!token) {
        return;
      }
      const payload = {
        id: requestId,
        ts: Date.now(),
        token,
        labName: getLabName() || null
      };
      try {
        window.localStorage.setItem(SESSION_RESPONSE_KEY, JSON.stringify(payload));
        window.setTimeout(() => {
          try {
            window.localStorage.removeItem(SESSION_RESPONSE_KEY);
          } catch (err) {
            // ignore
          }
        }, 800);
      } catch (err) {
        // ignore
      }
    }

    window.addEventListener("storage", (event) => {
      if (!event || !event.key) {
        return;
      }

      if (event.key === SESSION_REQUEST_KEY) {
        const payload = parsePayload(event.newValue);
        if (!payload || !payload.id) {
          return;
        }
        broadcastResponse(payload.id);
        return;
      }

      if (event.key === SESSION_RESPONSE_KEY) {
        const payload = parsePayload(event.newValue);
        if (!payload || !payload.token || !payload.id) {
          return;
        }
        if (!pendingRequestId || payload.id !== pendingRequestId) {
          return;
        }
        if (getAuthToken()) {
          pendingRequestId = null;
          return;
        }

        setAuthToken(payload.token);
        if (payload.labName) {
          setLabName(payload.labName);
        }
        try {
          applyLabNameToDom(payload.labName);
        } catch (err) {
          // ignore
        }

        pendingRequestId = null;

        try {
          if (document.getElementById("loginForm")) {
            window.location.href = "dashboard.html";
          }
        } catch (err) {
          // ignore
        }
      }
    });

    if (!getAuthToken()) {
      pendingRequestId = `${Date.now()}:${Math.random().toString(16).slice(2)}`;
      try {
        window.localStorage.setItem(
          SESSION_REQUEST_KEY,
          JSON.stringify({ id: pendingRequestId, ts: Date.now() })
        );
        window.setTimeout(() => {
          try {
            window.localStorage.removeItem(SESSION_REQUEST_KEY);
          } catch (err) {
            // ignore
          }
        }, 800);
      } catch (err) {
        pendingRequestId = null;
      }
    }
  }

  installSessionSync();

  let labProfileInFlight = null;

  function fetchLabProfile() {
    if (labProfileInFlight) {
      return labProfileInFlight;
    }
    if (!getAuthToken() || typeof window.fetch !== "function") {
      return Promise.resolve(null);
    }

    const url = typeof window.apiUrl === "function"
      ? window.apiUrl("/lab/me")
      : "/api/lab/me";

    labProfileInFlight = window.fetch(url, { cache: "no-store" })
      .then((res) => res.text().then((text) => {
        if (!res.ok) {
          throw new Error(text || `Request failed: ${res.status}`);
        }
        try {
          return text ? JSON.parse(text) : null;
        } catch (err) {
          return null;
        }
      }))
      .then((data) => {
        const name = data && data.labName ? String(data.labName).trim() : "";
        if (name) {
          setLabName(name);
        }
        return data || null;
      })
      .catch(() => null)
      .finally(() => {
        labProfileInFlight = null;
      });

    return labProfileInFlight;
  }

  function applyLabNameToDom(labName) {
    const value = String(labName || getLabName() || "").trim();
    if (!value) {
      return false;
    }
    try {
      document.querySelectorAll("[data-ssdc-lab-name]").forEach((el) => {
        if (el) {
          el.textContent = value;
        }
      });
      return true;
    } catch (err) {
      return false;
    }
  }

  function ensureLabNameApplied() {
    if (applyLabNameToDom()) {
      return;
    }
    if (!getAuthToken()) {
      return;
    }
    fetchLabProfile().then((data) => {
      if (data && data.labName) {
        applyLabNameToDom(data.labName);
      }
    });
  }

  function safeTopWindow() {
    try {
      return window.top && window.top.location ? window.top : window;
    } catch (err) {
      return window;
    }
  }

  function broadcastLogout(reason) {
    try {
      if (!canUseStorage()) {
        return;
      }
      const payload = JSON.stringify({
        ts: Date.now(),
        reason: reason || null
      });
      window.localStorage.setItem(LOGOUT_BROADCAST_KEY, payload);
    } catch (err) {
      // Ignore.
    }
  }

  function redirectToLogin(reason) {
    const topWin = safeTopWindow();
    try {
      const suffix = reason ? `?loggedOut=1&reason=${encodeURIComponent(reason)}` : "";
      topWin.location.href = "index.html" + suffix;
    } catch (err) {
      // ignore
    }
  }

  function forceLogout(reason) {
    clearAuthToken();
    broadcastLogout(reason);
    redirectToLogin(reason);
  }

  // Expose minimal auth helpers for pages.
  window.getAuthToken = getAuthToken;
  window.setAuthToken = setAuthToken;
  window.clearAuthToken = clearAuthToken;
  window.forceLogout = forceLogout;
  window.getLabName = getLabName;
  window.setLabName = setLabName;
  window.clearLabName = clearLabName;
  window.applyLabNameToDom = applyLabNameToDom;

  function withAuth(request) {
    const token = getAuthToken();
    if (!token) {
      return request;
    }
    try {
      const headers = new Headers(request.headers || {});
      if (!headers.has("Authorization")) {
        headers.set("Authorization", "Bearer " + token);
      }
      return new Request(request, { headers });
    } catch (err) {
      return request;
    }
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
    // Never serve cached API responses across different logged-in labs/users.
    if (getAuthToken()) {
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
    const finalRequest = isApiUrl(absUrl) ? withAuth(request) : request;

    if (method !== "GET") {
      return nativeFetch(finalRequest).then((response) => {
        if (response && isApiUrl(absUrl) && getAuthToken()) {
          if (response.status === 401 || response.status === 403) {
            if (absUrl.indexOf("/auth/") === -1) {
              forceLogout("expired");
            }
          }
        }
        if (response && response.ok && isApiUrl(absUrl)) {
          clearCache();
        }
        return response;
      });
    }

    if (!isApiUrl(absUrl) || shouldBypassCache(finalRequest, init)) {
      return nativeFetch(finalRequest).then((response) => {
        if (response && isApiUrl(absUrl) && getAuthToken()) {
          if (response.status === 401 || response.status === 403) {
            if (absUrl.indexOf("/auth/") === -1) {
              forceLogout("expired");
            }
          }
        }
        return response;
      });
    }

    const cached = readCache(absUrl);
    const now = Date.now();
    if (cached) {
      const age = now - cached.ts;
      if (age <= cacheConfig.ttlMs) {
        return Promise.resolve(buildResponse(cached, "HIT"));
      }
      if (age <= cacheConfig.staleMs) {
        revalidate(absUrl, finalRequest);
        return Promise.resolve(buildResponse(cached, "STALE"));
      }
    }

    return nativeFetch(finalRequest).then((response) => {
      if (response && isApiUrl(absUrl) && getAuthToken()) {
        if (response.status === 401 || response.status === 403) {
          if (absUrl.indexOf("/auth/") === -1) {
            forceLogout("expired");
          }
        }
      }
      cacheResponse(absUrl, response);
      return response;
    });
  };

  // ===== Idle auto-logout (20 min) with 120s warning =====
  const IDLE_TIMEOUT_MS = 20 * 60 * 1000;
  const IDLE_WARNING_MS = 120 * 1000;
  const IDLE_ACTIVITY_EVENTS = [
    "mousemove",
    "mousedown",
    "keydown",
    "touchstart",
    "scroll",
    "wheel",
    "pointerdown"
  ];

  function installIdleManagerTop() {
    const topWin = safeTopWindow();
    if (topWin !== window) {
      return;
    }
    if (window.__ssdcIdleInstalled) {
      return;
    }
    window.__ssdcIdleInstalled = true;

    let lastActivityMs = Date.now();
    let warningVisible = false;
    let overlayEl = null;
    let countdownEl = null;

    function ensureWarningUi() {
      if (overlayEl && countdownEl) {
        return;
      }
      const ready = () => Boolean(document.body && document.head);
      if (!ready()) {
        window.setTimeout(ensureWarningUi, 50);
        return;
      }

      const existing = document.getElementById("ssdc-idle-warning-overlay");
      if (existing) {
        overlayEl = existing;
        countdownEl = document.getElementById("ssdc-idle-countdown");
        return;
      }

      const style = document.createElement("style");
      style.id = "ssdc-idle-warning-style";
      style.textContent = `
#ssdc-idle-warning-overlay {
  position: fixed;
  inset: 0;
  display: none;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  z-index: 999999;
}
#ssdc-idle-warning-overlay.show {
  display: flex;
}
#ssdc-idle-warning-overlay .ssdc-idle-box {
  width: min(92vw, 420px);
  border-radius: 14px;
  padding: 18px 16px;
  background: rgba(20, 20, 20, 0.98);
  color: #fff;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.10);
}
#ssdc-idle-warning-overlay .ssdc-idle-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 8px;
}
#ssdc-idle-warning-overlay .ssdc-idle-countdown {
  font-size: 14px;
  opacity: 0.92;
  margin: 0;
}
#ssdc-idle-warning-overlay .ssdc-idle-hint {
  font-size: 12px;
  opacity: 0.75;
  margin: 10px 0 0;
}
`;
      document.head.appendChild(style);

      overlayEl = document.createElement("div");
      overlayEl.id = "ssdc-idle-warning-overlay";
      overlayEl.innerHTML = `
        <div class="ssdc-idle-box" role="alertdialog" aria-live="assertive">
          <div class="ssdc-idle-title">Logged out due to inactivity</div>
          <p class="ssdc-idle-countdown" id="ssdc-idle-countdown">Time left: 120 seconds</p>
          <p class="ssdc-idle-hint">Move mouse / press any key to stay logged in.</p>
        </div>
      `;
      document.body.appendChild(overlayEl);
      countdownEl = document.getElementById("ssdc-idle-countdown");
    }

    function hideWarning() {
      ensureWarningUi();
      if (!overlayEl) {
        return;
      }
      overlayEl.classList.remove("show");
      warningVisible = false;
    }

    function showWarning(secondsLeft) {
      ensureWarningUi();
      if (!overlayEl || !countdownEl) {
        return;
      }
      overlayEl.classList.add("show");
      warningVisible = true;
      const s = Math.max(0, Math.ceil(Number(secondsLeft) || 0));
      countdownEl.textContent = `Time left: ${s} seconds`;
    }

    function checkIdle(nowMs) {
      if (!getAuthToken()) {
        if (warningVisible) {
          hideWarning();
        }
        lastActivityMs = nowMs;
        return;
      }

      const idleMs = nowMs - lastActivityMs;
      if (idleMs >= IDLE_TIMEOUT_MS) {
        hideWarning();
        forceLogout("idle");
        return;
      }

      const remainingMs = IDLE_TIMEOUT_MS - idleMs;
      if (remainingMs <= IDLE_WARNING_MS) {
        showWarning(remainingMs / 1000);
      } else if (warningVisible) {
        hideWarning();
      }
    }

    function onActivity() {
      const now = Date.now();
      // If already exceeded, logout immediately (don't "revive" on first event).
      if (getAuthToken() && now - lastActivityMs >= IDLE_TIMEOUT_MS) {
        forceLogout("idle");
        return;
      }
      lastActivityMs = now;
      if (warningVisible) {
        hideWarning();
      }
    }

    window.__ssdcIdleOnActivity = onActivity;

    // Receive forwarded activity from iframes.
    window.addEventListener("message", (event) => {
      try {
        if (event.origin !== window.location.origin) {
          return;
        }
      } catch (err) {
        return;
      }
      const data = event && event.data;
      if (data && data.type === "SSDC_ACTIVITY") {
        onActivity();
      }
    });

    // Cross-tab logout broadcast.
    window.addEventListener("storage", (event) => {
      if (!event || event.key !== LOGOUT_BROADCAST_KEY) {
        return;
      }
      const reason = "broadcast";
      clearAuthToken();
      redirectToLogin(reason);
    });

    IDLE_ACTIVITY_EVENTS.forEach((evt) => {
      window.addEventListener(evt, onActivity, { passive: true });
    });
    document.addEventListener("visibilitychange", () => checkIdle(Date.now()));
    window.addEventListener("focus", () => checkIdle(Date.now()));
    window.setInterval(() => checkIdle(Date.now()), 1000);
  }

  function installIdleActivityForwarderFrame() {
    const topWin = safeTopWindow();
    if (topWin === window) {
      return;
    }
    if (window.__ssdcIdleForwarderInstalled) {
      return;
    }
    window.__ssdcIdleForwarderInstalled = true;

    function forward() {
      try {
        if (topWin && typeof topWin.__ssdcIdleOnActivity === "function") {
          topWin.__ssdcIdleOnActivity();
          return;
        }
      } catch (err) {
        // ignore
      }
      try {
        topWin.postMessage({ type: "SSDC_ACTIVITY" }, window.location.origin);
      } catch (err) {
        // ignore
      }
    }

    IDLE_ACTIVITY_EVENTS.forEach((evt) => {
      window.addEventListener(evt, forward, { passive: true });
    });
  }

  installIdleManagerTop();
  installIdleActivityForwarderFrame();

  try {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", ensureLabNameApplied);
    } else {
      ensureLabNameApplied();
    }
  } catch (err) {
    // ignore
  }
})();
