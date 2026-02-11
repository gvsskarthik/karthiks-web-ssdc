const patient =
  JSON.parse(localStorage.getItem("currentPatient") || "{}");

function setText(id, value){
  const el = document.getElementById(id);
  if (el) {
    el.innerText = value;
  }
}

function clearNode(node) {
  if (!node) return;
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function appendMessageRow(tbody, message) {
  clearNode(tbody);
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 2;
  td.textContent = message;
  tr.appendChild(td);
  tbody.appendChild(tr);
}

function appendLineItemRow(tbody, name, amountText) {
  const tr = document.createElement("tr");

  const tdName = document.createElement("td");
  tdName.textContent = name == null ? "-" : String(name);

  const tdAmount = document.createElement("td");
  tdAmount.className = "amount";
  tdAmount.textContent = amountText == null ? "" : String(amountText);

  tr.appendChild(tdName);
  tr.appendChild(tdAmount);
  tbody.appendChild(tr);
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
  const cost = Number(group.cost);
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
  const age = patient.age ? String(patient.age) : "";
  const gender = patient.gender || "";
  const ageSex =
    age && gender ? `${age} / ${gender}` : `${age}${gender}`;

  setText("pName", patient.name || "");
  setText(
    "pDate",
    patient.visitDate || (window.formatIstDateDisplay
      ? window.formatIstDateDisplay(new Date())
      : new Date().toLocaleDateString())
  );
  setText("pAddress", patient.address || "");
  setText("pAgeSex", ageSex);
  setText("pDoctor", patient.doctor || "SELF");
  setText("pMobile", patient.mobile || "");
}

function loadSelectedTests(){
  if (!patient || !patient.id) {
    return Promise.resolve([]);
  }

  return fetch(`${API_BASE_URL}/patient-tests/${patient.id}`)
    .then(res => res.json())
    .then(list => (list || [])
      .map(x => Number(x.testId))
      .filter(id => !Number.isNaN(id)))
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

  if (!patient || !patient.id) {
    appendMessageRow(body, "No patient selected");
    setTotals(0, 0, 0);
    return;
  }

  loadSelectedTests()
    .then(ids => {
      const uniqueIds = [...new Set(ids)];
      if (!uniqueIds.length) {
        appendMessageRow(body, "No tests found");
        const amount = Number(patient.amount) || 0;
        setTotals(0, 0, amount);
        return;
      }

      return Promise.all([
        fetch(`${API_BASE_URL}/tests/active`).then(res => res.json()),
        fetch(`${API_BASE_URL}/groups`).then(res => res.json()).catch(() => [])
      ])
        .then(([tests, groups]) => {
          const testList = Array.isArray(tests) ? tests : [];
          const testMap = new Map(testList.map(t => [Number(t.id), t]));
          const selected =
            testList.filter(t => uniqueIds.includes(t.id));

          if (!selected.length) {
            appendMessageRow(body, "No tests found");
            const amount = Number(patient.amount) || 0;
            setTotals(0, 0, amount);
            return;
          }

          const normalizedGroups = (Array.isArray(groups) ? groups : [])
            .map(group => {
              const ids = Array.isArray(group.testIds) ? group.testIds : [];
              const testIds = ids
                .map(id => Number(id))
                .filter(id => Number.isFinite(id) && testMap.has(id));
              return { ...group, testIds };
            })
            .filter(group => group.testIds.length)
            .sort((a, b) => {
              const diff = b.testIds.length - a.testIds.length;
              if (diff !== 0) return diff;
              return (Number(a.id) || 0) - (Number(b.id) || 0);
            });

          const selectedSet = new Set(uniqueIds);
          const selectedGroups = [];
          const coveredTests = new Set();

          normalizedGroups.forEach(group => {
            const allSelected = group.testIds.every(id => selectedSet.has(id));
            if (!allSelected) {
              return;
            }
            const overlaps = group.testIds.some(id => coveredTests.has(id));
            if (overlaps) {
              return;
            }
            selectedGroups.push(group);
            group.testIds.forEach(id => coveredTests.add(id));
          });

          let subtotal = 0;
          clearNode(body);
          const frag = document.createDocumentFragment();

          selectedGroups.forEach(group => {
            const cost = resolveGroupCost(group, testMap);
            subtotal += cost;
            const groupName = `${group.groupName || "Group"} (Group)`;
            appendLineItemRow(frag, groupName, `₹${formatMoney(cost)}`);
          });

          selected
            .filter(test => !coveredTests.has(Number(test.id)))
            .forEach(test => {
              const cost = Number(test.cost) || 0;
              subtotal += cost;
              appendLineItemRow(
                frag,
                test.testName || "-",
                `₹${formatMoney(cost)}`
              );
            });

          body.appendChild(frag);

          const patientAmount = Number(patient.amount);
          const total = Number.isFinite(patientAmount)
            ? patientAmount
            : subtotal;
          const discount = Math.max(0, subtotal - total);

          setTotals(subtotal, discount, total);
        })
        .catch(() => {
          appendMessageRow(body, "Failed to load tests");
          const amount = Number(patient.amount) || 0;
          setTotals(0, 0, amount);
        });
    })
    .catch(() => {
      appendMessageRow(body, "Failed to load tests");
      const amount = Number(patient.amount) || 0;
      setTotals(0, 0, amount);
    });
}

function goPatients(){
  if (parent?.loadPage) {
    parent.loadPage("home/sub-tasks/2-patient.html", "patient");
  } else {
    location.href = "../2-patient.html";
  }
}

{
  const backBtn = document.getElementById("btnBillBack");
  if (backBtn) {
    backBtn.addEventListener("click", goPatients);
  }
  const printBtn = document.getElementById("btnBillPrint");
  if (printBtn) {
    printBtn.addEventListener("click", () => window.print());
  }
}

hydratePatient();
renderBill();
