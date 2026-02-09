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

  function resolveFrontendUrl(path) {
    const clean = String(path || "").replace(/^\//, "");
    try {
      const scripts = document.getElementsByTagName("script");
      for (let i = 0; i < scripts.length; i++) {
        const src = scripts[i] && scripts[i].src ? String(scripts[i].src) : "";
        if (!src) continue;
        if (/\/api\.js(?:[?#]|$)/.test(src)) {
          const base = new URL(src, window.location.href);
          return new URL(clean, base).toString();
        }
      }
    } catch (err) {
      // ignore
    }
    return window.location.origin.replace(/\/$/, "") + "/" + clean;
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
    let sessionSyncLocked = false;
    let loginAutoApplyTimer = null;

    function clearLoginAutoApplyTimer() {
      if (loginAutoApplyTimer) {
        try {
          window.clearTimeout(loginAutoApplyTimer);
        } catch (err) {
          // ignore
        }
        loginAutoApplyTimer = null;
      }
    }

    function lockSessionSync() {
      sessionSyncLocked = true;
      pendingRequestId = null;
      clearLoginAutoApplyTimer();
    }

    // Expose lock for login page to prevent "cross-tab auto-login" from
    // overriding a manual login to a different user.
    try {
      window.__ssdcLockSessionSync = lockSessionSync;
    } catch (err) {
      // ignore
    }

    function isLoginFormDirty() {
      try {
        const form = document.getElementById("loginForm");
        if (!form) {
          return false;
        }
        const labId = document.getElementById("loginLabId");
        const pass = document.getElementById("loginPass");
        const hasValues =
          (labId && String(labId.value || "").trim()) ||
          (pass && String(pass.value || "").trim());
        if (hasValues) {
          return true;
        }
        const active = document.activeElement;
        return Boolean(active && form.contains(active));
      } catch (err) {
        return false;
      }
    }

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
        if (sessionSyncLocked) {
          pendingRequestId = null;
          return;
        }
        if (getAuthToken()) {
          pendingRequestId = null;
          return;
        }

        // On the login page, only auto-apply the shared session if the user
        // hasn't started typing (prevents landing in the "wrong user").
        const isLoginPage = Boolean(document.getElementById("loginForm"));
        if (isLoginPage) {
          if (isLoginFormDirty()) {
            pendingRequestId = null;
            return;
          }
          clearLoginAutoApplyTimer();
          loginAutoApplyTimer = window.setTimeout(() => {
            loginAutoApplyTimer = null;
            if (sessionSyncLocked || getAuthToken() || isLoginFormDirty()) {
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
              window.location.href = "dashboard.html";
            } catch (err) {
              // ignore
            }
          }, 400);
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

  // ===== Soft popups (replace alert/confirm/prompt) =====
  let popupChain = Promise.resolve();
  let popupUi = null;

  function enqueuePopup(task) {
    const run = () => Promise.resolve().then(task);
    const next = popupChain.then(run, run);
    popupChain = next.catch(() => {});
    return next;
  }

  function waitForDomReady() {
    return new Promise((resolve) => {
      const ready = () => Boolean(document && document.body && document.head);
      if (ready()) {
        resolve();
        return;
      }
      const tick = () => {
        if (ready()) {
          resolve();
        } else {
          window.setTimeout(tick, 50);
        }
      };
      tick();
    });
  }

  function ensurePopupUi() {
    if (popupUi) {
      return Promise.resolve(popupUi);
    }

    return waitForDomReady().then(() => {
      const existing = document.getElementById("ssdc-popup-overlay");
      if (existing) {
        popupUi = {
          overlay: existing,
          card: existing.querySelector(".ssdc-popup-card"),
          title: existing.querySelector(".ssdc-popup-title"),
          close: existing.querySelector(".ssdc-popup-x"),
          message: existing.querySelector(".ssdc-popup-message"),
          inputWrap: existing.querySelector(".ssdc-popup-input-wrap"),
          input: existing.querySelector(".ssdc-popup-input"),
          actions: existing.querySelector(".ssdc-popup-actions"),
          ok: existing.querySelector("[data-ssdc-popup-ok]"),
          cancel: existing.querySelector("[data-ssdc-popup-cancel]")
        };
        return popupUi;
      }

      const overlay = document.createElement("div");
      overlay.id = "ssdc-popup-overlay";
      overlay.className = "ssdc-popup-overlay";
      overlay.setAttribute("aria-hidden", "true");
      overlay.innerHTML = `
        <div class="ssdc-popup-card" role="dialog" aria-modal="true" tabindex="-1">
          <div class="ssdc-popup-header">
            <h3 class="ssdc-popup-title"></h3>
            <button type="button" class="ssdc-popup-x" aria-label="Close">×</button>
          </div>
          <div class="ssdc-popup-message"></div>
          <div class="ssdc-popup-input-wrap" style="display:none;">
            <input class="ssdc-popup-input" />
          </div>
          <div class="ssdc-popup-actions">
            <button type="button" class="ssdc-popup-btn secondary" data-ssdc-popup-cancel>Cancel</button>
            <button type="button" class="ssdc-popup-btn primary" data-ssdc-popup-ok>OK</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      popupUi = {
        overlay,
        card: overlay.querySelector(".ssdc-popup-card"),
        title: overlay.querySelector(".ssdc-popup-title"),
        close: overlay.querySelector(".ssdc-popup-x"),
        message: overlay.querySelector(".ssdc-popup-message"),
        inputWrap: overlay.querySelector(".ssdc-popup-input-wrap"),
        input: overlay.querySelector(".ssdc-popup-input"),
        actions: overlay.querySelector(".ssdc-popup-actions"),
        ok: overlay.querySelector("[data-ssdc-popup-ok]"),
        cancel: overlay.querySelector("[data-ssdc-popup-cancel]")
      };
      return popupUi;
    });
  }

  function getFocusable(container) {
    const root = container || document;
    return [...root.querySelectorAll(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
    )]
      .filter((el) => el && !el.disabled && el.getAttribute("aria-hidden") !== "true")
      .filter((el) => {
        try {
          return (el.offsetWidth || el.offsetHeight || el.getClientRects().length);
        } catch (err) {
          return false;
        }
      });
  }

  function showSoftPopup(config) {
    const opts = config && typeof config === "object" ? config : {};
    const kind = String(opts.kind || "alert");
    const titleText = opts.title == null ? "" : String(opts.title);
    const messageText = opts.message == null ? "" : String(opts.message);
    const okText = opts.okText == null ? "OK" : String(opts.okText);
    const cancelText = opts.cancelText == null ? "Cancel" : String(opts.cancelText);
    const okVariant = String(opts.okVariant || "");
    const inputType = opts.inputType == null ? "text" : String(opts.inputType);
    const inputValue = opts.inputValue == null ? "" : String(opts.inputValue);
    const inputPlaceholder = opts.inputPlaceholder == null ? "" : String(opts.inputPlaceholder);

    return enqueuePopup(async () => {
      const ui = await ensurePopupUi();

      const host = ui.overlay;
      const card = ui.card;
      const okBtn = ui.ok;
      const cancelBtn = ui.cancel;
      const closeBtn = ui.close;
      const titleEl = ui.title;
      const msgEl = ui.message;
      const inputWrap = ui.inputWrap;
      const inputEl = ui.input;

      let prevFocus = null;
      try {
        prevFocus = document.activeElement;
      } catch (err) {
        prevFocus = null;
      }

      titleEl.textContent = titleText;
      titleEl.style.display = titleText ? "" : "none";
      msgEl.textContent = messageText;

      okBtn.textContent = okText;
      cancelBtn.textContent = cancelText;

      okBtn.classList.remove("ssdc-danger");
      if (okVariant === "danger") {
        okBtn.classList.add("ssdc-danger");
      }

      const needsCancel = kind === "confirm" || kind === "prompt";
      cancelBtn.style.display = needsCancel ? "" : "none";

      const needsInput = kind === "prompt";
      inputWrap.style.display = needsInput ? "" : "none";
      if (needsInput) {
        inputEl.type = inputType === "password" ? "password" : "text";
        inputEl.value = inputValue;
        inputEl.placeholder = inputPlaceholder;
      } else {
        inputEl.value = "";
        inputEl.placeholder = "";
      }

      host.classList.add("show");
      host.setAttribute("aria-hidden", "false");

      return new Promise((resolve) => {
        let finished = false;

        const restoreFocus = () => {
          try {
            if (prevFocus && typeof prevFocus.focus === "function") {
              prevFocus.focus();
            }
          } catch (err) {
            // ignore
          }
        };

        const cleanup = () => {
          okBtn.removeEventListener("click", onOk);
          cancelBtn.removeEventListener("click", onCancel);
          closeBtn.removeEventListener("click", onCancel);
          host.removeEventListener("click", onOverlayClick);
          document.removeEventListener("keydown", onKeyDown, true);
          host.classList.remove("show");
          host.setAttribute("aria-hidden", "true");
        };

        const finish = (value) => {
          if (finished) {
            return;
          }
          finished = true;
          cleanup();
          restoreFocus();
          resolve(value);
        };

        const okValue = () => {
          if (kind === "prompt") {
            return inputEl.value;
          }
          return true;
        };

        const cancelValue = () => {
          if (kind === "prompt") {
            return null;
          }
          if (kind === "confirm") {
            return false;
          }
          return true;
        };

        const onOk = () => finish(okValue());
        const onCancel = () => finish(cancelValue());

        const onOverlayClick = (event) => {
          if (event && event.target === host) {
            onCancel();
          }
        };

        const onKeyDown = (event) => {
          if (!event) {
            return;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
            return;
          }
          if (event.key === "Enter") {
            const active = document.activeElement;
            const isTextArea = active && active.tagName === "TEXTAREA";
            if (!isTextArea) {
              event.preventDefault();
              onOk();
            }
            return;
          }
          if (event.key === "Tab") {
            const focusable = getFocusable(card);
            if (!focusable.length) {
              event.preventDefault();
              return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const current = document.activeElement;
            if (event.shiftKey) {
              if (current === first || !card.contains(current)) {
                event.preventDefault();
                last.focus();
              }
              return;
            }
            if (current === last) {
              event.preventDefault();
              first.focus();
            }
          }
        };

        okBtn.addEventListener("click", onOk);
        cancelBtn.addEventListener("click", onCancel);
        closeBtn.addEventListener("click", onCancel);
        host.addEventListener("click", onOverlayClick);
        document.addEventListener("keydown", onKeyDown, true);

        window.setTimeout(() => {
          try {
            if (needsInput) {
              inputEl.focus();
              inputEl.select();
              return;
            }
            okBtn.focus();
          } catch (err) {
            // ignore
          }
        }, 0);
      });
    });
  }

  function ssdcAlert(message, options) {
    const topWin = safeTopWindow();
    if (topWin !== window) {
      try {
        if (typeof topWin.ssdcAlert === "function") {
          return topWin.ssdcAlert(message, options);
        }
      } catch (err) {
        // ignore
      }
    }
    const opts = options && typeof options === "object" ? options : {};
    return showSoftPopup({
      kind: "alert",
      title: opts.title,
      message,
      okText: opts.okText || "OK",
      okVariant: opts.okVariant
    }).then(() => {});
  }

  function ssdcConfirm(message, options) {
    const topWin = safeTopWindow();
    if (topWin !== window) {
      try {
        if (typeof topWin.ssdcConfirm === "function") {
          return topWin.ssdcConfirm(message, options);
        }
      } catch (err) {
        // ignore
      }
    }
    const opts = options && typeof options === "object" ? options : {};
    return showSoftPopup({
      kind: "confirm",
      title: opts.title,
      message,
      okText: opts.okText || "OK",
      cancelText: opts.cancelText || "Cancel",
      okVariant: opts.okVariant
    }).then((value) => Boolean(value));
  }

  function ssdcPrompt(message, options) {
    const topWin = safeTopWindow();
    if (topWin !== window) {
      try {
        if (typeof topWin.ssdcPrompt === "function") {
          return topWin.ssdcPrompt(message, options);
        }
      } catch (err) {
        // ignore
      }
    }
    const opts = options && typeof options === "object" ? options : {};
    return showSoftPopup({
      kind: "prompt",
      title: opts.title,
      message,
      okText: opts.okText || "OK",
      cancelText: opts.cancelText || "Cancel",
      okVariant: opts.okVariant,
      inputType: opts.inputType || "text",
      inputValue: opts.inputValue || "",
      inputPlaceholder: opts.inputPlaceholder || ""
    }).then((value) => (value == null ? null : String(value)));
  }

  window.ssdcAlert = ssdcAlert;
  window.ssdcConfirm = ssdcConfirm;
  window.ssdcPrompt = ssdcPrompt;

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
      const loginUrl = resolveFrontendUrl("index.html") + suffix;
      topWin.location.href = loginUrl;
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

  function isLoginPageLocation(win) {
    try {
      const pathname = String(win && win.location && win.location.pathname ? win.location.pathname : "");
      if (pathname === "/" || /\/index\.html$/i.test(pathname)) {
        return true;
      }
    } catch (err) {
      // ignore
    }
    try {
      return Boolean(document.getElementById("loginForm"));
    } catch (err) {
      return false;
    }
  }

  function enforceLoginIfMissingToken() {
    if (getAuthToken()) {
      return;
    }
    const topWin = safeTopWindow();
    if (isLoginPageLocation(topWin)) {
      return;
    }
    redirectToLogin();
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
  padding: 18px;
  background: rgba(30, 38, 45, 0.30);
  backdrop-filter: blur(4px);
  z-index: 999999;
}
#ssdc-idle-warning-overlay.show {
  display: flex;
}
#ssdc-idle-warning-overlay .ssdc-idle-box {
  width: min(92vw, 420px);
  border-radius: var(--radius-lg, 22px);
  padding: 18px 16px;
  background: var(--theme-surface, #fffaf2);
  color: var(--theme-ink, #1e262d);
  box-shadow:
    0 26px 70px rgba(28, 41, 61, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.65);
  border: 1px solid var(--theme-line, #e3d9c9);
}
#ssdc-idle-warning-overlay .ssdc-idle-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 8px;
}
#ssdc-idle-warning-overlay .ssdc-idle-countdown {
  font-size: 14px;
  color: var(--theme-muted, #6b737c);
  margin: 0;
}
#ssdc-idle-warning-overlay .ssdc-idle-hint {
  font-size: 12px;
  color: var(--theme-muted, #6b737c);
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
      let reason = "broadcast";
      try {
        const payload = event.newValue ? JSON.parse(String(event.newValue)) : null;
        if (payload && payload.reason) {
          reason = String(payload.reason);
        }
      } catch (err) {
        // ignore
      }
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

  try {
    enforceLoginIfMissingToken();
  } catch (err) {
    // ignore
  }
})();
