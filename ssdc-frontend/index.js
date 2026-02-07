function showSignup() {
  document.getElementById("loginForm").hidden = true;
  document.getElementById("signupForm").hidden = false;
}

function showLogin() {
  document.getElementById("signupForm").hidden = true;
  document.getElementById("loginForm").hidden = false;
}

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

// If already logged in, go to dashboard.
if (getToken()) {
  window.location.href = "dashboard.html";
}

// If the user starts typing on the login page, prevent cross-tab session sync
// from overriding a manual login to a different user.
try {
  const labIdInput = document.getElementById("loginLabId");
  const passInput = document.getElementById("loginPass");
  [labIdInput, passInput].filter(Boolean).forEach((el) => {
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

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  lockSessionSync();
  const labId = normalizeLabId(document.getElementById("loginLabId").value);
  const password = document.getElementById("loginPass").value;

  try {
    // Clear any previously synced session in this tab before logging in.
    clearToken();
    const data = await postJson(authUrl("/auth/login"), { labId, password });
    if (!data || !data.token) {
      throw new Error("Login failed");
    }
    setToken(data.token);
    if (data.labName && typeof window.setLabName === "function") {
      window.setLabName(data.labName);
    }
    window.location.href = "dashboard.html";
  } catch (err) {
    clearToken();
    await softAlert(err && err.message ? err.message : "Login failed");
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
