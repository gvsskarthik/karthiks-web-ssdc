let tests=[], groups=[], mode="all";
let normalIdCounter = 0;
let editTest=null, editGroup=null;

/* LOAD */
Promise.all([
  apiList("tests?size=1000"),
  apiList("tests/groups?size=1000")
]).then(([t, g]) => {
  tests = Array.isArray(t) ? t : [];
  groups = Array.isArray(g) ? g : [];
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
    <td class="cost">${formatCost(t.price)}</td>
      <td class="active-col">
         <label class="switch">
           <input type="checkbox"
           id="active-test-${t.id}"
           name="active-test-${t.id}"
           ${t.isActive ? "checked" : ""}
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
    <td class="cost">${formatCost(g.price)}</td>
    <td class="active-col">—</td>

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
 apiFetchJson(`tests/${t.id}`)
  .then(detail => {
    editTest = detail;
    tName.value = detail.testName || "";
    tShortcut.value = detail.shortcut || "";
    tCategory.value = detail.category || "";
    tCost.value = detail.price != null ? detail.price : "";
    nBox.innerHTML = "";
    normalIdCounter = 0;
    testModal.style.display = "flex";
  })
  .catch(() => {
    alert("Failed to load test details");
  });
}
function addNormal(){
  const normalId = `normal-${editTest ? editTest.id : "new"}-${normalIdCounter++}`;
  nBox.innerHTML+=`<textarea id="${normalId}" name="${normalId}"></textarea>`;
}
function saveTest(){
 const payload = {
   testName: tName.value,
   shortcut: tShortcut.value,
   category: tCategory.value,
   price: +tCost.value,
   isActive: typeof editTest.isActive === "boolean" ? editTest.isActive : true,
   hasParameters: !!editTest.hasParameters,
   hasDefaultResults: !!editTest.hasDefaultResults,
   allowMultipleResults: !!editTest.allowMultipleResults
 };

 fetch(apiUrl(`tests/${editTest.id}`),{
  method:"PUT",
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify(payload)
 }).then(()=>location.reload());
}
function closeTest(){testModal.style.display="none"}

/* ===== GROUP EDIT (MODAL, NO REDIRECT) ===== */
function openGroup(g){
 editGroup=g;
 gName.value=g.groupName;
 gShortcut.value=g.shortcut;
 gCost.value=g.price;

 apiFetchJson(`tests/groups/${g.id}`)
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
 fetch(apiUrl(`tests/groups/${editGroup.id}`),{
  method:"PUT",
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({
   groupName:gName.value,
   shortcut:gShortcut.value,
   price:+gCost.value,
   testIds:ids,
   category: editGroup.category || ""
  })
 }).then(()=>location.reload());
}
function closeGroup(){groupModal.style.display="none"}

/* DELETE */
function deleteTest(id){
  if(!confirm("Delete test?")) return;

  fetch(apiUrl(`tests/${id}`),{
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
  fetch(apiUrl(`tests/groups/${id}`),{method:"DELETE"})
   .then(()=>location.reload());
}
/* TOGGLE ACTIVE */
function toggleActive(id, state){
  apiFetchJson(`tests/${id}`)
    .then(detail => {
      const payload = {
        testName: detail.testName,
        shortcut: detail.shortcut,
        category: detail.category,
        price: detail.price,
        isActive: state,
        hasParameters: !!detail.hasParameters,
        hasDefaultResults: !!detail.hasDefaultResults,
        allowMultipleResults: !!detail.allowMultipleResults
      };
      return fetch(apiUrl(`tests/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    })
    .then(res => {
      if (!res || !res.ok) {
        alert("Failed to update test status");
        location.reload();
      }
    })
    .catch(() => {
      alert("Server error");
      location.reload();
    });
}
