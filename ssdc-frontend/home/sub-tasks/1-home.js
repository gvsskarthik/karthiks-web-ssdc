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
