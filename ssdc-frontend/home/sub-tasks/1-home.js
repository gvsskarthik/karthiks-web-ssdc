function setText(id, value){
  const el = document.getElementById(id);
  if (!el) {
    return;
  }
  el.textContent = value == null ? "0" : String(value);
}

function updateDateTime(){
  const el = document.getElementById("dashboard-datetime");
  if (!el) {
    return;
  }
  const now = new Date();
  el.textContent = now.toLocaleString();
}

function loadDashboardStats(){
  fetch(API_BASE_URL + "/dashboard/stats")
    .then(res => res.json())
    .then(stats => {
      setText("dash-today", stats?.todayTests);
      setText("dash-week", stats?.weekTests);
      setText("dash-month", stats?.monthTests);
      setText("dash-year", stats?.yearTests);
      setText("dash-pending", stats?.pendingPatients);
      setText("dash-completed", stats?.completedPatients);
    })
    .catch(() => {
      // keep defaults
    });
}

updateDateTime();
setInterval(updateDateTime, 1000);
loadDashboardStats();

