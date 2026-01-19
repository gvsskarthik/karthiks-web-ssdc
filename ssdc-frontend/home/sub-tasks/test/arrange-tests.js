fetch(API_BASE_URL + "/tests")
  .then(r => r.json())
  .then(tests => render(Array.isArray(tests) ? tests : []));

function render(list){
  const c = document.getElementById("container");
  c.innerHTML = "";

  if (!list.length) {
    c.innerHTML = `<div class="row">No tests found.</div>`;
    return;
  }

  const ordered = [...list].sort((a, b) => {
    const left = Number(a && a.id) || 0;
    const right = Number(b && b.id) || 0;
    return left - right;
  });

  ordered.forEach(test => {
    if (!test || test.id == null) {
      return;
    }
    const row = document.createElement("div");
    row.className = "row";
    const shortcut = test.shortcut ? ` (${test.shortcut})` : "";
    row.innerHTML = `
      <span class="title">#${test.id}</span>
      <span>${test.testName || ""}${shortcut}</span>
    `;
    c.appendChild(row);
  });
}
