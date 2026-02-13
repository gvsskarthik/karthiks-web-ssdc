function getAuthEls() {
  return {
    main: document.getElementById("authMain"),
    aContainer: document.getElementById("a-container"),
    bContainer: document.getElementById("b-container"),
    switchCtn: document.getElementById("switch-cnt"),
    switchC1: document.getElementById("switch-c1"),
    switchC2: document.getElementById("switch-c2"),
    circles: document.querySelectorAll(".switch__circle")
  };
}

function setContainerActive(container, active) {
  if (!container) return;

  try {
    container.inert = !active;
  } catch (e) {
    // ignore
  }

  try {
    container.setAttribute("aria-hidden", active ? "false" : "true");
  } catch (e) {
    // ignore
  }

  try {
    container.querySelectorAll("input, select, textarea, button").forEach((el) => {
      if (active) {
        if (el.dataset && el.dataset.authUiDisabled === "1") {
          el.disabled = false;
          delete el.dataset.authUiDisabled;
        }
        return;
      }

      if (el.disabled) return;
      if (el.dataset) el.dataset.authUiDisabled = "1";
      el.disabled = true;
    });
  } catch (e) {
    // ignore
  }
}

function toggleAuthMode() {
  const { main, aContainer, bContainer, switchCtn, switchC1, switchC2, circles } = getAuthEls();
  if (!main || !aContainer || !bContainer || !switchCtn || !switchC1 || !switchC2) {
    return;
  }

  switchCtn.classList.add("is-gx");
  window.setTimeout(() => {
    switchCtn.classList.remove("is-gx");
  }, 1500);

  switchCtn.classList.toggle("is-txr");
  circles.forEach((circle) => circle.classList.toggle("is-txr"));

  switchC1.classList.toggle("is-hidden");
  switchC2.classList.toggle("is-hidden");
  aContainer.classList.toggle("is-txl");
  bContainer.classList.toggle("is-txl");
  bContainer.classList.toggle("is-z200");

  const isSignup = bContainer.classList.contains("is-z200");
  main.dataset.mode = isSignup ? "signup" : "login";
  setContainerActive(aContainer, !isSignup);
  setContainerActive(bContainer, isSignup);
}

function applyAuthMode(mode, { animate = false } = {}) {
  const { main, aContainer, bContainer, switchCtn, switchC1, switchC2, circles } = getAuthEls();
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");

  // Fallback: old/simple toggle if the new UI isn't present.
  if (!main || !aContainer || !bContainer || !switchCtn || !switchC1 || !switchC2) {
    if (loginForm && signupForm) {
      loginForm.hidden = mode === "signup";
      signupForm.hidden = mode === "login";
    }
    return;
  }

  const isMobile = Boolean(window.matchMedia?.("(max-width: 760px)")?.matches);
  const shouldAnimate = Boolean(animate && !isMobile);
  const isSignup = mode === "signup";

  main.dataset.mode = isSignup ? "signup" : "login";

  if (shouldAnimate) {
    const currentlySignup = bContainer.classList.contains("is-z200");
    if (currentlySignup !== isSignup) {
      toggleAuthMode();
    }
    return;
  }

  // Set exact class state without animation.
  switchCtn.classList.toggle("is-txr", isSignup);
  circles.forEach((circle) => circle.classList.toggle("is-txr", isSignup));

  switchC1.classList.toggle("is-hidden", isSignup);
  switchC2.classList.toggle("is-hidden", !isSignup);

  aContainer.classList.toggle("is-txl", isSignup);
  bContainer.classList.toggle("is-txl", isSignup);
  bContainer.classList.toggle("is-z200", isSignup);

  setContainerActive(aContainer, !isSignup);
  setContainerActive(bContainer, isSignup);
}

function showSignup() {
  resetLoginFlowToPassword({ skipFocus: true });
  applyAuthMode("signup", { animate: true });
}

function showLogin() {
  applyAuthMode("login", { animate: true });
}

