(function () {
  const THEME_STORAGE_KEY = "ssdc-theme";

  function readTheme() {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  function applyTheme(theme) {
    const isDark = theme === "dark";
    document.documentElement.classList.toggle("dark", isDark);
    document.body.classList.toggle("dark", isDark);
  }

  if (document.body) {
    applyTheme(readTheme());
  } else {
    document.addEventListener("DOMContentLoaded", () => applyTheme(readTheme()), { once: true });
  }
})();

