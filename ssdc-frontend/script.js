/* ================= SIDEBAR ACTIVE ================= */
const allSideMenu = document.querySelectorAll('#sidebar .side-menu.top li');
const pageFrame = document.getElementById('page-frame');

function readAuthToken() {
    return typeof window.getAuthToken === "function" ? window.getAuthToken() : null;
}

function clearStoredAuthToken() {
    if (typeof window.clearAuthToken === "function") {
        window.clearAuthToken();
    }
}

// Guard: block direct access to dashboard without login token.
if (!readAuthToken()) {
    window.location.href = "index.html";
}

async function checkOnboarding() {
    try {
        const res = await fetch(`${window.API_BASE_URL || "/api"}/onboarding/status`);
        if (!res.ok) {
            return;
        }
        const status = await res.json();
        const completed = Boolean(status && status.onboardingCompleted);
        const testCount = Number(status && status.testCount ? status.testCount : 0);
        if (!completed && testCount === 0) {
            window.location.href = "select-tests.html";
        }
    } catch (e) {
        // ignore
    }
}

checkOnboarding();

const menuByPage = {
    "home/sub-tasks/1-home.html": "dashboard",
    "home/sub-tasks/2-patient.html": "patient",
    "home/sub-tasks/3-reports.html": "reports",
    "home/sub-tasks/4-accounts.html": "accounts",
    "home/sub-tasks/4-accounts-due.html": "accounts",
    "home/sub-tasks/5-tests.html": "tests",
    "home/sub-tasks/6-doctor.html": "doctors",
    "home/sub-tasks/7-settings.html": "settings"
};

function normalizePagePath(page) {
    if (!page) {
        return "";
    }

    try {
        const url = new URL(String(page), window.location.href);
        return url.pathname.replace(/^\//, "");
    } catch (error) {
        return String(page).replace(/^\//, "");
    }
}

function inferMenuKey(page) {
    const normalized = normalizePagePath(page);
    return normalized ? menuByPage[normalized] || null : null;
}

function updateMenuForPage(page, menuKey) {
    const key = menuKey || inferMenuKey(page);
    if (key) {
        setActiveMenu(key);
    }
}

/* 🔹 Set active menu by key */
function setActiveMenu(menuKey) {
    allSideMenu.forEach(li => li.classList.remove('active'));

    const target = document.querySelector(
        `#sidebar .side-menu.top li[data-menu="${menuKey}"]`
    );

    if (target) {
        target.classList.add('active');
    }
}

/* 🔹 Click from sidebar */
allSideMenu.forEach(li => {
    const link = li.querySelector("a");
    if (!link) return;

    link.addEventListener('click', (e) => {
        e.preventDefault(); // prevent jump
        const key = li.dataset.menu;
        if (key) {
            setActiveMenu(key);
        }
        const page = link.getAttribute("data-page");
        if (page) {
            loadPage(page, key || null);
        }
        if (window.innerWidth < 768) {
            sidebar.classList.add('hide');
        }
    });
});

/* ================= TOGGLE SIDEBAR ================= */
const menuBar = document.querySelector('#content nav .bx-menu');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

menuBar.addEventListener('click', () => {
    sidebar.classList.toggle('hide');
});

if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.add('hide');
    });
}

/* ================= LOAD PAGE INTO IFRAME ================= */
function loadPage(page, menuKey = null) {
    if (pageFrame) {
        pageFrame.src = page;
    }
    updateMenuForPage(page, menuKey);
}

function applyFrameTheme() {
    if (!pageFrame) return;

    try {
        const doc = pageFrame.contentDocument || pageFrame.contentWindow?.document;
        if (!doc) return;
        const usesTheme = doc.querySelector('link[href*="theme.css"]');
        if (!usesTheme) return;

        doc.documentElement?.classList.add('in-frame');
        doc.body?.classList.add('in-frame');

        if (!doc.getElementById('frame-theme-reset')) {
            const style = doc.createElement('style');
            style.id = 'frame-theme-reset';
            style.textContent = `
html.in-frame,
body.in-frame {
    background: transparent !important;
}
`;
            doc.head?.appendChild(style);
        }
    } catch (error) {
        // Ignore access errors if the iframe isn't ready or is cross-origin.
    }
}

/* ================= AUTO HIDE SIDEBAR ================= */
let isMobile = window.innerWidth < 768;
if (isMobile) {
    sidebar.classList.add('hide');
}

window.addEventListener('resize', () => {
    const nowMobile = window.innerWidth < 768;
    if (nowMobile && !isMobile) {
        sidebar.classList.add('hide');
    } else if (!nowMobile && isMobile) {
        sidebar.classList.remove('hide');
    }
    isMobile = nowMobile;
});

/* 🔹 Expose to iframe */
window.setActiveMenu = setActiveMenu;
window.loadPage = loadPage;

/* ================= LOGOUT ================= */
const logoutLink = document.querySelector("#sidebar a.logout");
if (logoutLink) {
    logoutLink.addEventListener("click", (e) => {
        e.preventDefault();
        if (typeof window.forceLogout === "function") {
            window.forceLogout("manual");
            return;
        }
        clearStoredAuthToken();
        window.location.href = "index.html";
    });
}

function getFramePagePath() {
    if (!pageFrame) {
        return "";
    }

    try {
        const href = pageFrame.contentWindow?.location?.href;
        if (href) {
            return normalizePagePath(href);
        }
    } catch (error) {
        // Ignore access errors if the iframe isn't ready or is cross-origin.
    }

    return normalizePagePath(pageFrame.getAttribute("src"));
}

if (pageFrame) {
    pageFrame.addEventListener("load", () => {
        const framePage = getFramePagePath();
        updateMenuForPage(framePage);
        applyFrameTheme();
    });
    applyFrameTheme();
}

/* ================= DASHBOARD DATE/TIME ================= */
const dashboardFrame = pageFrame;
const dashboardDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad2 = (value) => String(value).padStart(2, '0');

function formatDashboardDateTime(date) {
    const dayName = dashboardDays[date.getDay()];
    const day = pad2(date.getDate());
    const month = pad2(date.getMonth() + 1);
    const year = date.getFullYear();

    let hours = date.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;

    const hourStr = pad2(hours);
    const minutes = pad2(date.getMinutes());
    const seconds = pad2(date.getSeconds());

    return `${dayName} ${day}-${month}-${year}. ${hourStr}:${minutes}:${seconds} ${ampm}`;
}

function updateDashboardDateTime() {
    if (!dashboardFrame) return;

    const text = formatDashboardDateTime(new Date());

    try {
        const frameDoc = dashboardFrame.contentDocument || dashboardFrame.contentWindow?.document;
        const target = frameDoc?.getElementById('dashboard-datetime');
        if (target) {
            target.textContent = text;
        }
    } catch (error) {
        // Ignore access errors if the iframe isn't ready or is cross-origin.
    }
}

if (dashboardFrame) {
    updateDashboardDateTime();
    setInterval(updateDashboardDateTime, 1000);
    dashboardFrame.addEventListener('load', updateDashboardDateTime);
}
