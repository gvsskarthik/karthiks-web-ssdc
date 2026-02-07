document.getElementById("doctorForm").addEventListener("submit", async function(e) {
  e.preventDefault();

  const commissionRateRaw = document.getElementById("commissionRate").value.trim();
  const commissionRate =
    commissionRateRaw === "" ? null : Number(commissionRateRaw);

  const doctor = {
    name: document.getElementById("name").value,
    specialization: document.getElementById("specialization").value,
    phone: document.getElementById("phone").value,
    hospital: document.getElementById("hospital").value
  };
  if (commissionRate !== null && Number.isFinite(commissionRate)) {
    doctor.commissionRate = commissionRate;
  }

  try {
    const res = await fetch(API_BASE_URL + "/doctors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(doctor)
    });
    if (!res.ok) {
      throw new Error("Error saving doctor");
    }
    await window.ssdcAlert("Doctor saved successfully", { title: "Saved" });
    window.location.href = "../6-doctor.html";
  } catch (err) {
    console.error("Error saving doctor", err);
    await window.ssdcAlert("Error saving doctor", { title: "Error" });
  }
});
