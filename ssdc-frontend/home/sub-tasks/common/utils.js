// Shared lightweight helpers (frontend-only).
(function () {
  const root = (window.SSDC = window.SSDC || {});
  const utils = (root.utils = root.utils || {});

  utils.normalizeText = function normalizeText(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim();
  };

  utils.escapeHtml = function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  utils.normalizeCategoryKey = function normalizeCategoryKey(value) {
    return String(value == null ? "" : value)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  };

  utils.categoryPriority = function categoryPriority(value) {
    const key = utils.normalizeCategoryKey(value);
    if (key.includes("hematology")) return 0;
    if (key.includes("biochemistry")) return 1;
    if (key.includes("serology")) return 2;
    if (key.includes("microbiology")) return 3;
    if (key.includes("clinical pathology") && key.includes("urine")) return 4;
    if (key.includes("clinical pathology")) return 4;
    if (key.includes("endocrinology")) return 5;
    if (key.includes("thyroid")) return 5;
    if (key.includes("hormone")) return 5;
    return 99;
  };

  utils.readStorageJson = function readStorageJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  };

  utils.writeStorageJson = function writeStorageJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // ignore
    }
  };
})();

