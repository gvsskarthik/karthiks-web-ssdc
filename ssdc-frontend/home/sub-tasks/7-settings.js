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

  async function fetchJson(url, init) {
    const res = await fetch(url, init);
    const text = await res.text();
    if (!res.ok) {
      throw new Error(text || `Request failed: ${res.status}`);
    }
    return text ? JSON.parse(text) : null;
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

  function validatePasswordForm() {
    if (!changePasswordBtn) {
      return;
    }
    const current = String(currentPasswordInput && currentPasswordInput.value ? currentPasswordInput.value : "");
    const next = String(newPasswordInput && newPasswordInput.value ? newPasswordInput.value : "");
    const confirm = String(confirmPasswordInput && confirmPasswordInput.value ? confirmPasswordInput.value : "");

    const ok = Boolean(
      current.trim().length > 0 &&
        next.trim().length >= 6 &&
        confirm.trim().length > 0 &&
        next === confirm
    );
    changePasswordBtn.disabled = !ok;
  }

  async function changePassword() {
    if (!getToken()) {
      if (typeof window.forceLogout === "function") {
        window.forceLogout();
      } else {
        try {
          (window.top || window).location.href = "/index.html";
        } catch (e) {
          window.location.href = "/index.html";
        }
      }
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
        if (typeof window.forceLogout === "function") {
          window.forceLogout("passwordChanged");
        } else {
          window.location.href = "../../index.html?loggedOut=1&reason=passwordChanged";
        }
      }, 150);
    } catch (e) {
      const msg = e && e.message ? e.message : "Change password failed";
      if (/Request failed: (401|403)\b/.test(msg) || /\b(401|403)\b/.test(msg) || /unauthorized|forbidden/i.test(msg)) {
        if (typeof window.forceLogout === "function") {
          window.forceLogout("expired");
          return;
        }
      }
      setPasswordStatus(msg, true);
      currentPasswordInput.disabled = false;
      newPasswordInput.disabled = false;
      confirmPasswordInput.disabled = false;
      validatePasswordForm();
    }
  }

  async function loadProfile() {
    if (!getToken()) {
      if (typeof window.forceLogout === "function") {
        window.forceLogout();
      } else {
        try {
          (window.top || window).location.href = "/index.html";
        } catch (e) {
          window.location.href = "/index.html";
        }
      }
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
      setStatus(e && e.message ? e.message : "Failed to load profile", true);
    }
  }

  async function save() {
    if (!getToken()) {
      if (typeof window.forceLogout === "function") {
        window.forceLogout();
      } else {
        try {
          (window.top || window).location.href = "/index.html";
        } catch (e) {
          window.location.href = "/index.html";
        }
      }
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
      setStatus(e && e.message ? e.message : "Save failed", true);
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

  setEditing(false);
  loadProfile();
})();
