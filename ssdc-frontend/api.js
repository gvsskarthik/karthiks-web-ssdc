(function () {
  var defaultBase = "/api";

  var stored = null;
  if (window.localStorage) {
    stored = window.localStorage.getItem("SSDC_API_BASE_URL");
  }

  if (stored) {
    stored = stored.trim();
  }

  var isAbsoluteApiBase = stored && /^https?:\/\//i.test(stored);
  var isValidRelativeApiBase = stored && stored.indexOf("/api") === 0;
  window.API_BASE_URL =
    isAbsoluteApiBase || isValidRelativeApiBase ? stored : defaultBase;
  window.apiUrl = function (path) {
    if (!path) {
      return window.API_BASE_URL;
    }
    return path.charAt(0) === "/"
      ? window.API_BASE_URL + path
      : window.API_BASE_URL + "/" + path;
  };
})();