(function initAuthUi() {
  applyAuthMode("login", { animate: false });

  try {
    document.querySelectorAll(".switch-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-target");
        if (target === "signup") {
          showSignup();
          return;
        }
        if (target === "login") {
          showLogin();
          return;
        }
        toggleAuthMode();
      });
    });
  } catch (e) {
    // ignore
  }
})();

function normalizeLabId(value) {
  return String(value || "").trim().toLowerCase();
}

function getToken() {
  return typeof window.getAuthToken === "function" ? window.getAuthToken() : null;
}

function setToken(token) {
  if (typeof window.setAuthToken === "function") {
    window.setAuthToken(token);
  }
}

function clearToken() {
  if (typeof window.clearAuthToken === "function") {
    window.clearAuthToken();
  }
}

async function softAlert(message) {
  if (typeof window.ssdcAlert === "function") {
    await window.ssdcAlert(message);
    return;
  }
  console.warn("Popup:", message);
}

async function softPrompt(message, options) {
  if (typeof window.ssdcPrompt === "function") {
    return await window.ssdcPrompt(message, options);
  }
  console.warn("Prompt requested but ssdcPrompt is unavailable:", message);
  return null;
}

function lockSessionSync() {
  try {
    if (typeof window.__ssdcLockSessionSync === "function") {
      window.__ssdcLockSessionSync();
    }
  } catch (err) {
    // ignore
  }
}

function authUrl(path) {
  const base = window.API_BASE_URL || "/api";
  return base.replace(/\/$/, "") + path;
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return text ? JSON.parse(text) : {};
}

const LOGIN_PHASE_PASSWORD = "password";
const LOGIN_PHASE_TWO_FACTOR = "twoFactor";

const loginFlowState = {
  phase: LOGIN_PHASE_PASSWORD,
  challengeLabId: null,
  challengeToken: null,
  challengeExpiresAt: null,
  challengeLabName: null
};

function getLoginFlowEls() {
  return {
    form: document.getElementById("loginForm"),
    subhead: document.getElementById("loginFlowSubhead"),
    passwordStep: document.getElementById("loginPasswordStep"),
    twoFactorStep: document.getElementById("loginTwoFactorStep"),
    twoFactorNote: document.getElementById("twoFactorNote"),
    labIdInput: document.getElementById("loginLabId"),
    passInput: document.getElementById("loginPass"),
    codeInput: document.getElementById("loginTwoFactorCode"),
    passwordSubmit: document.getElementById("btnLoginPassword"),
    verifySubmit: document.getElementById("btnVerifyTwoFactor"),
    backButton: document.getElementById("btnBackToPassword")
  };
}

function trimToNull(value) {
  const next = String(value == null ? "" : value).trim();
  return next ? next : null;
}

function normalizeDigits(value, maxLength) {
  return String(value == null ? "" : value).replace(/\D+/g, "").slice(0, maxLength || 6);
}

function parseChallengeExpiry(value) {
  const raw = trimToNull(value);
  if (!raw) {
    return null;
  }
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date : null;
}

function describeChallengeExpiry(expiryDate) {
  if (!expiryDate) {
    return "Enter the 6-digit code from your authenticator app.";
  }
  try {
    return `Enter the 6-digit code from your authenticator app. Expires at ${expiryDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`;
  } catch (e) {
    return "Enter the 6-digit code from your authenticator app.";
  }
}

function clearLoginChallengeState() {
  loginFlowState.challengeLabId = null;
  loginFlowState.challengeToken = null;
  loginFlowState.challengeExpiresAt = null;
  loginFlowState.challengeLabName = null;
}

function canVerifyTwoFactorCode() {
  const { codeInput } = getLoginFlowEls();
  const code = normalizeDigits(codeInput ? codeInput.value : "", 6);
  return Boolean(
    loginFlowState.challengeLabId
      && loginFlowState.challengeToken
      && code.length === 6
  );
}

function updateTwoFactorVerifyButtonState() {
  const { verifySubmit, codeInput } = getLoginFlowEls();
  if (!verifySubmit) {
    return;
  }
  const isEnabled = canVerifyTwoFactorCode();
  verifySubmit.disabled = !isEnabled || Boolean(codeInput && codeInput.disabled);
}

