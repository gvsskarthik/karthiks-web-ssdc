const table = document.getElementById("doctorTable");
const searchInput = document.getElementById("searchInput");
const editModal = document.getElementById("editModal");
const editForm = document.getElementById("editForm");
const editName = document.getElementById("editName");
const editDisplayName = document.getElementById("editDisplayName");
const editSpecialization = document.getElementById("editSpecialization");
const editPhone = document.getElementById("editPhone");
const editHospital = document.getElementById("editHospital");
const editCommissionRate = document.getElementById("editCommissionRate");
const cancelEdit = document.getElementById("cancelEdit");

let doctors = [];
let editDoctorId = null;

function parseNumber(value){
  const cleaned = String(value ?? "").replace(/,/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function formatMoney(value){
  return String(Math.round(parseNumber(value)));
}

function normalizeName(value){
  return String(value || "").trim().toLowerCase();
}

function parseDateValue(value){
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    return new Date(Date.UTC(year, month - 1, day));
  }
  const parts = raw.split(/[\/-]/);
  if (parts.length === 3) {
    let year;
    let month;
    let day;
    if (parts[0].length === 4) {
      year = Number(parts[0]);
      month = Number(parts[1]);
      day = Number(parts[2]);
    } else {
      day = Number(parts[0]);
      month = Number(parts[1]);
      year = Number(parts[2]);
    }
    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      return new Date(Date.UTC(year, month - 1, day));
    }
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return new Date(Date.UTC(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate()
  ));
}

function isCurrentMonth(date){
  if (!date) {
    return false;
  }
  const now = new Date();
  return date.getUTCFullYear() === now.getUTCFullYear()
    && date.getUTCMonth() === now.getUTCMonth();
}

const monthlyStats = new Map();

function closeAllMenus() {
  document.querySelectorAll(".menu-list").forEach(m => {
    m.style.display = "none";
  });
  document.querySelectorAll("#doctorTable tr.menu-open").forEach(row => {
    row.classList.remove("menu-open");
  });
  document.body.classList.remove("menu-open");
}

function toggleMenu(btn) {
  const menu = btn.nextElementSibling;
  const isOpen = menu && menu.style.display === "block";
  closeAllMenus();
  if (menu) {
    menu.style.display = isOpen ? "none" : "block";
    if (!isOpen) {
      const row = btn.closest("tr");
      if (row) {
        row.classList.add("menu-open");
      }
      document.body.classList.add("menu-open");
    }
  }
}

function applySearch() {
  const search = searchInput.value.toLowerCase();
  document.querySelectorAll("#doctorTable tr").forEach(row => {
    row.style.display = row.innerText.toLowerCase().includes(search) ? "" : "none";
  });
}

function renderDoctors() {
  table.innerHTML = "";
  doctors.forEach((d, i) => {
    const key = normalizeName(d.name);
    const displayName = d.displayName || d.name || "-";
    const stats = key ? (monthlyStats.get(key) || { revenue: 0, commission: 0 }) : { revenue: 0, commission: 0 };
    const profit = stats.revenue - stats.commission;
    table.innerHTML += `
      <tr>
        <td class="sno">${i + 1}</td>
        <td class="name">${displayName}</td>
        <td class="specialization">${d.specialization || "-"}</td>
        <td class="hospital">${d.hospital || "-"}</td>
        <td class="phone">${d.phone || "-"}</td>
        <td class="num profit">₹${formatMoney(profit)}</td>
        <td class="num share">₹${formatMoney(stats.commission)}</td>
        <td class="center">
          <div class="menu">
            <span class="menu-btn" onclick="toggleMenu(this)">⋮</span>
            <div class="menu-list">
              <div onclick="openEdit(${d.id})">Edit</div>
              <div class="danger" onclick="deleteDoctor(${d.id})">Delete</div>
            </div>
          </div>
        </td>
      </tr>
    `;
  });
  applySearch();
}

function loadDoctors() {
  apiList("doctors?size=1000")
    .then(doctorData => {
      doctors = Array.isArray(doctorData) ? doctorData : [];
      renderDoctors();
    })
    .catch(err => {
      console.error("Error loading doctors", err);
      table.innerHTML = `
        <tr>
          <td colspan="8" class="empty-cell">
            Failed to load doctors
          </td>
        </tr>
      `;
    });
}

function openEdit(id) {
  closeAllMenus();
  apiFetchJson(`doctors/${id}`)
    .then(doctor => {
      editDoctorId = id;
      editName.value = doctor.name || "";
      editDisplayName.value = doctor.displayName || doctor.name || "";
      editSpecialization.value = doctor.specialization || "";
      editPhone.value = doctor.phone || "";
      editHospital.value = doctor.hospital || "";
      editCommissionRate.value =
        doctor.commissionPercentage == null ? "" : doctor.commissionPercentage;
      editModal.style.display = "flex";
    })
    .catch(() => {
      alert("Doctor not found");
    });
}

function closeEditModal() {
  editDoctorId = null;
  editForm.reset();
  editModal.style.display = "none";
}

function deleteDoctor(id) {
  closeAllMenus();
  if (!confirm("Delete doctor permanently?")) return;

  fetch(apiUrl(`doctors/${id}`), {
    method: "DELETE"
  })
  .then(res => {
    if (!res.ok) {
      return res.text().then(text => {
        throw new Error(text || "Failed to delete doctor");
      });
    }
    return res;
  })
  .then(() => loadDoctors())
  .catch(err => {
    console.error("Error deleting doctor", err);
    alert(err.message || "Error deleting doctor");
  });
}

editForm.addEventListener("submit", function (e) {
  e.preventDefault();
  if (editDoctorId == null) return;

  const doctor = {
    name: editName.value.trim(),
    displayName: editDisplayName.value.trim(),
    specialization: editSpecialization.value.trim(),
    phone: editPhone.value.trim(),
    hospital: editHospital.value.trim(),
    commissionPercentage: null,
    isActive: true
  };
  if (!doctor.displayName) {
    doctor.displayName = doctor.name;
  }
  const commissionRateRaw = editCommissionRate.value.trim();
  const commissionRate =
    commissionRateRaw === "" ? null : Number(commissionRateRaw);
  if (commissionRate !== null && Number.isFinite(commissionRate)) {
    doctor.commissionPercentage = commissionRate;
  }

  fetch(apiUrl(`doctors/${editDoctorId}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(doctor)
  })
  .then(res => {
    if (!res.ok) {
      throw new Error("Failed to save doctor");
    }
  })
  .then(() => {
    closeEditModal();
    loadDoctors();
  })
  .catch(err => {
    console.error("Error saving doctor", err);
    alert(err.message || "Error saving doctor");
  });
});

cancelEdit.addEventListener("click", closeEditModal);
editModal.addEventListener("click", function (e) {
  if (e.target === editModal) closeEditModal();
});
document.addEventListener("click", function (e) {
  if (!e.target.closest(".menu")) closeAllMenus();
});
searchInput.addEventListener("keyup", applySearch);

loadDoctors();
