let tests=[], groups=[], mode="all";
let normalIdCounter = 0;
let editTest=null, editGroup=null;

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
  .map(param => {
    const normalText = normalizeText(param.normalText);
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

 return (test.normalValues || [])
  .map(n => normalizeText(n.normalValue))
  .filter(Boolean)
  .join("\n");
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
    <td class="name">${t.testName || "-"}</td>
    <td class="category">${t.category || "—"}</td>
    <td class="shortcut">${t.shortcut || "—"}</td>
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
    <td class="name">${g.groupName || "-"}</td>
    <td class="category">Group</td>
    <td class="shortcut">${g.shortcut || "—"}</td>
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

/* ===== SINGLE TEST ===== */
function openTest(t){
 editTest=t;
 tName.value=t.testName;
 tShortcut.value=t.shortcut;
 tCategory.value=t.category;
 tCost.value=t.cost;
 nBox.innerHTML="";
 normalIdCounter = 0;
 (t.normalValues||[]).forEach(n=>{
  const normalId = `normal-${t.id}-${normalIdCounter++}`;
  nBox.innerHTML+=`<div class="inline"><textarea id="${normalId}" name="${normalId}">${n.normalValue}</textarea></div>`;
 });
 testModal.style.display="flex";
}
function addNormal(){
  const normalId = `normal-${editTest ? editTest.id : "new"}-${normalIdCounter++}`;
  nBox.innerHTML+=`<textarea id="${normalId}" name="${normalId}"></textarea>`;
}
function saveTest(){
 fetch(API_BASE_URL + "/tests/" + editTest.id,{
  method:"PUT",
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({
    testName:tName.value,
    shortcut:tShortcut.value,
    category:tCategory.value,
    cost:+tCost.value,
    normalValues:[...nBox.querySelectorAll("textarea")].map(t=>({normalValue:t.value}))
  })
 }).then(()=>location.reload());
}
function closeTest(){testModal.style.display="none"}

/* ===== GROUP EDIT (MODAL, NO REDIRECT) ===== */
function openGroup(g){
 editGroup=g;
 gName.value=g.groupName;
 gShortcut.value=g.shortcut;
 gCost.value=g.cost;

 fetch(API_BASE_URL + "/groups/" + g.id)
 .then(r=>r.json())
 .then(d=>{
  editGroup = { ...editGroup, ...d };
  groupTests.innerHTML="";
  tests.forEach(t=>{
  groupTests.innerHTML+=`
    <div class="inline neo pad-8">
      <input type="checkbox" id="group-test-${g.id}-${t.id}" name="group-test-${g.id}-${t.id}" value="${t.id}"
        ${(d.testIds||[]).includes(t.id)?"checked":""}>
      ${t.testName} (${t.shortcut})
    </div>`;
  });
  groupModal.style.display="flex";
 });
}
function saveGroup(){
 const ids=[...groupTests.querySelectorAll("input:checked")].map(i=>+i.value);
 fetch(API_BASE_URL + "/groups/" + editGroup.id,{
  method:"PUT",
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({
   groupName:gName.value,
   shortcut:gShortcut.value,
   cost:+gCost.value,
   testIds:ids,
   category: editGroup.category || undefined,
   active: typeof editGroup.active === "boolean" ? editGroup.active : undefined
  })
 }).then(()=>location.reload());
}
function closeGroup(){groupModal.style.display="none"}

/* DELETE */
function deleteTest(id){
  if(!confirm("Delete test?")) return;

  fetch(API_BASE_URL + "/tests/" + id,{
    method:"DELETE"
  })
  .then(res=>{
    if(!res.ok){
      return res.text().then(msg=>alert(msg));
    }
    location.reload();
  })
  .catch(()=>{
    alert("Server error");
  });
}
function deleteGroup(id){
 if(confirm("Delete group?"))
  fetch(API_BASE_URL + "/groups/" + id,{method:"DELETE"})
   .then(()=>location.reload());
}
/* TOGGLE ACTIVE */
function toggleActive(id, state){
  fetch(`${API_BASE_URL}/tests/${id}/active`,{
    method:"PUT",
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ active: state })
  })
  .then(res=>{
    if(!res.ok){
      alert("Failed to update test status");
      location.reload(); // revert UI
    }
  })
  .catch(()=>{
    alert("Server error");
    location.reload();
  });
}

function toggleGroupActive(id, state){
  fetch(`${API_BASE_URL}/groups/${id}/active`,{
    method:"PUT",
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ active: state })
  })
  .then(res=>{
    if(!res.ok){
      alert("Failed to update group status");
      location.reload(); // revert UI
    }
  })
  .catch(()=>{
    alert("Server error");
    location.reload();
  });
}
