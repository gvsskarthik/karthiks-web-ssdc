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

function formatYmdToDdMmYyyy(ymd) {
  const s = normalizeYmd(ymd);
  if (!s) return "-";
  const parts = s.split("-");
  const yyyy = parts[0];
  const mm = parts[1];
  const dd = parts[2];
  return `${dd}-${mm}-${yyyy}`;
}

function clearNode(node) {
  if (!node) return;
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

let latestRecentTasks = [];
let homeDateSortDir = null; // null | "asc" | "desc"

function pad2(n) {
  return String(n).padStart(2, "0");
}

function getTodayYmdIst() {
  if (typeof window.getIstDateInputValue === "function") {
    return window.getIstDateInputValue(new Date());
  }
  return new Date().toISOString().slice(0, 10);
}

function monthRangeForYmd(ymd) {
  const base = normalizeYmd(ymd) || getTodayYmdIst();
  const year = Number(base.slice(0, 4));
  const month = Number(base.slice(5, 7)); // 1..12
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: `${year}-${pad2(month)}-01`,
    to: `${year}-${pad2(month)}-${pad2(lastDay)}`
  };
}

function setupDueHeaderNavigation() {
  const dueHeader = document.querySelector("table.recent-tasks thead th.amount");
  if (!dueHeader) {
    return;
  }
  dueHeader.style.cursor = "pointer";
  dueHeader.title = "Open due list";
  dueHeader.addEventListener("click", () => {
    const baseYmd =
      (latestRecentTasks && latestRecentTasks.length && latestRecentTasks[0]?.dateYmd)
        ? latestRecentTasks[0].dateYmd
        : getTodayYmdIst();
    const range = monthRangeForYmd(baseYmd);
    const url = `home/sub-tasks/4-accounts-due.html?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;

    if (typeof parent !== "undefined" && parent && typeof parent.loadPage === "function") {
      parent.loadPage(url, "accounts");
      return;
    }
    window.location.href = `4-accounts-due.html?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
  });
}

function compareYmd(a, b) {
  const aa = String(a || "").trim();
  const bb = String(b || "").trim();
  if (aa === bb) return 0;
  return aa < bb ? -1 : 1;
}

function getSortedRecentTasksForDisplay() {
  const list = Array.isArray(latestRecentTasks) ? latestRecentTasks.slice() : [];
  if (homeDateSortDir !== "asc" && homeDateSortDir !== "desc") {
    return list;
  }
  list.sort((x, y) => {
    const c = compareYmd(x?.dateYmd, y?.dateYmd);
    if (c !== 0) {
      return homeDateSortDir === "asc" ? c : -c;
    }
    const xi = Number(x?.id) || 0;
    const yi = Number(y?.id) || 0;
    return homeDateSortDir === "asc" ? (xi - yi) : (yi - xi);
  });
  return list;
}

function updateHomeDateHeaderLabel() {
  const dateHeader = document.getElementById("homeDateHeader");
  if (!dateHeader) return;
  let suffix = "";
  if (homeDateSortDir === "asc") suffix = " ▲";
  if (homeDateSortDir === "desc") suffix = " ▼";
  dateHeader.textContent = `Date${suffix}`;
}

function setupDateHeaderSort() {
  const dateHeader = document.getElementById("homeDateHeader");
  if (!dateHeader) {
    return;
  }
  dateHeader.style.cursor = "pointer";
  dateHeader.title = "Sort by date";
  updateHomeDateHeaderLabel();
  dateHeader.addEventListener("click", () => {
    if (homeDateSortDir == null) {
      homeDateSortDir = "asc";
    } else {
      homeDateSortDir = homeDateSortDir === "asc" ? "desc" : "asc";
    }
    updateHomeDateHeaderLabel();
    renderRecentTasksTable(getSortedRecentTasksForDisplay());
  });
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
    tdDate.textContent = formatYmdToDdMmYyyy(t.dateYmd);

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

      const todayCount = Number(obj.todayCount) || 0;
      const todayPending = Number(obj.todayPendingCount) || 0;
      const todayCompleted = Math.max(0, todayCount - todayPending);

      setText("home-today-count", todayCount);
      setText("home-week-count", Number(obj.weekCount) || 0);
      setText("home-month-count", Number(obj.monthCount) || 0);
      setText("home-year-count", Number(obj.yearCount) || 0);
      setText("home-today-pending-count", todayPending);
      setText("home-today-completed-count", todayCompleted);

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
      latestRecentTasks = tasks;
      updateHomeDateHeaderLabel();
      renderRecentTasksTable(getSortedRecentTasksForDisplay());
    })
    .catch(() => {
      latestRecentTasks = [];
      updateHomeDateHeaderLabel();
      renderRecentTasksTable([]);
    });
}

setupDueHeaderNavigation();
setupDateHeaderSort();
loadHomeSummary();
