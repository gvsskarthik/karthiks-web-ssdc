(function () {
  function renderPatientInfo(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
      return;
    }

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    function makeField(labelText, valueId) {
      const wrap = document.createElement("div");

      const label = document.createElement("span");
      label.className = "label";
      label.textContent = labelText;

      const sep = document.createTextNode(" : ");

      const value = document.createElement("span");
      value.id = valueId;

      wrap.appendChild(label);
      wrap.appendChild(sep);
      wrap.appendChild(value);
      return wrap;
    }

    const box = document.createElement("div");
    box.className = "patient-box";

    const row1 = document.createElement("div");
    row1.className = "row";
    row1.appendChild(makeField("PATIENT", "pName"));
    row1.appendChild(makeField("DATE", "pDate"));

    const row2 = document.createElement("div");
    row2.className = "row";
    row2.appendChild(makeField("ADDRESS", "pAddress"));
    row2.appendChild(makeField("AGE / SEX", "pAgeSex"));

    const row3 = document.createElement("div");
    row3.className = "row";
    row3.appendChild(makeField("REF BY Dr.", "pDoctor"));
    row3.appendChild(makeField("MOBILE", "pMobile"));

    box.appendChild(row1);
    box.appendChild(row2);
    box.appendChild(row3);
    container.appendChild(box);
  }

  window.renderPatientInfo = renderPatientInfo;
  renderPatientInfo("patient-info");
})();