function updateTwoFactorNote() {
  const { twoFactorNote } = getLoginFlowEls();
  if (!twoFactorNote) {
    return;
  }
  twoFactorNote.textContent = describeChallengeExpiry(loginFlowState.challengeExpiresAt);
}

function setLoginPhase(phase, options) {
  const {
    subhead,
    passwordStep,
    twoFactorStep,
    codeInput,
    passwordSubmit,
    verifySubmit,
    labIdInput,
    passInput
  } = getLoginFlowEls();
  const skipFocus = Boolean(options && options.skipFocus);

  loginFlowState.phase = phase === LOGIN_PHASE_TWO_FACTOR
    ? LOGIN_PHASE_TWO_FACTOR
    : LOGIN_PHASE_PASSWORD;

  const isTwoFactor = loginFlowState.phase === LOGIN_PHASE_TWO_FACTOR;
  if (subhead) {
    subhead.textContent = isTwoFactor
      ? "Verify your sign-in using authenticator code"
      : "Use Lab ID and password";
  }

  if (passwordStep) {
    passwordStep.hidden = isTwoFactor;
    passwordStep.classList.toggle("is-hidden", isTwoFactor);
  }
  if (twoFactorStep) {
    twoFactorStep.hidden = !isTwoFactor;
    twoFactorStep.classList.toggle("is-hidden", !isTwoFactor);
  }

  if (passwordSubmit) {
    passwordSubmit.disabled = isTwoFactor;
  }
  if (codeInput) {
    codeInput.value = normalizeDigits(codeInput.value, 6);
    codeInput.disabled = !isTwoFactor;
  }
  if (verifySubmit) {
    verifySubmit.disabled = true;
  }

  updateTwoFactorNote();
  updateTwoFactorVerifyButtonState();

  if (!skipFocus) {
    try {
      if (isTwoFactor && codeInput) {
        codeInput.focus();
        codeInput.select();
      } else if (!isTwoFactor && passInput) {
        passInput.focus();
        passInput.select();
      } else if (!isTwoFactor && labIdInput) {
        labIdInput.focus();
      }
    } catch (e) {
      // ignore
    }
  }
}

function resetLoginFlowToPassword(options) {
  clearLoginChallengeState();
  const { codeInput } = getLoginFlowEls();
  if (codeInput) {
    codeInput.value = "";
  }
  setLoginPhase(LOGIN_PHASE_PASSWORD, { skipFocus: Boolean(options && options.skipFocus) });
}

async function submitPasswordLogin() {
  const { labIdInput, passInput, passwordSubmit } = getLoginFlowEls();
  const labId = normalizeLabId(labIdInput ? labIdInput.value : "");
  const password = passInput ? passInput.value : "";

  if (!labId || !password) {
    throw new Error("labId and password are required");
  }

  if (passwordSubmit) {
    passwordSubmit.disabled = true;
  }

  try {
    // Clear any previously synced session in this tab before logging in.
    clearToken();
    const data = await postJson(authUrl("/auth/login"), { labId, password });
    if (data && data.twoFactorRequired === true) {
      const challengeLabId = normalizeLabId(data.labId || labId);
      const loginChallenge = trimToNull(data.loginChallenge);
      if (!challengeLabId || !loginChallenge) {
        throw new Error("Login challenge not received");
      }
      loginFlowState.challengeLabId = challengeLabId;
      loginFlowState.challengeToken = loginChallenge;
      loginFlowState.challengeExpiresAt = parseChallengeExpiry(data.challengeExpiresAt);
      loginFlowState.challengeLabName = trimToNull(data.labName);
      setLoginPhase(LOGIN_PHASE_TWO_FACTOR);
      return;
    }

    if (!data || !data.token) {
      throw new Error("Login failed");
    }
    clearLoginChallengeState();
    setToken(data.token);
    if (data.labName && typeof window.setLabName === "function") {
      window.setLabName(data.labName);
    }
    window.location.href = "dashboard.html";
  } finally {
    if (passwordSubmit && loginFlowState.phase !== LOGIN_PHASE_TWO_FACTOR) {
      passwordSubmit.disabled = false;
    }
  }
}

