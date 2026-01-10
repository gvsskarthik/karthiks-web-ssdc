/* ================= SIDEBAR ACTIVE ================= */
const allSideMenu = document.querySelectorAll('#sidebar .side-menu.top li');
const pageFrame = document.getElementById('page-frame');

const menuByPage = {
    "home/sub-tasks/1-home.html": "dashboard",
    "home/sub-tasks/2-patient.html": "patient",
    "home/sub-tasks/3-reports.html": "reports",
    "home/sub-tasks/4-accounts.html": "accounts",
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
    });
});

/* ================= TOGGLE SIDEBAR ================= */
const menuBar = document.querySelector('#content nav .bx-menu');
const sidebar = document.getElementById('sidebar');

menuBar.addEventListener('click', () => {
    sidebar.classList.toggle('hide');
});

/* ================= DARK MODE ================= */
const switchMode = document.getElementById('switch-mode');

switchMode.addEventListener('change', function () {
    document.body.classList.toggle('dark', this.checked);
});

/* ================= LOAD PAGE INTO IFRAME ================= */
function loadPage(page, menuKey = null) {
    if (pageFrame) {
        pageFrame.src = page;
    }
    updateMenuForPage(page, menuKey);
}

/* ================= AUTO HIDE SIDEBAR ================= */
if (window.innerWidth < 768) {
    sidebar.classList.add('hide');
}

window.addEventListener('resize', () => {
    if (window.innerWidth < 768) {
        sidebar.classList.add('hide');
    }
});

/* 🔹 Expose to iframe */
window.setActiveMenu = setActiveMenu;
window.loadPage = loadPage;

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
    });
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

    return `${dayName} ${day}/${month}/${year}. ${hourStr}:${minutes}:${seconds} ${ampm}`;
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
