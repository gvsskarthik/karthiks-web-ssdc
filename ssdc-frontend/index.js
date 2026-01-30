function showSignup() {
  document.getElementById("loginForm").hidden = true;
  document.getElementById("signupForm").hidden = false;
}

function showLogin() {
  document.getElementById("signupForm").hidden = true;
  document.getElementById("loginForm").hidden = false;
}

const AUTH_TOKEN_KEY = "SSDC_AUTH_TOKEN";

function normalizeLabId(value) {
  return String(value || "").trim().toLowerCase();
}

function getToken() {
  try {
    return window.localStorage ? window.localStorage.getItem(AUTH_TOKEN_KEY) : null;
  } catch (e) {
    return null;
  }
}

function setToken(token) {
  try {
    if (window.localStorage) {
      window.localStorage.setItem(AUTH_TOKEN_KEY, String(token || ""));
    }
  } catch (e) {
    // ignore
  }
}

function clearToken() {
  try {
    if (window.localStorage) {
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch (e) {
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

// Show email verification result (from verify link redirect).
try {
  const url = new URL(window.location.href);
  const verified = url.searchParams.get("verified");
  if (verified === "1") {
    alert("Email verified! Now login with Lab ID + password.");
    url.searchParams.delete("verified");
    window.history.replaceState({}, "", url.toString());
  } else if (verified === "0") {
    alert("Email verification failed or expired. Please resend verification link.");
    url.searchParams.delete("verified");
    window.history.replaceState({}, "", url.toString());
  }
} catch (e) {
  // ignore
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const labId = normalizeLabId(document.getElementById("loginLabId").value);
  const password = document.getElementById("loginPass").value;

  try {
    const data = await postJson(authUrl("/auth/login"), { labId, password });
    if (!data || !data.token) {
      throw new Error("Login failed");
    }
    setToken(data.token);
    window.location.href = "dashboard.html";
  } catch (err) {
    clearToken();
    alert(err && err.message ? err.message : "Login failed");
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
    alert((data && data.message) ? data.message : "Verification link sent to email. Please verify then login.");
    document.getElementById("loginLabId").value = labId;
    showLogin();
  } catch (err) {
    alert(err && err.message ? err.message : "Signup failed");
  }
});

// Optional: resend verification for the labId typed in login box.
window.resendVerification = async function () {
  const labId = normalizeLabId(document.getElementById("loginLabId").value);
  if (!labId) {
    alert("Enter Lab ID first");
    return;
  }
  try {
    await postJson(authUrl("/auth/resend-verification"), { labId, password: "x" });
    alert("Verification link sent. Check your email.");
  } catch (err) {
    alert(err && err.message ? err.message : "Resend failed");
  }
};
