let tests=[], groups=[], mode="all";
const tbody = document.getElementById("tbody");

function clearNode(node) { window.ssdcDom.clear(node); }

// Inline handler replacements (CSP-safe)
{
 const btnNewGroup = document.getElementById("btnNewGroup");
 if (btnNewGroup) {
  btnNewGroup.addEventListener("click", () => {
   location.href = "test/new-group.html";
  });
 }
 const btnNewTest = document.getElementById("btnNewTest");
 if (btnNewTest) {
  btnNewTest.addEventListener("click", () => {
   location.href = "test/new-tests.html";
  });
 }
 document.querySelectorAll(".tabs button[data-mode]").forEach((btn) => {
  btn.addEventListener("click", () => setMode(String(btn.dataset.mode || "all"), btn));
 });
}

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

const normalizeText = window.SSDC.utils.normalizeText;

function normalizeNormalForDisplay(value){
  const text = normalizeText(value);
  if (!text) {
    return "";
  }
  return text.replace(/\r\n/g, "\n");
}

const escapeHtml = window.SSDC.utils.escapeHtml;

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
    .map(normalizeNormalForDisplay);
  if (testNormals.length) {
    // IMPORTANT: keep index alignment with parameters.
    // Do not filter empty strings before index lookup, otherwise values "shift"
    // to the wrong parameter when some parameters have no normal values.
    if (typeof index === "number") {
      return testNormals[index] || "";
    }
    const filtered = testNormals.filter(Boolean);
    if (filtered.length) {
      return normalizeNormalForDisplay(filtered.join("\n"));
    }
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
  return paramLines.join("\n");
 }

 const fallback = asArray(test.normalValues || test.normal_values)
  .map(readNormalEntry)
  .map(normalizeNormalForDisplay)
  .filter(Boolean)
  .join("\n");

 return fallback;
}

function appendTextWithLineBreaks(parent, text){
 if (!parent) return;
 const value = text == null ? "" : String(text);
 if (!value) return;
 const parts = value.split(/\r?\n/);
 parts.forEach((part, idx) => {
  if (idx > 0) parent.appendChild(document.createElement("br"));
  parent.appendChild(document.createTextNode(part));
 });
}

function makeSwitch(checked, onChange){
 const label = document.createElement("label");
 label.className = "switch";
 const input = document.createElement("input");
 input.type = "checkbox";
 input.checked = Boolean(checked);
 input.addEventListener("change", () => onChange(Boolean(input.checked)));
 const slider = document.createElement("span");
 slider.className = "slider";
 label.appendChild(input);
 label.appendChild(slider);
 return label;
}

function makeMenu(items){
 const wrap = document.createElement("div");
 wrap.className = "menu";
 const btn = document.createElement("button");
 btn.className = "menu-btn";
 btn.type = "button";
 btn.textContent = "⋮";
 btn.addEventListener("click", () => toggleMenu(btn));
 const list = document.createElement("div");
 list.className = "menu-list";
 items.forEach(item => {
  if (!item) return;
  const div = document.createElement("div");
  if (item.className) div.className = item.className;
  div.textContent = item.label;
  div.addEventListener("click", item.onClick);
  list.appendChild(div);
 });
 wrap.appendChild(btn);
 wrap.appendChild(list);
 return wrap;
}

/* RENDER */
function render(){
 clearNode(tbody);
 let i=1;
 const frag = document.createDocumentFragment();

 if(mode!=="group"){
  tests.forEach(t=>{
   const tr = document.createElement("tr");

   const tdSno = document.createElement("td");
   tdSno.className = "sno";
   tdSno.textContent = String(i++);

   const tdName = document.createElement("td");
   tdName.className = "name";
   tdName.textContent = t?.testName ? String(t.testName) : "-";

   const tdCat = document.createElement("td");
   tdCat.className = "category";
   tdCat.textContent = t?.category ? String(t.category) : "—";

   const tdShortcut = document.createElement("td");
   tdShortcut.className = "shortcut";
   tdShortcut.textContent = t?.shortcut ? String(t.shortcut) : "—";

   const tdNormal = document.createElement("td");
   tdNormal.className = "normal";
   const normalText = renderNormalValues(t);
   if (normalText) {
    // renderNormalValues returns escaped string with \n; show as lines.
    appendTextWithLineBreaks(tdNormal, String(normalText).replace(/&nbsp;/g, " "));
   } else {
    tdNormal.textContent = "—";
   }

   const tdCost = document.createElement("td");
   tdCost.className = "cost";
   tdCost.textContent = formatCost(t.cost);

   const tdActive = document.createElement("td");
   tdActive.className = "active-col";
   tdActive.appendChild(
    makeSwitch(Boolean(t.active), (state) => toggleActive(t.id, state))
   );

   const tdOptions = document.createElement("td");
   tdOptions.className = "options";
   const items = [
    { label: "Edit", onClick: () => openTest(t) }
   ];
   if (!t.used) {
    items.push({ label: "Delete", onClick: () => deleteTest(t.id) });
   }
   tdOptions.appendChild(makeMenu(items));

   tr.appendChild(tdSno);
   tr.appendChild(tdName);
   tr.appendChild(tdCat);
   tr.appendChild(tdShortcut);
   tr.appendChild(tdNormal);
   tr.appendChild(tdCost);
   tr.appendChild(tdActive);
   tr.appendChild(tdOptions);
   frag.appendChild(tr);
  });
 }

 if(mode!=="single"){
  groups.forEach(g=>{
   const tr = document.createElement("tr");

   const tdSno = document.createElement("td");
   tdSno.className = "sno";
   tdSno.textContent = String(i++);

   const tdName = document.createElement("td");
   tdName.className = "name";
   tdName.textContent = g?.groupName ? String(g.groupName) : "-";

   const tdCat = document.createElement("td");
   tdCat.className = "category";
   tdCat.textContent = "Group";

   const tdShortcut = document.createElement("td");
   tdShortcut.className = "shortcut";
   tdShortcut.textContent = g?.shortcut ? String(g.shortcut) : "—";

   const tdNormal = document.createElement("td");
   tdNormal.className = "normal";
   tdNormal.textContent = "—";

   const tdCost = document.createElement("td");
   tdCost.className = "cost";
   tdCost.textContent = formatCost(g.cost);

   const tdActive = document.createElement("td");
   tdActive.className = "active-col";
   tdActive.appendChild(
    makeSwitch(g.active !== false, (state) => toggleGroupActive(g.id, state))
   );

   const tdOptions = document.createElement("td");
   tdOptions.className = "options";
   tdOptions.appendChild(makeMenu([
    { label: "Edit", onClick: () => openGroup(g) },
    { label: "Delete", onClick: () => deleteGroup(g.id) }
   ]));

   tr.appendChild(tdSno);
   tr.appendChild(tdName);
   tr.appendChild(tdCat);
   tr.appendChild(tdShortcut);
   tr.appendChild(tdNormal);
   tr.appendChild(tdCost);
   tr.appendChild(tdActive);
   tr.appendChild(tdOptions);
   frag.appendChild(tr);
  });
 }
 tbody.appendChild(frag);
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
