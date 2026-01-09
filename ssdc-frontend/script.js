/* ================= SIDEBAR ACTIVE ================= */
const allSideMenu = document.querySelectorAll('#sidebar .side-menu.top li');

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
    const frame = document.getElementById('page-frame');
    frame.src = page;

    if (menuKey) {
        setActiveMenu(menuKey);
    }
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