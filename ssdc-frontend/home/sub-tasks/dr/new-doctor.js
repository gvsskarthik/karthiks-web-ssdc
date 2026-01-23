document.getElementById("doctorForm").addEventListener("submit", function(e) {
  e.preventDefault();

  const commissionRateRaw = document.getElementById("commissionRate").value.trim();
  const commissionRate =
    commissionRateRaw === "" ? null : Number(commissionRateRaw);

  const doctor = {
    name: document.getElementById("name").value,
    displayName: document.getElementById("displayName").value,
    specialization: document.getElementById("specialization").value,
    phone: document.getElementById("phone").value,
    hospital: document.getElementById("hospital").value,
    commissionPercentage: null,
    isActive: true
  };
  if (!doctor.displayName || !doctor.displayName.trim()) {
    doctor.displayName = doctor.name;
  }
  if (commissionRate !== null && Number.isFinite(commissionRate)) {
    doctor.commissionPercentage = commissionRate;
  }

  fetch(apiUrl("doctors"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(doctor)
  })
  .then(() => {
    alert("Doctor saved successfully");
    window.location.href = "../6-doctor.html";
  })
  .catch(err => {
    console.error("Error saving doctor", err);
    alert("Error saving doctor");
  });
});
