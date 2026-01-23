const visit =
  JSON.parse(localStorage.getItem("currentVisit") || "{}");

function setText(id, value){
  const el = document.getElementById(id);
  if (el) {
    el.innerText = value;
  }
}

function formatMoney(value){
  const num = Number(value);
  if (!Number.isFinite(num)) return "0";
  return String(Math.round(num * 100) / 100);
}

function formatMoneyWithSymbol(value){
  return `₹${formatMoney(value)}`;
}

function resolveGroupCost(group, testMap){
  const cost = Number(group.price);
  if (Number.isFinite(cost)) {
    return cost;
  }
  let sum = 0;
  (group.testIds || []).forEach(id => {
    const test = testMap.get(id);
    sum += Number(test?.cost) || 0;
  });
  return Math.round(sum * 100) / 100;
}

function hydratePatient(){
  const age = visit.age ? String(visit.age) : "";
  const gender = visit.sex || "";
  const ageSex =
    age && gender ? `${age} / ${gender}` : `${age}${gender}`;

  setText("pName", visit.name || "");
  setText("pDate", visit.visitDate || new Date().toLocaleDateString());
  setText("pAddress", visit.address || "");
  setText("pAgeSex", ageSex);
  setText("pDoctor", visit.doctorName || "SELF");
  setText("pMobile", visit.mobile || "");
}

function loadSelectedTests(){
  if (!visit || !visit.visitId) {
    return Promise.resolve([]);
  }

  return apiList(`visits/${visit.visitId}/patient-tests`)
    .then(list => (list || [])
      .filter(x => x && x.testId != null))
    .catch(() => {
      const stored =
        JSON.parse(localStorage.getItem("selectedTests") || "[]");
      return (stored || [])
        .map(id => Number(id))
        .filter(id => !Number.isNaN(id));
    });
}

function setTotals(subtotalValue, discountValue, totalValue){
  setText("subtotal", formatMoneyWithSymbol(subtotalValue));
  setText("discount", formatMoneyWithSymbol(discountValue));
  setText("total", formatMoneyWithSymbol(totalValue));
}

function renderBill(){
  const body = document.getElementById("billBody");

  if (!visit || !visit.visitId) {
    body.innerHTML = `<tr><td colspan="2">No patient selected</td></tr>`;
    setTotals(0, 0, 0);
    return;
  }

  loadSelectedTests()
    .then(items => {
      const list = Array.isArray(items) ? items : [];
      if (!list.length) {
        body.innerHTML = `<tr><td colspan="2">No tests found</td></tr>`;
        const subtotal = 0;
        const discount = Number(visit.discountAmount) || 0;
        const total = subtotal - discount;
        setTotals(subtotal, discount, total);
        return;
      }

      return apiList("tests?size=1000")
        .then(tests => {
          const testList = Array.isArray(tests) ? tests : [];
          const testMap = new Map(testList.map(t => [Number(t.id), t]));
          let subtotal = 0;
          body.innerHTML = "";

          list.forEach(item => {
            const test = testMap.get(Number(item.testId)) || {};
            const cost = Number(item.priceAtTime) || Number(test.price) || 0;
            subtotal += cost;
            body.innerHTML += `
              <tr>
                <td>${test.testName || "Test"}</td>
                <td class="amount">₹${formatMoney(cost)}</td>
              </tr>
            `;
          });

          const discount = Number(visit.discountAmount) || 0;
          const total = subtotal - discount;
          setTotals(subtotal, discount, total);
        })
        .catch(() => {
          body.innerHTML = `<tr><td colspan="2">Failed to load tests</td></tr>`;
          setTotals(0, 0, 0);
        });
    })
    .catch(() => {
      body.innerHTML = `<tr><td colspan="2">Failed to load tests</td></tr>`;
      setTotals(0, 0, 0);
    });
}

function goPatients(){
  if (parent?.loadPage) {
    parent.loadPage("home/sub-tasks/2-patient.html", "patient");
  } else {
    location.href = "../2-patient.html";
  }
}

hydratePatient();
renderBill();
