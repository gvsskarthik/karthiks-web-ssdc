const apiPath = window.apiUrl || function (path) {
  return path && path.charAt(0) === "/" ? "/api" + path : "/api/" + path;
};

const doctorSelect = document.getElementById("doctor");
const dateFromInput = document.getElementById("dateFrom");
const dateToInput = document.getElementById("dateTo");
const applyFilters = document.getElementById("applyFilters");
const thisMonthBtn = document.getElementById("thisMonth");
const backBtn = document.getElementById("backBtn");
const dueBody = document.getElementById("dueBody");
const rangeSubtitle = document.getElementById("rangeSubtitle");
const tableMeta = document.getElementById("tableMeta");

let doctors = [];

function isYmd(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim());
}

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
  const base = String(ymd || "").trim();
  if (!isYmd(base)) {
    const today = getTodayYmdIst();
    return monthRangeForYmd(today);
  }
  const year = Number(base.slice(0, 4));
  const month = Number(base.slice(5, 7)); // 1..12
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: `${year}-${pad2(month)}-01`,
    to: `${year}-${pad2(month)}-${pad2(lastDay)}`
  };
}

function resolveInitialFilters() {
  const params = new URLSearchParams(window.location.search || "");
  const rawFrom = params.get("from");
  const rawTo = params.get("to");
  const doctorId = params.get("doctorId") || "";

  let range;
  if (isYmd(rawFrom) && isYmd(rawTo)) {
    range = { from: rawFrom, to: rawTo };
  } else if (isYmd(rawFrom) && !isYmd(rawTo)) {
    const month = monthRangeForYmd(rawFrom);
    range = { from: rawFrom, to: month.to };
  } else if (!isYmd(rawFrom) && isYmd(rawTo)) {
    const month = monthRangeForYmd(rawTo);
    range = { from: month.from, to: rawTo };
  } else {
    const month = monthRangeForYmd(getTodayYmdIst());
    range = { from: month.from, to: month.to };
  }

  if (range.from > range.to) {
    const tmp = range.from;
    range.from = range.to;
    range.to = tmp;
  }

  return { range, doctorId };
}

function setSubtitle(range, doctorName) {
  const docText = doctorName ? ` • ${doctorName}` : "";
  const fromText =
    window.formatYmdToDdMmYyyy ? window.formatYmdToDdMmYyyy(range.from) : range.from;
  const toText =
    window.formatYmdToDdMmYyyy ? window.formatYmdToDdMmYyyy(range.to) : range.to;
  rangeSubtitle.textContent = `${fromText} to ${toText}${docText}`;
}

function clearNode(node) {
  if (!node) return;
  while (node.firstChild) node.removeChild(node.firstChild);
}

function formatInr(amount) {
  const n = Number(amount) || 0;
  try {
    const fmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
    return "₹" + fmt.format(Math.round(n));
  } catch (e) {
    return "₹" + String(Math.round(n));
  }
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return res.json();
}

function showMessage(message) {
  clearNode(dueBody);
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 8;
  td.className = "muted text-center";
  td.textContent = message;
  tr.appendChild(td);
  dueBody.appendChild(tr);
}

function renderRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) {
    tableMeta.textContent = "";
    showMessage("No due patients found for the selected filters.");
    return;
  }

  let totalDue = 0;
  clearNode(dueBody);
  const frag = document.createDocumentFragment();

  list.forEach((r, idx) => {
    const tr = document.createElement("tr");

    const tdDate = document.createElement("td");
    tdDate.textContent =
      (window.formatYmdToDdMmYyyy && r?.visitDate)
        ? window.formatYmdToDdMmYyyy(r.visitDate)
        : (r?.visitDate ? String(r.visitDate) : "-");

    const tdSno = document.createElement("td");
    tdSno.textContent = String(idx + 1);

    const tdName = document.createElement("td");
    tdName.textContent = r?.patientName ? String(r.patientName) : "-";

    const tdPhone = document.createElement("td");
    tdPhone.textContent = r?.mobile ? String(r.mobile) : "-";

    const tdAddr = document.createElement("td");
    tdAddr.textContent = r?.address ? String(r.address) : "-";

    const tdDoc = document.createElement("td");
    tdDoc.textContent = r?.doctorName ? String(r.doctorName) : "SELF";

    const due = Number(r?.dueAmount) || 0;
    totalDue += due;
    const tdDue = document.createElement("td");
    tdDue.className = "num";
    tdDue.textContent = formatInr(due);

    const rawStatus = String(r?.status || "").trim().toUpperCase();
    const completed = rawStatus === "COMPLETED";
    const tdStatus = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `status ${completed ? "completed" : "pending"}`;
    badge.textContent = completed ? "Completed" : "Pending";
    tdStatus.appendChild(badge);

    tr.appendChild(tdSno);
    tr.appendChild(tdName);
    tr.appendChild(tdPhone);
    tr.appendChild(tdAddr);
    tr.appendChild(tdDoc);
    tr.appendChild(tdDue);
    tr.appendChild(tdStatus);

    tr.insertBefore(tdDate, tr.firstChild);
    frag.appendChild(tr);
  });

  dueBody.appendChild(frag);
  tableMeta.textContent = `${list.length} patient(s) • Total Due: ${formatInr(totalDue)}`;
}

