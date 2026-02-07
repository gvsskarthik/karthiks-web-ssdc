let tests=[], groups=[], mode="all";

/* LOAD */
Promise.all([
fetch(API_BASE_URL + "/tests").then(r=>r.json()),
 fetch(API_BASE_URL + "/groups").then(r=>r.json())
]).then(([t,g])=>{
 tests=t;
 groups=g;
 render();
});

/* TABS */
function setMode(m,b){
 mode=m;
 document.querySelectorAll(".tabs button").forEach(x=>x.classList.remove("active"));
 b.classList.add("active");
 render();
}

/* MENU */
function closeMenus(){
 document.querySelectorAll(".menu-list").forEach(m=>m.style.display="none");
 document.querySelectorAll("#tbody tr.menu-open").forEach(row => row.classList.remove("menu-open"));
 document.body.classList.remove("menu-open");
}

function toggleMenu(btn){
 const menu = btn.nextElementSibling;
 const isOpen = menu && menu.style.display === "block";
 closeMenus();
 if (menu) {
  menu.style.display = isOpen ? "none" : "block";
  if (!isOpen) {
   const row = btn.closest("tr");
   if (row) {
     row.classList.add("menu-open");
   }
   document.body.classList.add("menu-open");
  }
 }
}

document.addEventListener("click", (event) => {
 if (!event.target.closest(".menu")) {
  closeMenus();
 }
});

