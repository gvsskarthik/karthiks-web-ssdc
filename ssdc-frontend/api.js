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

  function getAuthToken() {
    try {
      if (!window.localStorage) {
        return null;
      }
      const raw = window.localStorage.getItem(AUTH_TOKEN_KEY);
      const token = raw ? String(raw).trim() : "";
      return token ? token : null;
    } catch (err) {
      return null;
    }
  }

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
        if (response && response.ok && isApiUrl(absUrl)) {
          clearCache();
        }
        return response;
      });
    }

    if (!isApiUrl(absUrl) || shouldBypassCache(finalRequest, init)) {
      return nativeFetch(finalRequest);
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
      cacheResponse(absUrl, response);
      return response;
    });
  };
})();
