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

  function applySavedTheme() {
    applyTheme(readTheme());
  }

  if (document.body) {
    applySavedTheme();
  } else {
    document.addEventListener("DOMContentLoaded", applySavedTheme, { once: true });
  }

  window.addEventListener("storage", (event) => {
    if (event.storageArea !== localStorage) return;
    if (event.key !== THEME_STORAGE_KEY) return;
    applyTheme(event.newValue);
  });
})();