async function submitTwoFactorLogin() {
  const { codeInput, verifySubmit } = getLoginFlowEls();
  const code = normalizeDigits(codeInput ? codeInput.value : "", 6);

  if (!loginFlowState.challengeLabId || !loginFlowState.challengeToken) {
    throw new Error("Login challenge missing. Please sign in again.");
  }
  if (code.length !== 6) {
    throw new Error("Enter a valid 6-digit verification code");
  }

  if (codeInput) {
    codeInput.value = code;
    codeInput.disabled = true;
  }
  if (verifySubmit) {
    verifySubmit.disabled = true;
  }

  try {
    const data = await postJson(authUrl("/auth/verify-2fa-login"), {
      labId: loginFlowState.challengeLabId,
      loginChallenge: loginFlowState.challengeToken,
      code
    });
    if (!data || !data.token) {
      throw new Error("Login failed");
    }
    const fallbackLabName = loginFlowState.challengeLabName;
    clearLoginChallengeState();
    setToken(data.token);
    const finalLabName = trimToNull(data.labName) || fallbackLabName;
    if (finalLabName && typeof window.setLabName === "function") {
      window.setLabName(finalLabName);
    }
    window.location.href = "dashboard.html";
  } finally {
    if (codeInput && loginFlowState.phase === LOGIN_PHASE_TWO_FACTOR) {
      codeInput.disabled = false;
      codeInput.focus();
      codeInput.select();
    }
    updateTwoFactorVerifyButtonState();
  }
}

function bindTwoFactorLoginUi() {
  const { codeInput, backButton } = getLoginFlowEls();
  if (codeInput) {
    codeInput.addEventListener("input", () => {
      lockSessionSync();
      codeInput.value = normalizeDigits(codeInput.value, 6);
      updateTwoFactorVerifyButtonState();
    });
    codeInput.addEventListener("focus", lockSessionSync);
  }
  if (backButton) {
    backButton.addEventListener("click", () => {
      resetLoginFlowToPassword();
    });
  }
}

// If already logged in, go to dashboard.
if (getToken()) {
  window.location.href = "dashboard.html";
}

// If the user starts typing on the login page, prevent cross-tab session sync
// from overriding a manual login to a different user.
try {
  const labIdInput = document.getElementById("loginLabId");
  const passInput = document.getElementById("loginPass");
  const codeInput = document.getElementById("loginTwoFactorCode");
  [labIdInput, passInput, codeInput].filter(Boolean).forEach((el) => {
    el.addEventListener("input", lockSessionSync);
    el.addEventListener("focus", lockSessionSync);
  });
} catch (err) {
  // ignore
}

// Show email verification result (from verify link redirect).
(async () => {
  try {
    const url = new URL(window.location.href);
    const loggedOut = url.searchParams.get("loggedOut");
    const reason = url.searchParams.get("reason");
    if (loggedOut === "1" && reason) {
      if (reason === "idle") {
        await softAlert("Logged out due to inactivity");
      } else if (reason === "passwordChanged") {
        await softAlert("Password changed. Please login again.");
      } else if (reason === "expired") {
        await softAlert("Session expired. Please login again.");
      } else {
        await softAlert("You have been logged out.");
      }
      url.searchParams.delete("loggedOut");
      url.searchParams.delete("reason");
      window.history.replaceState({}, "", url.toString());
    }

    const verified = url.searchParams.get("verified");
    if (verified === "1") {
      await softAlert("Email verified! Now login with Lab ID + password.");
      url.searchParams.delete("verified");
      window.history.replaceState({}, "", url.toString());
    } else if (verified === "0") {
      await softAlert("Email verification failed or expired. Please resend verification link.");
      url.searchParams.delete("verified");
      window.history.replaceState({}, "", url.toString());
    }
  } catch (e) {
    // ignore
  }
})();

