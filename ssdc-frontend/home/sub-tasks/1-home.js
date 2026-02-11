function setText(id, value){
  const el = document.getElementById(id);
  if (!el) {
    return;
  }
  el.textContent = value == null ? "—" : String(value);
}

function safeJson(res) {
  return res && typeof res.json === "function"
    ? res.json().catch(() => null)
    : Promise.resolve(null);
}

function normalizeYmd(value) {
  const s = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }
  return "";
}

function formatInr(amount) {
  const n = Number(amount) || 0;
  const hasPaise = Math.abs(n - Math.round(n)) > 1e-6;
  try {
    const fmt = new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: hasPaise ? 2 : 0,
      maximumFractionDigits: hasPaise ? 2 : 0
    });
    return "₹" + fmt.format(n);
  } catch (e) {
    return "₹" + (hasPaise ? n.toFixed(2) : String(Math.round(n)));
  }
}

function formatYmdToDdMmYy(ymd) {
  const s = normalizeYmd(ymd);
  if (!s) return "-";
  const parts = s.split("-");
  const yy = parts[0].slice(2);
  const mm = parts[1];
  const dd = parts[2];
  return `${dd}-${mm}-${yy}`;
}

function clearNode(node) {
  if (!node) return;
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function renderRecentTasksTable(tasks) {
  const tbody = document.getElementById("recentTasksBody");
  if (!tbody) {
    return;
  }

  clearNode(tbody);
  if (!tasks.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.className = "no-data";
    td.textContent = "No pending / due tasks";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  const frag = document.createDocumentFragment();
  tasks.forEach((t, idx) => {
    const dueClass = t.dueAmount > 0 ? "due is-due" : "due is-no-due";

    const tr = document.createElement("tr");

    const tdSno = document.createElement("td");
    tdSno.className = "sno";
    tdSno.textContent = String(idx + 1);

    const tdName = document.createElement("td");
    tdName.className = "name";
    tdName.textContent = t?.name ? String(t.name) : "-";

    const tdDate = document.createElement("td");
    tdDate.className = "date";
    tdDate.textContent = formatYmdToDdMmYy(t.dateYmd);

    const tdDue = document.createElement("td");
    tdDue.className = `amount ${dueClass}`;
    tdDue.textContent = formatInr(t.dueAmount);

    const tdStatus = document.createElement("td");
    tdStatus.className = "status-col";
    const status = document.createElement("span");
    if (t.pending) {
      status.className = "status pending";
      status.textContent = "Pending";
    } else {
      status.className = "status completed";
      status.textContent = "Completed";
    }
    tdStatus.appendChild(status);

    tr.appendChild(tdSno);
    tr.appendChild(tdName);
    tr.appendChild(tdDate);
    tr.appendChild(tdDue);
    tr.appendChild(tdStatus);
    frag.appendChild(tr);
  });

  tbody.appendChild(frag);
}

function loadHomeSummary(){
  fetch(`${API_BASE_URL}/dashboard/home-summary?limit=20`)
    .then((res) => safeJson(res))
    .then((data) => {
      const obj = (data && typeof data === "object") ? data : {};

      setText("home-today-count", Number(obj.todayCount) || 0);
      setText("home-week-count", Number(obj.weekCount) || 0);
      setText("home-month-count", Number(obj.monthCount) || 0);
      setText("home-year-count", Number(obj.yearCount) || 0);

      const tasks = [];
      const rows = Array.isArray(obj.recentTasks) ? obj.recentTasks : [];
      for (const r of rows) {
        const dateYmd = normalizeYmd(r && r.date);
        if (!dateYmd) continue;
        tasks.push({
          id: Number(r && r.id) || 0,
          name: r && r.patientName ? String(r.patientName) : "",
          dateYmd,
          dueAmount: Number(r && r.dueAmount) || 0,
          pending: Boolean(r && r.pending)
        });
      }
      renderRecentTasksTable(tasks);
    })
    .catch(() => {
      renderRecentTasksTable([]);
    });
}

loadHomeSummary();

