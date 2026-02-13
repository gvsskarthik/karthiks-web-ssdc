(function () {
  const labNameInput = document.getElementById("labNameInput");
  const editBtn = document.getElementById("editLabNameBtn");
  const saveBtn = document.getElementById("saveLabNameBtn");
  const cancelBtn = document.getElementById("cancelLabNameBtn");
  const statusEl = document.getElementById("labNameStatus");

  const currentPasswordInput = document.getElementById("currentPasswordInput");
  const newPasswordInput = document.getElementById("newPasswordInput");
  const confirmPasswordInput = document.getElementById("confirmPasswordInput");
  const toggleCurrentPasswordBtn = document.getElementById("toggleCurrentPasswordBtn");
  const toggleNewPasswordBtn = document.getElementById("toggleNewPasswordBtn");
  const toggleConfirmPasswordBtn = document.getElementById("toggleConfirmPasswordBtn");
  const changePasswordBtn = document.getElementById("changePasswordBtn");
  const passwordStatusEl = document.getElementById("passwordStatus");

  const twoFactorBadge = document.getElementById("twoFactorBadge");
  const twoFactorEnabledMeta = document.getElementById("twoFactorEnabledMeta");
  const twoFactorSetupSection = document.getElementById("twoFactorSetupSection");
  const twoFactorDisableSection = document.getElementById("twoFactorDisableSection");
  const twoFactorStatusEl = document.getElementById("twoFactorStatusText");

  const twoFactorSetupPasswordInput = document.getElementById("twoFactorSetupPasswordInput");
  const toggleTwoFactorSetupPasswordBtn = document.getElementById("toggleTwoFactorSetupPasswordBtn");
  const twoFactorStartSetupBtn = document.getElementById("twoFactorStartSetupBtn");

  const twoFactorSetupResult = document.getElementById("twoFactorSetupResult");
  const twoFactorManualKeyInput = document.getElementById("twoFactorManualKeyInput");
  const copyTwoFactorManualKeyBtn = document.getElementById("copyTwoFactorManualKeyBtn");
  const twoFactorOtpAuthLink = document.getElementById("twoFactorOtpAuthLink");
  const twoFactorSetupExpiresText = document.getElementById("twoFactorSetupExpiresText");
  const twoFactorEnableCodeInput = document.getElementById("twoFactorEnableCodeInput");
  const twoFactorEnableBtn = document.getElementById("twoFactorEnableBtn");

  const twoFactorDisablePasswordInput = document.getElementById("twoFactorDisablePasswordInput");
  const toggleTwoFactorDisablePasswordBtn = document.getElementById("toggleTwoFactorDisablePasswordBtn");
  const twoFactorDisableCodeInput = document.getElementById("twoFactorDisableCodeInput");
  const twoFactorDisableBtn = document.getElementById("twoFactorDisableBtn");

  if (!labNameInput || !editBtn || !saveBtn || !cancelBtn) {
    return;
  }

  function setTextStatus(el, message, isError) {
    if (!el) {
      return;
    }
    el.textContent = message || "";
    el.style.color = isError ? "#ff7a7a" : "";
  }

  function setStatus(message, isError) {
    setTextStatus(statusEl, message, isError);
  }

  function setPasswordStatus(message, isError) {
    setTextStatus(passwordStatusEl, message, isError);
  }

  function setTwoFactorStatus(message, isError) {
    setTextStatus(twoFactorStatusEl, message, isError);
  }

  function api(path) {
    if (typeof window.apiUrl === "function") {
      return window.apiUrl(path);
    }
    const base = window.API_BASE_URL || "/api";
    return base.replace(/\/$/, "") + path;
  }

  function getToken() {
    return typeof window.getAuthToken === "function" ? window.getAuthToken() : null;
  }

  function setLabName(name) {
    if (typeof window.setLabName === "function") {
      window.setLabName(name);
    }
  }

  function trimToNull(value) {
    const next = String(value == null ? "" : value).trim();
    return next ? next : null;
  }

  function digitsOnly(value, maxLength) {
    return String(value == null ? "" : value).replace(/\D+/g, "").slice(0, maxLength || 6);
  }

  function isAuthErrorMessage(message) {
    const text = String(message || "");
    return /Request failed: (401|403)\b/.test(text)
      || /\b(401|403)\b/.test(text)
      || /unauthorized|forbidden|authentication required/i.test(text);
  }

  function logoutToLogin(reason) {
    if (typeof window.forceLogout === "function") {
      window.forceLogout(reason);
      return;
    }
    try {
      (window.top || window).location.href = "/index.html";
    } catch (e) {
      window.location.href = "/index.html";
    }
  }

  function ensureAuthenticated() {
    if (getToken()) {
      return true;
    }
    logoutToLogin();
    return false;
  }

  function applyEverywhere() {
    try {
      if (typeof window.applyLabNameToDom === "function") {
        window.applyLabNameToDom();
      }
    } catch (e) {
      // ignore
    }
    try {
      if (window.top && typeof window.top.applyLabNameToDom === "function") {
        window.top.applyLabNameToDom();
      }
    } catch (e) {
      // ignore
    }
  }

  function setEditing(enabled) {
    labNameInput.disabled = !enabled;
    editBtn.hidden = enabled;
    saveBtn.hidden = !enabled;
    cancelBtn.hidden = !enabled;
    if (enabled) {
      try {
        labNameInput.focus();
        labNameInput.select();
      } catch (e) {
        // ignore
      }
    }
  }

  let currentName = "";
  let twoFactorEnabled = false;
  let twoFactorEnabledAt = null;
  let twoFactorSetupData = null;

  async function fetchJson(url, init) {
    const res = await fetch(url, init);
    const text = await res.text();
    if (!res.ok) {
      const error = new Error(text || `Request failed: ${res.status}`);
      error.status = res.status;
      throw error;
    }
    if (!text) {
      return null;
    }
    try {
      return JSON.parse(text);
    } catch (e) {
      return { message: text };
    }
  }

  function installPasswordToggle(btn, input) {
    if (!btn || !input) {
      return;
    }
    btn.addEventListener("click", () => {
      const nextIsText = input.type === "password";
      input.type = nextIsText ? "text" : "password";
      const icon = btn.querySelector("i");
      if (icon) {
        icon.className = nextIsText ? "bx bx-hide" : "bx bx-show";
      }
      btn.setAttribute("aria-label", nextIsText ? "Hide password" : "Show password");
    });
  }

  function formatDateTime(value) {
    if (!value) {
      return "";
    }
    try {
      const date = new Date(value);
      if (!Number.isFinite(date.getTime())) {
        return "";
      }
      return date.toLocaleString();
    } catch (e) {
      return "";
    }
  }

  function renderTwoFactorStatus() {
    if (twoFactorBadge) {
      twoFactorBadge.classList.remove("enabled", "disabled");
      twoFactorBadge.classList.add(twoFactorEnabled ? "enabled" : "disabled");
      twoFactorBadge.textContent = twoFactorEnabled ? "Enabled" : "Disabled";
    }

    if (twoFactorEnabledMeta) {
      if (twoFactorEnabled && twoFactorEnabledAt) {
        const formatted = formatDateTime(twoFactorEnabledAt);
        twoFactorEnabledMeta.textContent = formatted
          ? `Enabled on ${formatted}`
          : "2FA is enabled.";
      } else {
        twoFactorEnabledMeta.textContent = "2FA is currently disabled.";
      }
    }

    if (twoFactorSetupSection) {
      twoFactorSetupSection.hidden = twoFactorEnabled;
    }
    if (twoFactorDisableSection) {
      twoFactorDisableSection.hidden = !twoFactorEnabled;
    }
  }

  function clearTwoFactorSetupResult() {
    twoFactorSetupData = null;
    if (twoFactorSetupResult) {
      twoFactorSetupResult.hidden = true;
    }
    if (twoFactorManualKeyInput) {
      twoFactorManualKeyInput.value = "";
    }
    if (twoFactorOtpAuthLink) {
      twoFactorOtpAuthLink.hidden = true;
      twoFactorOtpAuthLink.href = "#";
    }
    if (twoFactorSetupExpiresText) {
      twoFactorSetupExpiresText.textContent = "";
    }
    if (twoFactorEnableCodeInput) {
      twoFactorEnableCodeInput.value = "";
    }
  }

  function showTwoFactorSetupResult(data) {
    if (!twoFactorSetupResult) {
      return;
    }

    twoFactorSetupData = {
      manualEntryKey: trimToNull(data && data.manualEntryKey),
      otpauthUri: trimToNull(data && data.otpauthUri),
      setupExpiresAt: trimToNull(data && data.setupExpiresAt)
    };

    if (twoFactorManualKeyInput) {
      twoFactorManualKeyInput.value = twoFactorSetupData.manualEntryKey || "";
    }

    if (twoFactorOtpAuthLink) {
      if (twoFactorSetupData.otpauthUri) {
        twoFactorOtpAuthLink.hidden = false;
        twoFactorOtpAuthLink.href = twoFactorSetupData.otpauthUri;
      } else {
        twoFactorOtpAuthLink.hidden = true;
        twoFactorOtpAuthLink.href = "#";
      }
    }

    if (twoFactorSetupExpiresText) {
      const formatted = formatDateTime(twoFactorSetupData.setupExpiresAt);
      twoFactorSetupExpiresText.textContent = formatted
        ? `Setup expires at ${formatted}`
        : "";
    }

    twoFactorSetupResult.hidden = false;
    if (twoFactorEnableCodeInput) {
      twoFactorEnableCodeInput.value = "";
      twoFactorEnableCodeInput.focus();
    }
  }

  function validatePasswordForm() {
    if (!changePasswordBtn) {
      return;
    }
    const current = String(currentPasswordInput && currentPasswordInput.value ? currentPasswordInput.value : "");
    const next = String(newPasswordInput && newPasswordInput.value ? newPasswordInput.value : "");
    const confirm = String(confirmPasswordInput && confirmPasswordInput.value ? confirmPasswordInput.value : "");

    const ok = Boolean(
      current.trim().length > 0
        && next.trim().length >= 6
        && confirm.trim().length > 0
        && next === confirm
    );
    changePasswordBtn.disabled = !ok;
  }

  function validateTwoFactorForms() {
    if (twoFactorEnableCodeInput) {
      twoFactorEnableCodeInput.value = digitsOnly(twoFactorEnableCodeInput.value, 6);
    }
    if (twoFactorDisableCodeInput) {
      twoFactorDisableCodeInput.value = digitsOnly(twoFactorDisableCodeInput.value, 6);
    }

    if (twoFactorStartSetupBtn) {
      const currentPassword = trimToNull(twoFactorSetupPasswordInput ? twoFactorSetupPasswordInput.value : "");
      twoFactorStartSetupBtn.disabled = !currentPassword;
    }

    if (twoFactorEnableBtn) {
      const setupReady = Boolean(twoFactorSetupData && twoFactorSetupData.manualEntryKey);
      const enableCode = digitsOnly(twoFactorEnableCodeInput ? twoFactorEnableCodeInput.value : "", 6);
      twoFactorEnableBtn.disabled = !(setupReady && enableCode.length === 6);
    }

    if (twoFactorDisableBtn) {
      const disablePassword = trimToNull(twoFactorDisablePasswordInput ? twoFactorDisablePasswordInput.value : "");
      const disableCode = digitsOnly(twoFactorDisableCodeInput ? twoFactorDisableCodeInput.value : "", 6);
      twoFactorDisableBtn.disabled = !(twoFactorEnabled && disablePassword && disableCode.length === 6);
    }
  }

  async function copyText(text) {
    const value = trimToNull(text);
    if (!value) {
      return false;
    }
    try {
      if (navigator && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch (e) {
      // ignore
    }

    try {
      const el = document.createElement("textarea");
      el.value = value;
      el.setAttribute("readonly", "readonly");
      el.style.position = "absolute";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch (e) {
      return false;
    }
  }

  async function changePassword() {
    if (!ensureAuthenticated()) {
      return;
    }
    if (!currentPasswordInput || !newPasswordInput || !confirmPasswordInput || !changePasswordBtn) {
      return;
    }

    const current = String(currentPasswordInput.value || "");
    const next = String(newPasswordInput.value || "");
    const confirm = String(confirmPasswordInput.value || "");

    if (!current.trim()) {
      setPasswordStatus("Current password is required", true);
      return;
    }
    if (next.trim().length < 6) {
      setPasswordStatus("Password must be at least 6 characters", true);
      return;
    }
    if (next !== confirm) {
      setPasswordStatus("Passwords do not match", true);
      return;
    }

    changePasswordBtn.disabled = true;
    currentPasswordInput.disabled = true;
    newPasswordInput.disabled = true;
    confirmPasswordInput.disabled = true;
    setPasswordStatus("Updating...");

    try {
      const data = await fetchJson(api("/auth/change-password"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next })
      });
      setPasswordStatus((data && data.message) ? data.message : "Password updated");

      try {
        currentPasswordInput.value = "";
        newPasswordInput.value = "";
        confirmPasswordInput.value = "";
      } catch (e) {
        // ignore
      }

      window.setTimeout(() => {
        logoutToLogin("passwordChanged");
      }, 150);
    } catch (e) {
      const msg = e && e.message ? e.message : "Change password failed";
      if (isAuthErrorMessage(msg)) {
        logoutToLogin("expired");
        return;
      }
      setPasswordStatus(msg, true);
      currentPasswordInput.disabled = false;
      newPasswordInput.disabled = false;
      confirmPasswordInput.disabled = false;
      validatePasswordForm();
    }
  }

  async function loadProfile() {
    if (!ensureAuthenticated()) {
      return;
    }

    setStatus("Loading...");

    const stored = typeof window.getLabName === "function" ? window.getLabName() : null;
    if (stored) {
      currentName = stored;
      labNameInput.value = stored;
      setStatus("");
    }

    try {
      const data = await fetchJson(api("/lab/me"), { cache: "no-store" });
      const name = data && data.labName ? String(data.labName).trim() : "";
      if (name) {
        currentName = name;
        labNameInput.value = name;
        setLabName(name);
        applyEverywhere();
      }
      setStatus("");
    } catch (e) {
      const msg = e && e.message ? e.message : "Failed to load profile";
      if (isAuthErrorMessage(msg)) {
        logoutToLogin("expired");
        return;
      }
      setStatus(msg, true);
    }
  }

  async function loadTwoFactorStatus(options) {
    if (!ensureAuthenticated()) {
      return;
    }

    const silent = Boolean(options && options.silent);
    if (!silent) {
      setTwoFactorStatus("Loading 2FA status...");
    }

    try {
      const data = await fetchJson(api("/auth/2fa/status"), { cache: "no-store" });
      twoFactorEnabled = Boolean(data && data.enabled);
      twoFactorEnabledAt = data && data.enabledAt ? data.enabledAt : null;

      if (twoFactorEnabled) {
        clearTwoFactorSetupResult();
      }

      renderTwoFactorStatus();
      validateTwoFactorForms();
      if (!silent) {
        setTwoFactorStatus("");
      }
    } catch (e) {
      const msg = e && e.message ? e.message : "Failed to load 2FA status";
      if (isAuthErrorMessage(msg)) {
        logoutToLogin("expired");
        return;
      }
      if (twoFactorBadge) {
        twoFactorBadge.classList.remove("enabled", "disabled");
        twoFactorBadge.textContent = "Unavailable";
      }
      setTwoFactorStatus(msg, true);
    }
  }

  async function startTwoFactorSetup() {
    if (!ensureAuthenticated()) {
      return;
    }
    if (twoFactorEnabled) {
      setTwoFactorStatus("2FA is already enabled", true);
      return;
    }

    const currentPassword = trimToNull(twoFactorSetupPasswordInput ? twoFactorSetupPasswordInput.value : "");
    if (!currentPassword) {
      setTwoFactorStatus("Current password is required", true);
      return;
    }

    if (twoFactorStartSetupBtn) {
      twoFactorStartSetupBtn.disabled = true;
    }
    if (twoFactorSetupPasswordInput) {
      twoFactorSetupPasswordInput.disabled = true;
    }
    setTwoFactorStatus("Generating setup...");

    try {
      const data = await fetchJson(api("/auth/2fa/setup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword })
      });

      showTwoFactorSetupResult(data || {});
      setTwoFactorStatus("Setup generated. Enter the current authenticator code to enable.");
      validateTwoFactorForms();
    } catch (e) {
      const msg = e && e.message ? e.message : "2FA setup failed";
      if (isAuthErrorMessage(msg)) {
        logoutToLogin("expired");
        return;
      }
      setTwoFactorStatus(msg, true);
    } finally {
      if (twoFactorSetupPasswordInput) {
        twoFactorSetupPasswordInput.disabled = false;
      }
      validateTwoFactorForms();
    }
  }

  async function enableTwoFactor() {
    if (!ensureAuthenticated()) {
      return;
    }
    if (twoFactorEnabled) {
      setTwoFactorStatus("2FA is already enabled", true);
      return;
    }
    if (!twoFactorSetupData || !twoFactorSetupData.manualEntryKey) {
      setTwoFactorStatus("Start setup first", true);
      return;
    }

    const code = digitsOnly(twoFactorEnableCodeInput ? twoFactorEnableCodeInput.value : "", 6);
    if (code.length !== 6) {
      setTwoFactorStatus("Enter a valid 6-digit verification code", true);
      return;
    }

    if (twoFactorEnableCodeInput) {
      twoFactorEnableCodeInput.value = code;
      twoFactorEnableCodeInput.disabled = true;
    }
    if (twoFactorEnableBtn) {
      twoFactorEnableBtn.disabled = true;
    }
    setTwoFactorStatus("Enabling 2FA...");

    try {
      await fetchJson(api("/auth/2fa/enable"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });

      if (twoFactorSetupPasswordInput) {
        twoFactorSetupPasswordInput.value = "";
      }
      clearTwoFactorSetupResult();
      await loadTwoFactorStatus({ silent: true });
      setTwoFactorStatus("2FA enabled successfully.");
    } catch (e) {
      const msg = e && e.message ? e.message : "2FA enable failed";
      if (isAuthErrorMessage(msg)) {
        logoutToLogin("expired");
        return;
      }
      setTwoFactorStatus(msg, true);
    } finally {
      if (twoFactorEnableCodeInput) {
        twoFactorEnableCodeInput.disabled = false;
      }
      validateTwoFactorForms();
    }
  }

  async function disableTwoFactor() {
    if (!ensureAuthenticated()) {
      return;
    }
    if (!twoFactorEnabled) {
      setTwoFactorStatus("2FA is already disabled", true);
      return;
    }

    const currentPassword = trimToNull(twoFactorDisablePasswordInput ? twoFactorDisablePasswordInput.value : "");
    const code = digitsOnly(twoFactorDisableCodeInput ? twoFactorDisableCodeInput.value : "", 6);

    if (!currentPassword) {
      setTwoFactorStatus("Current password is required", true);
      return;
    }
    if (code.length !== 6) {
      setTwoFactorStatus("Enter a valid 6-digit verification code", true);
      return;
    }

    if (twoFactorDisablePasswordInput) {
      twoFactorDisablePasswordInput.disabled = true;
    }
    if (twoFactorDisableCodeInput) {
      twoFactorDisableCodeInput.value = code;
      twoFactorDisableCodeInput.disabled = true;
    }
    if (twoFactorDisableBtn) {
      twoFactorDisableBtn.disabled = true;
    }
    setTwoFactorStatus("Disabling 2FA...");

    try {
      await fetchJson(api("/auth/2fa/disable"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, code })
      });

      if (twoFactorDisablePasswordInput) {
        twoFactorDisablePasswordInput.value = "";
      }
      if (twoFactorDisableCodeInput) {
        twoFactorDisableCodeInput.value = "";
      }

      await loadTwoFactorStatus({ silent: true });
      setTwoFactorStatus("2FA disabled successfully.");
    } catch (e) {
      const msg = e && e.message ? e.message : "2FA disable failed";
      if (isAuthErrorMessage(msg)) {
        logoutToLogin("expired");
        return;
      }
      setTwoFactorStatus(msg, true);
    } finally {
      if (twoFactorDisablePasswordInput) {
        twoFactorDisablePasswordInput.disabled = false;
      }
      if (twoFactorDisableCodeInput) {
        twoFactorDisableCodeInput.disabled = false;
      }
      validateTwoFactorForms();
    }
  }

  async function save() {
    if (!ensureAuthenticated()) {
      return;
    }

    const nextName = String(labNameInput.value || "").trim();
    if (!nextName) {
      setStatus("Lab name is required", true);
      return;
    }

    saveBtn.disabled = true;
    cancelBtn.disabled = true;
    setStatus("Saving...");

    try {
      const data = await fetchJson(api("/lab/name"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labName: nextName })
      });
      const savedName = data && data.labName ? String(data.labName).trim() : nextName;
      currentName = savedName;
      labNameInput.value = savedName;
      setLabName(savedName);
      applyEverywhere();
      setEditing(false);
      setStatus("Saved.");
    } catch (e) {
      const msg = e && e.message ? e.message : "Save failed";
      if (isAuthErrorMessage(msg)) {
        logoutToLogin("expired");
        return;
      }
      setStatus(msg, true);
    } finally {
      saveBtn.disabled = false;
      cancelBtn.disabled = false;
    }
  }

  editBtn.addEventListener("click", () => {
    setEditing(true);
    setStatus("");
  });

  cancelBtn.addEventListener("click", () => {
    labNameInput.value = currentName;
    setEditing(false);
    setStatus("");
  });

  saveBtn.addEventListener("click", () => {
    save();
  });

  labNameInput.addEventListener("keydown", (e) => {
    if (!labNameInput.disabled && e.key === "Enter") {
      e.preventDefault();
      save();
    }
    if (!labNameInput.disabled && e.key === "Escape") {
      e.preventDefault();
      labNameInput.value = currentName;
      setEditing(false);
      setStatus("");
    }
  });

  if (currentPasswordInput && newPasswordInput && confirmPasswordInput && changePasswordBtn) {
    installPasswordToggle(toggleCurrentPasswordBtn, currentPasswordInput);
    installPasswordToggle(toggleNewPasswordBtn, newPasswordInput);
    installPasswordToggle(toggleConfirmPasswordBtn, confirmPasswordInput);

    [currentPasswordInput, newPasswordInput, confirmPasswordInput].forEach((el) => {
      el.addEventListener("input", () => {
        setPasswordStatus("");
        validatePasswordForm();
      });
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !changePasswordBtn.disabled) {
          e.preventDefault();
          changePassword();
        }
      });
    });

    changePasswordBtn.addEventListener("click", () => {
      changePassword();
    });

    validatePasswordForm();
  }

  installPasswordToggle(toggleTwoFactorSetupPasswordBtn, twoFactorSetupPasswordInput);
  installPasswordToggle(toggleTwoFactorDisablePasswordBtn, twoFactorDisablePasswordInput);

  if (twoFactorSetupPasswordInput) {
    twoFactorSetupPasswordInput.addEventListener("input", () => {
      setTwoFactorStatus("");
      validateTwoFactorForms();
    });
    twoFactorSetupPasswordInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && twoFactorStartSetupBtn && !twoFactorStartSetupBtn.disabled) {
        e.preventDefault();
        startTwoFactorSetup();
      }
    });
  }

  if (twoFactorStartSetupBtn) {
    twoFactorStartSetupBtn.addEventListener("click", () => {
      startTwoFactorSetup();
    });
  }

  if (copyTwoFactorManualKeyBtn) {
    copyTwoFactorManualKeyBtn.addEventListener("click", async () => {
      const key = twoFactorManualKeyInput ? twoFactorManualKeyInput.value : "";
      const ok = await copyText(key);
      setTwoFactorStatus(ok ? "Setup key copied." : "Copy failed", !ok);
    });
  }

  if (twoFactorEnableCodeInput) {
    twoFactorEnableCodeInput.addEventListener("input", () => {
      setTwoFactorStatus("");
      twoFactorEnableCodeInput.value = digitsOnly(twoFactorEnableCodeInput.value, 6);
      validateTwoFactorForms();
    });
    twoFactorEnableCodeInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && twoFactorEnableBtn && !twoFactorEnableBtn.disabled) {
        e.preventDefault();
        enableTwoFactor();
      }
    });
  }

  if (twoFactorEnableBtn) {
    twoFactorEnableBtn.addEventListener("click", () => {
      enableTwoFactor();
    });
  }

  if (twoFactorDisablePasswordInput) {
    twoFactorDisablePasswordInput.addEventListener("input", () => {
      setTwoFactorStatus("");
      validateTwoFactorForms();
    });
    twoFactorDisablePasswordInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && twoFactorDisableBtn && !twoFactorDisableBtn.disabled) {
        e.preventDefault();
        disableTwoFactor();
      }
    });
  }

  if (twoFactorDisableCodeInput) {
    twoFactorDisableCodeInput.addEventListener("input", () => {
      setTwoFactorStatus("");
      twoFactorDisableCodeInput.value = digitsOnly(twoFactorDisableCodeInput.value, 6);
      validateTwoFactorForms();
    });
    twoFactorDisableCodeInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && twoFactorDisableBtn && !twoFactorDisableBtn.disabled) {
        e.preventDefault();
        disableTwoFactor();
      }
    });
  }

  if (twoFactorDisableBtn) {
    twoFactorDisableBtn.addEventListener("click", () => {
      disableTwoFactor();
    });
  }

  setEditing(false);
  validateTwoFactorForms();
  loadProfile();
  loadTwoFactorStatus({ silent: true });
})();