async function loadDoctors(selectedId) {
  clearNode(doctorSelect);
  const optAll = document.createElement("option");
  optAll.value = "";
  optAll.textContent = "All";
  doctorSelect.appendChild(optAll);

  try {
    const data = await fetchJson(apiPath("/accounts/doctors"));
    doctors = Array.isArray(data) ? data : [];
  } catch (err) {
    doctors = [];
  }

  const frag = document.createDocumentFragment();
  doctors.forEach(d => {
    if (!d?.doctorName) return;
    const opt = document.createElement("option");
    opt.value = String(d.doctorId);
    opt.textContent = String(d.doctorName);
    frag.appendChild(opt);
  });
  doctorSelect.appendChild(frag);

  if (selectedId) {
    doctorSelect.value = selectedId;
  }
}

function getSelectedDoctorName() {
  const id = doctorSelect.value;
  if (!id) return "";
  const d = doctors.find(x => String(x.doctorId) === String(id));
  return d?.doctorName ? String(d.doctorName) : "";
}

function updateUrlState(range, doctorId) {
  const url = new URL(window.location.href);
  url.searchParams.set("from", range.from);
  url.searchParams.set("to", range.to);
  if (doctorId) {
    url.searchParams.set("doctorId", doctorId);
  } else {
    url.searchParams.delete("doctorId");
  }
  window.history.replaceState({}, "", url.toString());
}

async function loadDue(range) {
  const doctorId = doctorSelect.value || "";
  const qs = new URLSearchParams();
  qs.set("from", range.from);
  qs.set("to", range.to);
  if (doctorId) qs.set("doctorId", doctorId);
  qs.set("limit", "5000");

  showMessage("Loading…");
  try {
    const rows = await fetchJson(`${apiPath("/accounts/due")}?${qs.toString()}`);
    renderRows(rows);
  } catch (err) {
    console.error("Failed to load due list", err);
    showMessage("Failed to load due list.");
  }
}

function setMonthToInputs() {
  const month = monthRangeForYmd(getTodayYmdIst());
  dateFromInput.value = month.from;
  dateToInput.value = month.to;
  return month;
}

function init() {
  const initial = resolveInitialFilters();
  dateFromInput.value = initial.range.from;
  dateToInput.value = initial.range.to;

  loadDoctors(initial.doctorId).then(() => {
    const range = { from: dateFromInput.value, to: dateToInput.value };
    setSubtitle(range, getSelectedDoctorName());
    updateUrlState(range, doctorSelect.value);
    loadDue(range);
  });

  applyFilters.addEventListener("click", async () => {
    const from = String(dateFromInput.value || "").trim();
    const to = String(dateToInput.value || "").trim();
    if (!isYmd(from) || !isYmd(to)) {
      if (typeof window.ssdcAlert === "function") {
        await window.ssdcAlert("Please select From and To dates.", { title: "Invalid Date Range" });
      } else {
        alert("Please select From and To dates.");
      }
      return;
    }
    if (from > to) {
      if (typeof window.ssdcAlert === "function") {
        await window.ssdcAlert("From date must be before To date.", { title: "Invalid Date Range" });
      } else {
        alert("From date must be before To date.");
      }
      return;
    }
    const range = { from, to };
    setSubtitle(range, getSelectedDoctorName());
    updateUrlState(range, doctorSelect.value);
    loadDue(range);
  });

  thisMonthBtn.addEventListener("click", () => {
    const range = setMonthToInputs();
    setSubtitle(range, getSelectedDoctorName());
    updateUrlState(range, doctorSelect.value);
    loadDue(range);
  });

  doctorSelect.addEventListener("change", () => {
    const range = { from: dateFromInput.value, to: dateToInput.value };
    setSubtitle(range, getSelectedDoctorName());
    updateUrlState(range, doctorSelect.value);
    loadDue(range);
  });

  backBtn.addEventListener("click", () => {
    if (typeof parent !== "undefined" && parent && typeof parent.loadPage === "function") {
      parent.loadPage("home/sub-tasks/4-accounts.html", "accounts");
      return;
    }
    window.location.href = "4-accounts.html";
  });
}

init();
