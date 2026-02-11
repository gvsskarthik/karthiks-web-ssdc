function setText(id, value){
  const el = document.getElementById(id);
  if (!el) {
    return;
  }
  el.textContent = value == null ? "—" : String(value);
}

function getTodayIstYmd(){
  if (window.getIstDateInputValue) {
    return window.getIstDateInputValue(new Date());
  }
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseYmdToUtcDate(ymd){
  const parts = String(ymd || "").split("-");
  if (parts.length !== 3) {
    return null;
  }
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  return new Date(Date.UTC(year, month - 1, day));
}

function formatUtcDateToIstYmd(date){
  if (window.getIstDateInputValue) {
    return window.getIstDateInputValue(date);
  }
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekDatesIst(){
  // Sunday .. today (IST calendar).
  const todayYmd = getTodayIstYmd();
  const todayUtc = parseYmdToUtcDate(todayYmd);
  if (!todayUtc) {
    return [todayYmd];
  }
  const day = todayUtc.getUTCDay(); // 0=Sun
  const diffFromSunday = day; // Sun=0..Sat=6
  const start = new Date(todayUtc);
  start.setUTCDate(start.getUTCDate() - diffFromSunday);

  const dates = [];
  const cur = new Date(start);
  while (cur.getTime() <= todayUtc.getTime() && dates.length < 7) {
    dates.push(formatUtcDateToIstYmd(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates.length ? dates : [todayYmd];
}

function getMonthDatesIst(){
  // 1st day of month .. today (IST calendar).
  const todayYmd = getTodayIstYmd();
  const todayUtc = parseYmdToUtcDate(todayYmd);
  if (!todayUtc) {
    return [todayYmd];
  }
  const start = new Date(todayUtc);
  start.setUTCDate(1);

  const dates = [];
  const cur = new Date(start);
  // Guard: never exceed 31 days.
  while (cur.getTime() <= todayUtc.getTime() && dates.length < 31) {
    dates.push(formatUtcDateToIstYmd(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates.length ? dates : [todayYmd];
}

function getYearDatesIst(){
  // Jan 1 .. today (IST calendar).
  const todayYmd = getTodayIstYmd();
  const todayUtc = parseYmdToUtcDate(todayYmd);
  if (!todayUtc) {
    return [todayYmd];
  }
  const start = new Date(todayUtc);
  start.setUTCMonth(0, 1);

  const dates = [];
  const cur = new Date(start);
  // Guard: never exceed 366 days.
  while (cur.getTime() <= todayUtc.getTime() && dates.length < 366) {
    dates.push(formatUtcDateToIstYmd(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates.length ? dates : [todayYmd];
}

function loadTodayCount(){
  const CACHE_KEY = "SSDC_HOME_TODAY_COUNT";
  const CACHE_AT_KEY = "SSDC_HOME_TODAY_COUNT_AT";
  const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

  // Show last known value immediately (no 0->N flicker).
  try {
    const cached = window.localStorage?.getItem(CACHE_KEY);
    const cachedAt = Number(window.localStorage?.getItem(CACHE_AT_KEY));
    if (cached != null && cached !== "") {
      if (!Number.isNaN(cachedAt) && (Date.now() - cachedAt) < MAX_AGE_MS) {
        setText("home-today-count", cached);
      } else {
        // Even if stale, it's better UX than flashing 0 every time.
        setText("home-today-count", cached);
      }
    }
  } catch (e) {
    // ignore storage errors
  }

  fetch(`${API_BASE_URL}/patients/today`)
    .then(res => res.json())
    .then(list => {
      const count = Array.isArray(list) ? list.length : 0;
      setText("home-today-count", count);
      try {
        window.localStorage?.setItem(CACHE_KEY, String(count));
        window.localStorage?.setItem(CACHE_AT_KEY, String(Date.now()));
      } catch (e) {
        // ignore storage errors
      }
    })
    .catch(() => {
      // keep default
    });
}

loadTodayCount();

function loadWeekCount(){
  const CACHE_KEY = "SSDC_HOME_WEEK_COUNT";
  const CACHE_AT_KEY = "SSDC_HOME_WEEK_COUNT_AT";
  const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

  try {
    const cached = window.localStorage?.getItem(CACHE_KEY);
    const cachedAt = Number(window.localStorage?.getItem(CACHE_AT_KEY));
    if (cached != null && cached !== "") {
      if (!Number.isNaN(cachedAt) && (Date.now() - cachedAt) < MAX_AGE_MS) {
        setText("home-week-count", cached);
      } else {
        setText("home-week-count", cached);
      }
    }
  } catch (e) {
    // ignore
  }

  const dates = getWeekDatesIst();
  Promise.all(
    dates.map(date =>
      fetch(`${API_BASE_URL}/patients/by-date/${date}`)
        .then(res => res.json())
        .then(list => Array.isArray(list) ? list.length : 0)
        .catch(() => 0)
    )
  )
    .then(counts => {
      const total = (counts || []).reduce((sum, n) => sum + (Number(n) || 0), 0);
      setText("home-week-count", total);
      try {
        window.localStorage?.setItem(CACHE_KEY, String(total));
        window.localStorage?.setItem(CACHE_AT_KEY, String(Date.now()));
      } catch (e) {
        // ignore
      }
    })
    .catch(() => {});
}

loadWeekCount();

function loadMonthCount(){
  const CACHE_KEY = "SSDC_HOME_MONTH_COUNT";
  const CACHE_AT_KEY = "SSDC_HOME_MONTH_COUNT_AT";
  const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

  try {
    const cached = window.localStorage?.getItem(CACHE_KEY);
    const cachedAt = Number(window.localStorage?.getItem(CACHE_AT_KEY));
    if (cached != null && cached !== "") {
      if (!Number.isNaN(cachedAt) && (Date.now() - cachedAt) < MAX_AGE_MS) {
        setText("home-month-count", cached);
      } else {
        setText("home-month-count", cached);
      }
    }
  } catch (e) {
    // ignore
  }

  const dates = getMonthDatesIst();
  Promise.all(
    dates.map(date =>
      fetch(`${API_BASE_URL}/patients/by-date/${date}`)
        .then(res => res.json())
        .then(list => Array.isArray(list) ? list.length : 0)
        .catch(() => 0)
    )
  )
    .then(counts => {
      const total = (counts || []).reduce((sum, n) => sum + (Number(n) || 0), 0);
      setText("home-month-count", total);
      try {
        window.localStorage?.setItem(CACHE_KEY, String(total));
        window.localStorage?.setItem(CACHE_AT_KEY, String(Date.now()));
      } catch (e) {
        // ignore
      }
    })
    .catch(() => {});
}

loadMonthCount();

function loadYearCount(){
  const CACHE_KEY = "SSDC_HOME_YEAR_COUNT";
  const CACHE_AT_KEY = "SSDC_HOME_YEAR_COUNT_AT";
  const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

  try {
    const cached = window.localStorage?.getItem(CACHE_KEY);
    const cachedAt = Number(window.localStorage?.getItem(CACHE_AT_KEY));
    if (cached != null && cached !== "") {
      if (!Number.isNaN(cachedAt) && (Date.now() - cachedAt) < MAX_AGE_MS) {
        setText("home-year-count", cached);
      } else {
        setText("home-year-count", cached);
      }
    }
  } catch (e) {
    // ignore
  }

  const dates = getYearDatesIst();
  Promise.all(
    dates.map(date =>
      fetch(`${API_BASE_URL}/patients/by-date/${date}`)
        .then(res => res.json())
        .then(list => Array.isArray(list) ? list.length : 0)
        .catch(() => 0)
    )
  )
    .then(counts => {
      const total = (counts || []).reduce((sum, n) => sum + (Number(n) || 0), 0);
      setText("home-year-count", total);
      try {
        window.localStorage?.setItem(CACHE_KEY, String(total));
        window.localStorage?.setItem(CACHE_AT_KEY, String(Date.now()));
      } catch (e) {
        // ignore
      }
    })
    .catch(() => {});
}

loadYearCount();

function safeJson(res) {
  return res && typeof res.json === "function"
    ? res.json().catch(() => null)
    : Promise.resolve(null);
}

function getYesterdayIstYmd() {
  const todayYmd = getTodayIstYmd();
  const todayUtc = parseYmdToUtcDate(todayYmd);
  if (!todayUtc) {
    return todayYmd;
  }
  const d = new Date(todayUtc);
  d.setUTCDate(d.getUTCDate() - 1);
  return formatUtcDateToIstYmd(d);
}

function normalizeYmd(value) {
  const s = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }
  return "";
}

function isCompletedStatus(status) {
  return String(status || "").trim().toUpperCase() === "COMPLETED";
}

function computeDue(amount, paid) {
  const bill = Number(amount) || 0;
  const paidAmt = Number(paid) || 0;
  return Math.max(0, bill - paidAmt);
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

function getSortKeyForTask(task, todayYmd, yesterdayYmd) {
  const date = task.dateYmd;
  const pending = task.pending;
  const due = task.due;

  if (date === todayYmd) {
    if (pending) return { group: 1, sub: 0, date, tiebreak: task.id };
    if (due) return { group: 2, sub: 0, date, tiebreak: task.id };
  }

  if (date === yesterdayYmd) {
    if (pending) return { group: 3, sub: 0, date, tiebreak: task.id };
    if (due) return { group: 3, sub: 1, date, tiebreak: task.id };
  }

  // Past days: day-wise, with pending before due for the same day.
  return { group: 4, sub: pending ? 0 : 1, date, tiebreak: task.id };
}

function compareTasks(a, b) {
  if (a.key.group !== b.key.group) return a.key.group - b.key.group;
  if (a.key.group === 4) {
    if (a.key.date !== b.key.date) return a.key.date < b.key.date ? 1 : -1; // newer first
  }
  if (a.key.sub !== b.key.sub) return a.key.sub - b.key.sub;
  return (Number(b.key.tiebreak) || 0) - (Number(a.key.tiebreak) || 0);
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

function loadRecentTasks() {
  fetch(`${API_BASE_URL}/patients/tasks/recent?limit=20`)
    .then((res) => safeJson(res))
    .then((list) => {
      const tasks = [];

      const rows = Array.isArray(list) ? list : [];
      for (const r of rows) {
        const dateYmd = normalizeYmd(r && r.date);
        if (!dateYmd) continue;

        const dueAmount = Number(r && r.dueAmount) || 0;
        const pending = Boolean(r && r.pending);

        tasks.push({
          id: Number(r && r.id) || 0,
          name: r && r.patientName ? String(r.patientName) : "",
          dateYmd,
          dueAmount,
          pending
        });
      }

      renderRecentTasksTable(tasks);
    })
    .catch(() => {
      renderRecentTasksTable([]);
    });
}

loadRecentTasks();
