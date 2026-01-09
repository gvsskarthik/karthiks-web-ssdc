(function () {
  var defaultBase = "/api";

  var stored = null;
  if (window.localStorage) {
    stored = window.localStorage.getItem("SSDC_API_BASE_URL");
  }

  var isValidRelativeApiBase = stored && stored.indexOf("/api") === 0;
  window.API_BASE_URL = isValidRelativeApiBase ? stored : defaultBase;
  window.apiUrl = function (path) {
    if (!path) {
      return window.API_BASE_URL;
    }
    return path.charAt(0) === "/"
      ? window.API_BASE_URL + path
      : window.API_BASE_URL + "/" + path;
  };
})();
