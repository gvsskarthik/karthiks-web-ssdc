(function () {
  function renderPatientInfo(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
      return;
    }

    container.innerHTML = `
      <div class="patient-box">
        <div class="row">
          <div><span class="label">PATIENT</span> : <span id="pName"></span></div>
          <div><span class="label">DATE</span> : <span id="pDate"></span></div>
        </div>
        <div class="row">
          <div><span class="label">ADDRESS</span> : <span id="pAddress"></span></div>
          <div><span class="label">AGE / SEX</span> : <span id="pAgeSex"></span></div>
        </div>
        <div class="row">
          <div><span class="label">REF BY Dr.</span> : <span id="pDoctor"></span></div>
          <div><span class="label">MOBILE</span> : <span id="pMobile"></span></div>
        </div>
      </div>
    `;
  }

  window.renderPatientInfo = renderPatientInfo;
  renderPatientInfo("patient-info");
})();
