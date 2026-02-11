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
  while (rows && rows.firstChild) {
    rows.removeChild(rows.firstChild);
  }

  if (!Array.isArray(data) || data.length === 0) {
    setStatus("No template tests available (or onboarding already completed).");
    return;
  }

  data.forEach((t) => {
    const tr = document.createElement("tr");
    const tdCheck = document.createElement("td");
    tdCheck.style.padding = "10px";
    const check = document.createElement("input");
    check.className = "test-check";
    check.type = "checkbox";
    check.value = String(t?.id ?? "");
    tdCheck.appendChild(check);

    const tdName = document.createElement("td");
    tdName.style.padding = "10px";
    tdName.textContent = t?.testName || "-";

    const tdShortcut = document.createElement("td");
    tdShortcut.style.padding = "10px";
    tdShortcut.textContent = t?.shortcut || "-";

    const tdCategory = document.createElement("td");
    tdCategory.style.padding = "10px";
    tdCategory.textContent = t?.category || "-";

    const tdCost = document.createElement("td");
    tdCost.style.padding = "10px";
    tdCost.textContent = `₹${t?.cost ?? 0}`;

    tr.appendChild(tdCheck);
    tr.appendChild(tdName);
    tr.appendChild(tdShortcut);
    tr.appendChild(tdCategory);
    tr.appendChild(tdCost);
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
    await window.ssdcAlert("Select at least one test.");
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
    importAll().catch((e) => window.ssdcAlert(e.message || "Import failed"));
  });
  document.getElementById("btnSelected").addEventListener("click", () => {
    importSelected().catch((e) => window.ssdcAlert(e.message || "Import failed"));
  });
  document.getElementById("btnSkip").addEventListener("click", () => {
    skip().catch((e) => window.ssdcAlert(e.message || "Skip failed"));
  });
  loadTemplateTests().catch((e) => setStatus(e.message || "Failed to load tests"));
}