function normalizeText(value){
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function normalizeNormalForDisplay(value){
  const text = normalizeText(value);
  if (!text) {
    return "";
  }
  // Backend joins multiple normal values with " / ". Show them on new lines.
  return text.replace(/\s+\/\s+/g, "\n");
}

function escapeHtml(value){
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function asArray(value){
  return Array.isArray(value) ? value : [];
}

function readNormalEntry(entry){
  if (entry === null || entry === undefined) {
    return "";
  }
  if (typeof entry === "string" || typeof entry === "number") {
    return normalizeText(entry);
  }
  return normalizeText(
    entry.normalValue ||
    entry.normal_value ||
    entry.textValue ||
    entry.text_value ||
    entry.normalText ||
    entry.normal_text ||
    entry.value
  );
}

function formatNormalRanges(ranges){
  const parts = asArray(ranges)
    .map(range => {
      if (!range) {
        return "";
      }

      const textValue =
        normalizeText(range.textValue || range.text_value);
      if (textValue) {
        return textValue;
      }

      const min = range.minValue ?? range.min_value;
      const max = range.maxValue ?? range.max_value;
      if (min === null || min === undefined) {
        if (max === null || max === undefined) {
          return "";
        }
        return String(max);
      }
      if (max === null || max === undefined) {
        return String(min);
      }

      const gender =
        normalizeText(range.gender).toUpperCase();
      const base = `${min}-${max}`;
      if (gender && gender !== "ANY") {
        const prefix =
          gender === "MALE" ? "M"
          : (gender === "FEMALE" ? "F" : gender);
        return `${prefix}: ${base}`;
      }
      return base;
    })
    .filter(Boolean);

  return parts.join("\n");
}

function resolveNormalText(test, param, index){
  const direct = normalizeNormalForDisplay(
    param?.normalText || param?.normal_text || param?.normal
  );
  if (direct) {
    return direct;
  }

  const fromRanges =
    formatNormalRanges(param?.normalRanges || param?.normal_ranges);
  if (fromRanges) {
    return normalizeNormalForDisplay(fromRanges);
  }

  const testNormals = asArray(test?.normalValues || test?.normal_values)
    .map(readNormalEntry)
    .map(normalizeNormalForDisplay)
    .filter(Boolean);
  if (testNormals.length) {
    if (typeof index === "number" && testNormals[index]) {
      return testNormals[index];
    }
    return normalizeNormalForDisplay(testNormals.join("\n"));
  }

  return normalizeNormalForDisplay(test?.normalValue || test?.normal_value);
}

function formatCost(value){
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `₹${numeric}` : "—";
}

function renderNormalValues(test){
 const params = Array.isArray(test.parameters) ? test.parameters : [];
 const hasMultiple = params.length > 1;
 const paramLines = params
  .map((param, index) => {
    const normalText = resolveNormalText(
      test,
      param,
      hasMultiple ? index : undefined
    );
    if (!normalText) {
      return "";
    }
    const name = hasMultiple ? normalizeText(param.name) : "";
    return name ? `${name}: ${normalText}` : normalText;
  })
  .filter(Boolean);

 if (paramLines.length) {
  return escapeHtml(paramLines.join("\n"));
 }

 const fallback = asArray(test.normalValues || test.normal_values)
  .map(readNormalEntry)
  .filter(Boolean)
  .join("\n");

 return escapeHtml(fallback);
}

/* RENDER */
function render(){
 tbody.innerHTML="";
 let i=1;

 if(mode!=="group"){
  tests.forEach(t=>{
   tbody.innerHTML+=`
   <tr>
    <td class="sno">${i++}</td>
    <td class="name">${escapeHtml(t.testName || "-")}</td>
    <td class="category">${escapeHtml(t.category || "—")}</td>
    <td class="shortcut">${escapeHtml(t.shortcut || "—")}</td>
    <td class="normal">${renderNormalValues(t) || "—"}</td>
    <td class="cost">${formatCost(t.cost)}</td>
      <td class="active-col">
         <label class="switch">
           <input type="checkbox"
           id="active-test-${t.id}"
           name="active-test-${t.id}"
           ${t.active ? "checked" : ""}
           onchange="toggleActive(${t.id}, this.checked)">
            <span class="slider"></span>
         </label>
      </td>
      <td class="options">
     <div class="menu">
      <button class="menu-btn" type="button" onclick="toggleMenu(this)">⋮</button>
      <div class="menu-list">
       <div onclick='openTest(${JSON.stringify(t)})'>Edit</div>
      ${t.used ? "" : `<div onclick='deleteTest(${t.id})'>Delete</div>`}      </div>
     </div>
    </td>
   </tr>`;
  });
 }

 if(mode!=="single"){
  groups.forEach(g=>{
   tbody.innerHTML+=`
   <tr>
    <td class="sno">${i++}</td>
    <td class="name">${escapeHtml(g.groupName || "-")}</td>
    <td class="category">Group</td>
    <td class="shortcut">${escapeHtml(g.shortcut || "—")}</td>
    <td class="normal">—</td>
    <td class="cost">${formatCost(g.cost)}</td>

    <td class="active-col">
      <label class="switch">
        <input type="checkbox"
          id="active-group-${g.id}"
          name="active-group-${g.id}"
          ${(g.active === false) ? "" : "checked"}
          onchange="toggleGroupActive(${g.id}, this.checked)">
        <span class="slider"></span>
      </label>
    </td>

    <td class="options">
     <div class="menu">
      <button class="menu-btn" type="button" onclick="toggleMenu(this)">⋮</button>
      <div class="menu-list">
       <div onclick='openGroup(${JSON.stringify(g)})'>Edit</div>
       <div onclick='deleteGroup(${g.id})'>Delete</div>
      </div>
     </div>
    </td>
   </tr>`;
  });
 }
 }

/* EDIT (REDIRECT) */
function openTest(test){
  const id = Number(test?.id);
  if (!Number.isFinite(id)) {
    return;
  }
  closeMenus();
  location.href = `test/new-tests.html?edit=${encodeURIComponent(id)}`;
}

function openGroup(group){
  const id = Number(group?.id);
  if (!Number.isFinite(id)) {
    return;
  }
  closeMenus();
  location.href = `test/new-group.html?edit=${encodeURIComponent(id)}`;
}

/* DELETE */
async function deleteTest(id){
  const ok = await window.ssdcConfirm("Delete test?", {
    title: "Confirm Delete",
    okText: "Delete",
    okVariant: "danger"
  });
  if (!ok) return;

  try {
    const res = await fetch(API_BASE_URL + "/tests/" + id, {
      method: "DELETE"
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      await window.ssdcAlert(msg || "Delete failed");
      return;
    }
    location.reload();
  } catch (e) {
    await window.ssdcAlert("Server error");
  }
}
async function deleteGroup(id){
  const ok = await window.ssdcConfirm("Delete group?", {
    title: "Confirm Delete",
    okText: "Delete",
    okVariant: "danger"
  });
  if (!ok) return;

  try {
    await fetch(API_BASE_URL + "/groups/" + id, { method: "DELETE" });
    location.reload();
  } catch (e) {
    await window.ssdcAlert("Server error");
  }
}
/* TOGGLE ACTIVE */
async function toggleActive(id, state){
  try {
    const res = await fetch(`${API_BASE_URL}/tests/${id}/active`, {
      method:"PUT",
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ active: state })
    });
    if(!res.ok){
      await window.ssdcAlert("Failed to update test status");
      location.reload(); // revert UI
    }
  } catch (e) {
    await window.ssdcAlert("Server error");
    location.reload();
  }
}

async function toggleGroupActive(id, state){
  try {
    const res = await fetch(`${API_BASE_URL}/groups/${id}/active`,{
      method:"PUT",
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ active: state })
    });
    if(!res.ok){
      await window.ssdcAlert("Failed to update group status");
      location.reload(); // revert UI
    }
  } catch (e) {
    await window.ssdcAlert("Server error");
    location.reload();
  }
}