bindTwoFactorLoginUi();
setLoginPhase(LOGIN_PHASE_PASSWORD);

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  lockSessionSync();
  try {
    if (loginFlowState.phase === LOGIN_PHASE_TWO_FACTOR) {
      await submitTwoFactorLogin();
      return;
    }
    await submitPasswordLogin();
  } catch (err) {
    const message = err && err.message ? err.message : "Login failed";
    const shouldResetChallenge = /\bInvalid or expired login challenge\b/i.test(message);
    if (shouldResetChallenge) {
      resetLoginFlowToPassword();
    }
    clearToken();
    await softAlert(message);
  }
});

document.getElementById("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const labName = String(document.getElementById("signupLabName").value || "").trim();
  const labId = normalizeLabId(document.getElementById("signupLabId").value);
  const email = String(document.getElementById("signupEmail").value || "").trim();
  const phone = String(document.getElementById("signupPhone").value || "").trim();
  const password = document.getElementById("signupPass").value;

  try {
    const data = await postJson(authUrl("/auth/signup"), {
      labName,
      labId,
      email: email || null,
      phone: phone || null,
      password
    });
    await softAlert((data && data.message) ? data.message : "Verification link sent to email. Please verify then login.");
    document.getElementById("loginLabId").value = labId;
    showLogin();
  } catch (err) {
    await softAlert(err && err.message ? err.message : "Signup failed");
  }
});

// Optional: resend verification for the labId typed in login box.
window.resendVerification = async function () {
  const labId = normalizeLabId(document.getElementById("loginLabId").value);
  if (!labId) {
    await softAlert("Enter Lab ID first");
    return;
  }
  try {
    await postJson(authUrl("/auth/resend-verification"), { labId, password: "x" });
    await softAlert("Verification link sent. Check your email.");
  } catch (err) {
    await softAlert(err && err.message ? err.message : "Resend failed");
  }
};

window.forgotPassword = async function () {
  const labId = normalizeLabId(document.getElementById("loginLabId").value);
  if (!labId) {
    await softAlert("Enter Lab ID first");
    return;
  }
  try {
    await postJson(authUrl("/auth/forgot-password"), { labId, password: "x" });
    await softAlert("Reset link sent to your email.");
  } catch (err) {
    await softAlert(err && err.message ? err.message : "Request failed");
  }
};

// Inline handler replacements (CSP-safe)
try {
  const btnForgot = document.getElementById("btnForgotPassword");
  if (btnForgot) btnForgot.addEventListener("click", () => window.forgotPassword());
  const btnResend = document.getElementById("btnResendVerification");
  if (btnResend) btnResend.addEventListener("click", () => window.resendVerification());
  const btnSignup = document.getElementById("btnShowSignup");
  if (btnSignup) btnSignup.addEventListener("click", () => showSignup());
  const btnLogin = document.getElementById("btnShowLogin");
  if (btnLogin) btnLogin.addEventListener("click", () => showLogin());
} catch (e) {
  // ignore
}

// Password reset (from email link)
(async () => {
  try {
    const url = new URL(window.location.href);
    const reset = url.searchParams.get("reset");
    const labId = url.searchParams.get("labId");
    const token = url.searchParams.get("token");
    if (reset === "1" && labId && token) {
      const newPassword = await softPrompt(
        "Enter new password (min 6 chars):",
        {
          title: "Reset Password",
          inputType: "password",
          inputPlaceholder: "New password (min 6 chars)"
        }
      );
      if (newPassword != null && String(newPassword).trim().length >= 6) {
        try {
          await postJson(authUrl("/auth/reset-password"), {
            labId,
            token,
            newPassword
          });
          await softAlert("Password updated. Now login.");
          url.searchParams.delete("reset");
          url.searchParams.delete("labId");
          url.searchParams.delete("token");
          window.history.replaceState({}, "", url.toString());
        } catch (e) {
          await softAlert(e && e.message ? e.message : "Reset failed");
        }
      } else if (newPassword !== null) {
        await softAlert("Password too short.");
      }
    }
  } catch (e) {
    // ignore
  }
})();
