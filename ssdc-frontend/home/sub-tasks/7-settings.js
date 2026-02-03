(function () {
  const labNameInput = document.getElementById("labNameInput");
  const editBtn = document.getElementById("editLabNameBtn");
  const saveBtn = document.getElementById("saveLabNameBtn");
  const cancelBtn = document.getElementById("cancelLabNameBtn");
  const statusEl = document.getElementById("labNameStatus");

  if (!labNameInput || !editBtn || !saveBtn || !cancelBtn) {
    return;
  }

  function setStatus(message, isError) {
    if (!statusEl) {
      return;
    }
    statusEl.textContent = message || "";
    statusEl.style.color = isError ? "#ff7a7a" : "";
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

  async function loadProfile() {
    if (!getToken()) {
      window.location.href = "../../index.html";
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
      window.location.href = "../../index.html";
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

  setEditing(false);
  loadProfile();
})();

