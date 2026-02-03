function getToken() {
  return typeof window.getAuthToken === "function" ? window.getAuthToken() : null;
}

function setStatus(msg) {
  const el = document.getElementById("status");
  if (el) {
    el.textContent = msg || "";
  }
}

function api(path) {
  const base = window.API_BASE_URL || "/api";
  return base.replace(/\/$/, "") + path;
}

function getSelectedIds() {
  return Array.from(document.querySelectorAll("input.test-check:checked"))
    .map((el) => Number(el.value))
    .filter((n) => Number.isFinite(n));
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return text ? JSON.parse(text) : null;
}

async function loadTemplateTests() {
  setStatus("Loading template tests...");
  const data = await fetchJson(api("/onboarding/template-tests"));
  const rows = document.getElementById("testRows");
  rows.innerHTML = "";

  if (!Array.isArray(data) || data.length === 0) {
    setStatus("No template tests available (or onboarding already completed).");
    return;
  }

  data.forEach((t) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="padding:10px;">
        <input class="test-check" type="checkbox" value="${t.id}">
      </td>
      <td style="padding:10px;">${t.testName || "-"}</td>
      <td style="padding:10px;">${t.shortcut || "-"}</td>
      <td style="padding:10px;">${t.category || "-"}</td>
      <td style="padding:10px;">₹${t.cost ?? 0}</td>
    `;
    rows.appendChild(tr);
  });

  setStatus(`Loaded ${data.length} template tests.`);
}

async function importAll() {
  setStatus("Importing all tests...");
  const resp = await fetchJson(api("/onboarding/import"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "ALL" })
  });
  setStatus(`Imported. Tests: +${resp.testsImported} (linked ${resp.testsLinked}), Groups: +${resp.groupsImported} (linked ${resp.groupsLinked}), Mappings: +${resp.mappingsImported}. Redirecting...`);
  setTimeout(() => (window.location.href = "dashboard.html"), 800);
}

async function importSelected() {
  const ids = getSelectedIds();
  if (!ids.length) {
    alert("Select at least one test.");
    return;
  }
  setStatus("Importing selected tests...");
  const resp = await fetchJson(api("/onboarding/import"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "SELECTED", testIds: ids })
  });
  setStatus(`Imported. Tests: +${resp.testsImported} (linked ${resp.testsLinked}), Groups: +${resp.groupsImported} (linked ${resp.groupsLinked}), Mappings: +${resp.mappingsImported}. Redirecting...`);
  setTimeout(() => (window.location.href = "dashboard.html"), 800);
}

async function skip() {
  setStatus("Skipping...");
  await fetchJson(api("/onboarding/skip"), { method: "POST" });
  window.location.href = "dashboard.html";
}

if (!getToken()) {
  window.location.href = "index.html";
} else {
  document.getElementById("btnAll").addEventListener("click", () => {
    importAll().catch((e) => alert(e.message || "Import failed"));
  });
  document.getElementById("btnSelected").addEventListener("click", () => {
    importSelected().catch((e) => alert(e.message || "Import failed"));
  });
  document.getElementById("btnSkip").addEventListener("click", () => {
    skip().catch((e) => alert(e.message || "Skip failed"));
  });
  loadTemplateTests().catch((e) => setStatus(e.message || "Failed to load tests"));
}
