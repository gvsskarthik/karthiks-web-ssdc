const title = document.getElementById("title");
const groupName = document.getElementById("groupName");
const shortcut = document.getElementById("shortcut");
const category = document.getElementById("category");
const cost = document.getElementById("cost");
const active = document.getElementById("active");
const showGroupName = document.getElementById("showGroupName");
const slotList = document.getElementById("slotList");
const addTestBtn = document.getElementById("addTestBtn");
const addGroupBtn = document.getElementById("addGroupBtn");
const status = document.getElementById("status");
const saveBtn = document.getElementById("saveBtn");
const cancelBtn = document.getElementById("cancelBtn");

const params = new URLSearchParams(location.search);
const editId = params.get("edit");

let tests = [];
let testMap = new Map();
let groups = [];
let groupMap = new Map();
let slots = [];
let slotCounter = 0;
let groupSlots = [];
let groupSlotCounter = 0;

addTestBtn.addEventListener("click", () => addSlot());
addGroupBtn.addEventListener("click", () => addGroupSlot());
saveBtn.addEventListener("click", () => saveGroup());
if (cancelBtn) {
  cancelBtn.addEventListener("click", () => {
    location.href = "../5-tests.html";
  });
}

function clearNode(node) { window.ssdcDom.clear(node); }

function setStatus(message, type){
  status.textContent = message || "";
  status.className = "message" + (type ? " " + type : "");
}

function normalizeId(value){
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function getSelectedIds(excludeSlotId){
  return new Set(
    slots
      .filter(slot => Number.isFinite(slot.testId) && slot.id !== excludeSlotId)
      .map(slot => slot.testId)
  );
}

function getSelectedGroupIds(excludeSlotId){
  return new Set(
    groupSlots
      .filter(slot => Number.isFinite(slot.groupId) && slot.id !== excludeSlotId)
      .map(slot => slot.groupId)
  );
}

function normalizeQuery(value){
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseReportLayout(value){
  if (!value) {
    return null;
  }
  if (typeof value === "object") {
    return value;
  }
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (err) {
      return null;
    }
  }
  return null;
}

function formatValue(value, fallback){
  if (value === null || value === undefined || value === "") {
    return fallback || "—";
  }
  return String(value);
}

function formatCost(value){
  const num = Number(value);
  return Number.isFinite(num) ? `₹${num}` : "—";
}

function getParamNormals(param){
  if (!param) return "";
  if (Array.isArray(param.normalRanges) && param.normalRanges.length) {
    return param.normalRanges
      .map(r => (r && r.textValue ? String(r.textValue) : ""))
      .filter(Boolean)
      .join(" | ");
  }
  if (param.normalText) {
    return String(param.normalText);
  }
  return "";
}

function createDiv(className, text){
  const node = document.createElement("div");
  if (className) node.className = String(className);
  if (text != null) node.textContent = String(text);
  return node;
}

function createDetailItem(label, value){
  const wrap = document.createElement("div");
  wrap.appendChild(createDiv("detail-label", label));
  wrap.appendChild(createDiv("detail-value", value));
  return wrap;
}

function buildParamItem(title, meta, normalText){
  const item = document.createElement("div");
  item.className = "param-item";
  item.appendChild(createDiv("param-title", title));
  if (meta) {
    item.appendChild(createDiv("param-meta", meta));
  }
  if (normalText) {
    item.appendChild(createDiv("param-normal", normalText));
  }
  return item;
}

function buildParamList(test){
  const list = document.createElement("div");
  list.className = "param-list";

  const params = Array.isArray(test?.parameters) ? test.parameters : [];
  if (params.length) {
    params.forEach((param, index) => {
      const name = param?.name || `Parameter ${index + 1}`;
      const unit = param?.unit || "—";
      const type = param?.valueType || "—";
      const normals = getParamNormals(param);
      const normalText = normals ? `Normal: ${normals}` : "";
      list.appendChild(
        buildParamItem(name, `Unit: ${unit} · Type: ${type}`, normalText)
      );
    });
    return list;
  }

  const normalValues = Array.isArray(test?.normalValues) ? test.normalValues : [];
  const normals = normalValues
    .map(n => (n && n.normalValue ? String(n.normalValue) : ""))
    .filter(Boolean)
    .join(" | ");

  if (!normals) {
    list.appendChild(buildParamItem("No parameters", "", ""));
    return list;
  }

  list.appendChild(buildParamItem("Normal Values", "", normals));
  return list;
}

function renderDetails(slot){
  const detail = slot.detail;
  const test = testMap.get(slot.testId);
  clearNode(detail);
  if (!test) {
    detail.appendChild(createDiv("muted", "Select a test to see details."));
    return;
  }

  const shortcutText = test.shortcut || "—";
  const categoryText = test.category || "—";
  const activeText = test.active ? "Active" : "Inactive";

  const grid = document.createElement("div");
  grid.className = "detail-grid";
  grid.appendChild(createDetailItem("Test Name", formatValue(test.testName, "—")));
  grid.appendChild(createDetailItem("Shortcut", shortcutText));
  grid.appendChild(createDetailItem("Category", categoryText));
  grid.appendChild(createDetailItem("Cost", formatCost(test.cost)));
  grid.appendChild(createDetailItem("Status", activeText));
  detail.appendChild(grid);
  detail.appendChild(buildParamList(test));
}

function setSlotInputFromSelection(slot){
  const test = testMap.get(slot.testId);
  if (!test) {
    slot.searchInput.value = "";
    return;
  }
  const shortcutText = test.shortcut ? ` (${test.shortcut})` : "";
  slot.searchInput.value = `${test.testName || ""}${shortcutText}`.trim();
}

function rankSuggestion(test, query){
  const name = normalizeQuery(test.testName);
  const shortcut = normalizeQuery(test.shortcut);
  if (shortcut && shortcut.startsWith(query)) {
    return 0;
  }
  if (name.startsWith(query)) {
    return 1;
  }
  if (shortcut && shortcut.includes(query)) {
    return 2;
  }
  return 3;
}

function setActiveSuggestion(slot, index){
  if (!slot.suggestionItems.length) {
    slot.activeSuggestionIndex = -1;
    return;
  }

  if (index < 0) {
    slot.activeSuggestionIndex = slot.suggestionItems.length - 1;
  } else if (index >= slot.suggestionItems.length) {
    slot.activeSuggestionIndex = 0;
  } else {
    slot.activeSuggestionIndex = index;
  }

  const items = slot.suggestions.querySelectorAll(".suggestion");
  items.forEach((item, idx) => {
    item.classList.toggle("active", idx === slot.activeSuggestionIndex);
  });
}

function updateSlotSuggestions(slot){
  const query = normalizeQuery(slot.searchInput.value);

  if (!query) {
    slot.suggestionItems = [];
    slot.activeSuggestionIndex = -1;
    clearNode(slot.suggestions);
    slot.suggestions.classList.add("hidden");
    slot.noResult.classList.add("hidden");
    return;
  }

  const selectedElsewhere = getSelectedIds(slot.id);

  const matches = tests
    .filter(test => {
      const id = Number(test?.id);
      if (!Number.isFinite(id)) {
        return false;
      }
      if (selectedElsewhere.has(id)) {
        return false;
      }
      const name = normalizeQuery(test.testName);
      const shortcut = normalizeQuery(test.shortcut);
      return name.includes(query) || shortcut.includes(query);
    })
    .map(test => ({
      id: Number(test.id),
      name: test.testName || "",
      shortcut: test.shortcut || "",
      cost: Number(test.cost) || 0,
      rank: rankSuggestion(test, query)
    }))
    .sort((a, b) => {
      const rankDiff = a.rank - b.rank;
      if (rankDiff !== 0) {
        return rankDiff;
      }
      return (a.id || 0) - (b.id || 0);
    })
    .slice(0, 8);

  slot.suggestionItems = matches;
  slot.activeSuggestionIndex = matches.length ? 0 : -1;
  clearNode(slot.suggestions);

  matches.forEach((item, index) => {
    const shortcut = item.shortcut ? String(item.shortcut) : "";
    const meta = shortcut || "\u00A0";

    const row = document.createElement("div");
    row.className = "suggestion" + (index === slot.activeSuggestionIndex ? " active" : "");
    row.dataset.id = String(item.id);

    const main = document.createElement("div");
    main.className = "suggestion-main";
    main.appendChild(createDiv("suggestion-name", item.name || ""));
    main.appendChild(createDiv("suggestion-meta", meta));

    row.appendChild(main);
    row.appendChild(createDiv("suggestion-cost", `₹${item.cost}`));
    slot.suggestions.appendChild(row);
  });

  slot.suggestions.classList.toggle("hidden", !matches.length);
  slot.noResult.classList.toggle("hidden", matches.length > 0);
}

function chooseSlotTest(slot, testId){
  const id = Number(testId);
  if (!Number.isFinite(id)) {
    return;
  }

  const selectedElsewhere = getSelectedIds(slot.id);
  if (selectedElsewhere.has(id)) {
    setStatus("This test is already selected in another slot.", "error");
    return;
  }

  slot.testId = id;
  setSlotInputFromSelection(slot);
  renderDetails(slot);
  slots.forEach(other => {
    if (other.suggestions && !other.suggestions.classList.contains("hidden")) {
      updateSlotSuggestions(other);
    }
  });
}

function handleSlotSuggestionClick(slot, event){
  const item = event.target.closest(".suggestion");
  if (!item) {
    return;
  }
  chooseSlotTest(slot, item.dataset.id);
  slot.suggestions.classList.add("hidden");
  slot.noResult.classList.add("hidden");
}

function handleSlotSuggestionKeys(slot, event){
  if (event.key === "ArrowDown") {
    if (slot.suggestionItems.length) {
      event.preventDefault();
      setActiveSuggestion(slot, slot.activeSuggestionIndex + 1);
    }
    return;
  }

  if (event.key === "ArrowUp") {
    if (slot.suggestionItems.length) {
      event.preventDefault();
      setActiveSuggestion(slot, slot.activeSuggestionIndex - 1);
    }
    return;
  }

  if (event.key === "Enter") {
    if (slot.suggestionItems.length) {
      event.preventDefault();
      const active = slot.suggestionItems[slot.activeSuggestionIndex] || slot.suggestionItems[0];
      if (active) {
        chooseSlotTest(slot, active.id);
      }
      slot.suggestions.classList.add("hidden");
      slot.noResult.classList.add("hidden");
    }
    return;
  }

  if (event.key === "Escape") {
    slot.suggestions.classList.add("hidden");
    slot.noResult.classList.add("hidden");
  }
}

function addSlot(testId){
  const slotId = `slot-${slotCounter++}`;
  const wrapper = document.createElement("div");
  wrapper.className = "slot-card";

  const header = document.createElement("div");
  header.className = "slot-header";
  const titleEl = document.createElement("h4");
  titleEl.className = "slot-title";
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn link";
  removeBtn.textContent = "Remove";
  header.appendChild(titleEl);
  header.appendChild(removeBtn);

  const grid = document.createElement("div");
  grid.className = "grid-2";

  const left = document.createElement("div");
  const label = document.createElement("label");
  label.textContent = "Select Test";
  const searchWrap = document.createElement("div");
  searchWrap.className = "search-wrap";
  const searchInput = document.createElement("input");
  searchInput.className = "test-search";
  searchInput.placeholder = "Search test...";
  searchInput.autocomplete = "off";
  const suggestions = document.createElement("div");
  suggestions.className = "suggestions hidden";
  searchWrap.appendChild(searchInput);
  searchWrap.appendChild(suggestions);
  const noResult = document.createElement("div");
  noResult.className = "no-result hidden";
  noResult.textContent = "❌ No test available";
  left.appendChild(label);
  left.appendChild(searchWrap);
  left.appendChild(noResult);

  const right = document.createElement("div");
  right.className = "inline";
  const dummyCheck = document.createElement("input");
  dummyCheck.type = "checkbox";
  dummyCheck.disabled = true;
  const dummyLabel = document.createElement("label");
  dummyLabel.className = "label-inline";
  dummyLabel.textContent = "Details (read-only)";
  right.appendChild(dummyCheck);
  right.appendChild(dummyLabel);

  grid.appendChild(left);
  grid.appendChild(right);

  const detail = document.createElement("div");
  detail.className = "detail-card";

  wrapper.appendChild(header);
  wrapper.appendChild(grid);
  wrapper.appendChild(detail);

  const slot = {
    id: slotId,
    testId: normalizeId(testId),
    wrapper,
    searchInput,
    suggestions,
    noResult,
    suggestionItems: [],
    activeSuggestionIndex: -1,
    detail,
    titleEl
  };
  slots.push(slot);

  searchInput.addEventListener("input", () => updateSlotSuggestions(slot));
  searchInput.addEventListener("keydown", event => handleSlotSuggestionKeys(slot, event));
  suggestions.addEventListener("click", event => handleSlotSuggestionClick(slot, event));
  searchInput.addEventListener("focus", () => updateSlotSuggestions(slot));
  searchInput.addEventListener("blur", () => {
    setTimeout(() => {
      slot.suggestions.classList.add("hidden");
      slot.noResult.classList.add("hidden");
      setSlotInputFromSelection(slot);
    }, 120);
  });

  removeBtn.addEventListener("click", () => {
    slots = slots.filter(item => item.id !== slot.id);
    wrapper.remove();
    slots.forEach(other => updateSlotSuggestions(other));
    refreshSlotTitles();
  });

  slotList.appendChild(wrapper);
  setSlotInputFromSelection(slot);
  renderDetails(slot);
  refreshSlotTitles();
}

function resolveGroupCost(group){
  const cost = Number(group?.cost);
  if (Number.isFinite(cost)) {
    return cost;
  }
  let sum = 0;
  (group?.testIds || []).forEach(id => {
    const test = testMap.get(Number(id));
    sum += Number(test?.cost) || 0;
  });
  return Math.round(sum * 100) / 100;
}

function setGroupSlotInputFromSelection(slot){
  const group = groupMap.get(slot.groupId);
  if (!group) {
    const fallbackName = String(slot.fallbackGroupName || "").trim();
    const fallbackShortcut = String(slot.fallbackShortcut || "").trim();
    if (!fallbackName) {
      slot.searchInput.value = "";
      return;
    }
    const shortcutText = fallbackShortcut ? ` (${fallbackShortcut})` : "";
    slot.searchInput.value = `${fallbackName}${shortcutText}`.trim();
    return;
  }
  const shortcutText = group.shortcut ? ` (${group.shortcut})` : "";
  slot.searchInput.value = `${group.groupName || ""}${shortcutText}`.trim();
}

function renderGroupDetails(slot){
  const detail = slot.detail;
  const group = groupMap.get(slot.groupId);
  clearNode(detail);
  if (!group) {
    const fallbackName = String(slot.fallbackGroupName || "").trim();
    const fallbackShortcut = String(slot.fallbackShortcut || "").trim();
    if (!fallbackName) {
      detail.appendChild(createDiv("muted", "Select a group to see details."));
      return;
    }
    const shortcutText = fallbackShortcut || "—";
    const grid = document.createElement("div");
    grid.className = "detail-grid";
    grid.appendChild(createDetailItem("Group Name", formatValue(fallbackName, "—")));
    grid.appendChild(createDetailItem("Shortcut", shortcutText));
    grid.appendChild(createDetailItem("Status", "Unavailable"));
    detail.appendChild(grid);
    return;
  }

  const shortcutText = group.shortcut || "—";
  const categoryText = group.category || "—";
  const activeText = group.active === false ? "Inactive" : "Active";
  const testIds = Array.isArray(group.testIds) ? group.testIds : [];
  const testLabels = testIds
    .map(id => {
      const test = testMap.get(Number(id));
      if (!test) {
        return "";
      }
      const shortText = test.shortcut ? ` (${test.shortcut})` : "";
      return `${test.testName || ""}${shortText}`.trim();
    })
    .filter(Boolean);

  const previewLimit = 10;
  const preview = testLabels.slice(0, previewLimit).join(", ");
  const remaining = testLabels.length - previewLimit;
  const previewText = preview
    ? preview + (remaining > 0 ? ` and ${remaining} more` : "")
    : "—";

  const grid = document.createElement("div");
  grid.className = "detail-grid";
  grid.appendChild(createDetailItem("Group Name", formatValue(group.groupName, "—")));
  grid.appendChild(createDetailItem("Shortcut", shortcutText));
  grid.appendChild(createDetailItem("Category", categoryText));
  grid.appendChild(createDetailItem("Cost", formatCost(resolveGroupCost(group))));
  grid.appendChild(createDetailItem("Status", activeText));
  grid.appendChild(createDetailItem("Tests", String(testIds.length)));
  detail.appendChild(grid);

  const paramList = document.createElement("div");
  paramList.className = "param-list";
  paramList.appendChild(buildParamItem("Includes", "", previewText));
  detail.appendChild(paramList);
}

function rankGroupSuggestion(group, query){
  const name = normalizeQuery(group.groupName);
  const shortcut = normalizeQuery(group.shortcut);
  if (shortcut && shortcut.startsWith(query)) {
    return 0;
  }
  if (name.startsWith(query)) {
    return 1;
  }
  if (shortcut && shortcut.includes(query)) {
    return 2;
  }
  return 3;
}

function updateGroupSlotSuggestions(slot){
  const query = normalizeQuery(slot.searchInput.value);

  if (!query) {
    slot.suggestionItems = [];
    slot.activeSuggestionIndex = -1;
    clearNode(slot.suggestions);
    slot.suggestions.classList.add("hidden");
    slot.noResult.classList.add("hidden");
    return;
  }

  const selectedElsewhere = getSelectedGroupIds(slot.id);

  const matches = groups
    .filter(group => {
      const id = Number(group?.id);
      if (!Number.isFinite(id)) {
        return false;
      }
      if (selectedElsewhere.has(id)) {
        return false;
      }
      const name = normalizeQuery(group.groupName);
      const shortcut = normalizeQuery(group.shortcut);
      return name.includes(query) || shortcut.includes(query);
    })
    .map(group => ({
      id: Number(group.id),
      name: group.groupName || "",
      shortcut: group.shortcut || "",
      cost: resolveGroupCost(group),
      rank: rankGroupSuggestion(group, query)
    }))
    .sort((a, b) => {
      const rankDiff = a.rank - b.rank;
      if (rankDiff !== 0) {
        return rankDiff;
      }
      return (a.id || 0) - (b.id || 0);
    })
    .slice(0, 8);

  slot.suggestionItems = matches;
  slot.activeSuggestionIndex = matches.length ? 0 : -1;
  clearNode(slot.suggestions);

  matches.forEach((item, index) => {
    const shortcut = item.shortcut ? String(item.shortcut) : "";
    const meta = shortcut || "\u00A0";

    const row = document.createElement("div");
    row.className = "suggestion" + (index === slot.activeSuggestionIndex ? " active" : "");
    row.dataset.id = String(item.id);

    const main = document.createElement("div");
    main.className = "suggestion-main";
    main.appendChild(createDiv("suggestion-name", item.name || ""));
    main.appendChild(createDiv("suggestion-meta", meta));

    row.appendChild(main);
    row.appendChild(createDiv("suggestion-cost", `₹${Number(item.cost) || 0}`));
    slot.suggestions.appendChild(row);
  });

  slot.suggestions.classList.toggle("hidden", !matches.length);
  slot.noResult.classList.toggle("hidden", matches.length > 0);
}

function chooseSlotGroup(slot, groupId){
  const id = Number(groupId);
  if (!Number.isFinite(id)) {
    return;
  }

  const selectedElsewhere = getSelectedGroupIds(slot.id);
  if (selectedElsewhere.has(id)) {
    setStatus("This group is already selected in another slot.", "error");
    return;
  }

  slot.groupId = id;
  setGroupSlotInputFromSelection(slot);
  renderGroupDetails(slot);
  groupSlots.forEach(other => {
    if (other.suggestions && !other.suggestions.classList.contains("hidden")) {
      updateGroupSlotSuggestions(other);
    }
  });
}

function handleGroupSlotSuggestionClick(slot, event){
  const item = event.target.closest(".suggestion");
  if (!item) {
    return;
  }
  chooseSlotGroup(slot, item.dataset.id);
  slot.suggestions.classList.add("hidden");
  slot.noResult.classList.add("hidden");
}

function handleGroupSlotSuggestionKeys(slot, event){
  if (event.key === "ArrowDown") {
    if (slot.suggestionItems.length) {
      event.preventDefault();
      setActiveSuggestion(slot, slot.activeSuggestionIndex + 1);
    }
    return;
  }

  if (event.key === "ArrowUp") {
    if (slot.suggestionItems.length) {
      event.preventDefault();
      setActiveSuggestion(slot, slot.activeSuggestionIndex - 1);
    }
    return;
  }

  if (event.key === "Enter") {
    if (slot.suggestionItems.length) {
      event.preventDefault();
      const active = slot.suggestionItems[slot.activeSuggestionIndex] || slot.suggestionItems[0];
      if (active) {
        chooseSlotGroup(slot, active.id);
      }
      slot.suggestions.classList.add("hidden");
      slot.noResult.classList.add("hidden");
    }
    return;
  }

  if (event.key === "Escape") {
    slot.suggestions.classList.add("hidden");
    slot.noResult.classList.add("hidden");
  }
}

function addGroupSlot(groupId, showNameChecked = true, fallback){
  const slotId = `group-slot-${groupSlotCounter++}`;
  const wrapper = document.createElement("div");
  wrapper.className = "slot-card";

  const header = document.createElement("div");
  header.className = "slot-header";
  const titleEl = document.createElement("h4");
  titleEl.className = "slot-title";
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn link";
  removeBtn.textContent = "Remove";
  header.appendChild(titleEl);
  header.appendChild(removeBtn);

  const grid = document.createElement("div");
  grid.className = "grid-2";

  const left = document.createElement("div");
  const label = document.createElement("label");
  label.textContent = "Select Group";
  const searchWrap = document.createElement("div");
  searchWrap.className = "search-wrap";
  const searchInput = document.createElement("input");
  searchInput.className = "group-search";
  searchInput.placeholder = "Search group...";
  searchInput.autocomplete = "off";
  const suggestions = document.createElement("div");
  suggestions.className = "suggestions hidden";
  searchWrap.appendChild(searchInput);
  searchWrap.appendChild(suggestions);
  const noResult = document.createElement("div");
  noResult.className = "no-result hidden";
  noResult.textContent = "❌ No group available";
  left.appendChild(label);
  left.appendChild(searchWrap);
  left.appendChild(noResult);

  const right = document.createElement("div");
  right.className = "inline";
  const showNameInput = document.createElement("input");
  showNameInput.className = "show-name";
  showNameInput.type = "checkbox";
  showNameInput.checked = true;
  const showNameLabel = document.createElement("label");
  showNameLabel.className = "label-inline";
  showNameLabel.textContent = "Show Name";
  const dummyCheck = document.createElement("input");
  dummyCheck.type = "checkbox";
  dummyCheck.disabled = true;
  const dummyLabel = document.createElement("label");
  dummyLabel.className = "label-inline";
  dummyLabel.textContent = "Details (read-only)";
  right.appendChild(showNameInput);
  right.appendChild(showNameLabel);
  right.appendChild(dummyCheck);
  right.appendChild(dummyLabel);

  grid.appendChild(left);
  grid.appendChild(right);

  const detail = document.createElement("div");
  detail.className = "detail-card";

  wrapper.appendChild(header);
  wrapper.appendChild(grid);
  wrapper.appendChild(detail);

  const slot = {
    id: slotId,
    groupId: normalizeId(groupId),
    fallbackGroupName: String(fallback?.groupName || ""),
    fallbackShortcut: String(fallback?.shortcut || ""),
    showNameInput,
    wrapper,
    searchInput,
    suggestions,
    noResult,
    suggestionItems: [],
    activeSuggestionIndex: -1,
    detail,
    titleEl
  };
  groupSlots.push(slot);
  if (slot.showNameInput) {
    slot.showNameInput.checked = showNameChecked !== false;
  }

  searchInput.addEventListener("input", () => updateGroupSlotSuggestions(slot));
  searchInput.addEventListener("keydown", event => handleGroupSlotSuggestionKeys(slot, event));
  suggestions.addEventListener("click", event => handleGroupSlotSuggestionClick(slot, event));
  searchInput.addEventListener("focus", () => updateGroupSlotSuggestions(slot));
  searchInput.addEventListener("blur", () => {
    setTimeout(() => {
      slot.suggestions.classList.add("hidden");
      slot.noResult.classList.add("hidden");
      setGroupSlotInputFromSelection(slot);
    }, 120);
  });

  removeBtn.addEventListener("click", () => {
    groupSlots = groupSlots.filter(item => item.id !== slot.id);
    wrapper.remove();
    groupSlots.forEach(other => updateGroupSlotSuggestions(other));
    refreshSlotTitles();
  });

  slotList.appendChild(wrapper);
  setGroupSlotInputFromSelection(slot);
  renderGroupDetails(slot);
  refreshSlotTitles();
}

function refreshSlotTitles(){
  slots.forEach((slot, index) => {
    slot.titleEl.textContent = `Test ${index + 1}`;
  });
  groupSlots.forEach((slot, index) => {
    slot.titleEl.textContent = `Group ${index + 1}`;
  });
}

async function loadData(){
  setStatus("Loading tests & groups...");
  addGroupBtn.disabled = true;
  try {
    const [testRes, groupRes] = await Promise.all([
      fetch(API_BASE_URL + "/tests/active"),
      fetch(API_BASE_URL + "/groups")
    ]);

    if (!testRes.ok) {
      setStatus("Failed to load tests.", "error");
      return;
    }
    tests = await testRes.json();
    tests = Array.isArray(tests) ? tests : [];
    testMap = new Map();
    tests.forEach(test => {
      const id = Number(test?.id);
      if (Number.isFinite(id)) {
        testMap.set(id, test);
      }
    });

    groups = [];
    groupMap = new Map();

    if (groupRes.ok) {
      const groupList = await groupRes.json();
      const rawGroups = Array.isArray(groupList) ? groupList : [];
      const normalizedAll = rawGroups
        .map(group => {
          const id = Number(group?.id);
          if (!Number.isFinite(id)) {
            return null;
          }
          const ids = Array.isArray(group.testIds) ? group.testIds : [];
          const testIds = ids
            .map(testId => Number(testId))
            .filter(testId => Number.isFinite(testId) && testMap.has(testId));
          return { ...group, id, testIds };
        })
        .filter(group => group && Array.isArray(group.testIds) && group.testIds.length);

      groupMap = new Map(normalizedAll.map(group => [Number(group.id), group]));
      groups = normalizedAll.filter(group => group && group.active !== false);
      addGroupBtn.disabled = groups.length === 0;
    } else {
      setStatus("Groups are not available right now. You can still add tests.", "error");
    }

    if (editId) {
      const editRes = await fetch(API_BASE_URL + "/groups/" + editId);
      if (editRes.ok) {
        const group = await editRes.json();
        title.textContent = "Edit Group";
        groupName.value = group.groupName || "";
        shortcut.value = group.shortcut || "";
        cost.value = group.cost == null ? "" : group.cost;
        if (group.category) {
          category.value = group.category;
        }
        if (typeof group.active === "boolean") {
          active.checked = group.active;
        }
        if (typeof group.showGroupName === "boolean") {
          showGroupName.checked = group.showGroupName;
        } else {
          showGroupName.checked = true;
        }
        const layout = parseReportLayout(group.reportLayout);
        const ids = Array.isArray(group.testIds) ? group.testIds : [];
        const used = new Set();

        const direct = Array.isArray(layout?.directTestIds) ? layout.directTestIds : [];
        direct
          .map(id => Number(id))
          .filter(id => Number.isFinite(id) && testMap.has(id))
          .forEach(id => {
            used.add(id);
            addSlot(id);
          });

        const subs = Array.isArray(layout?.subGroups) ? layout.subGroups : [];
        subs.forEach(sub => {
          const groupId = Number(sub?.groupId);
          if (!Number.isFinite(groupId)) {
            return;
          }
          const showName = sub?.showName !== false;
          addGroupSlot(groupId, showName, {
            groupName: sub?.groupName,
            shortcut: sub?.shortcut
          });

          const subTestIds = Array.isArray(sub?.testIds) ? sub.testIds : [];
          subTestIds
            .map(id => Number(id))
            .filter(id => Number.isFinite(id))
            .forEach(id => used.add(id));
        });

        ids
          .map(id => Number(id))
          .filter(id => Number.isFinite(id) && testMap.has(id) && !used.has(id))
          .forEach(id => addSlot(id));
      } else {
        setStatus("Failed to load group.", "error");
      }
    }

    if (!slots.length && !groupSlots.length) {
      addSlot();
    }

    if (status.classList.contains("error")) {
      return;
    }
    setStatus("");
  } catch (err) {
    console.error(err);
    setStatus("Failed to load data. Check backend connection.", "error");
  }
}

async function saveGroup(){
  const nameValue = groupName.value.trim();
  const shortcutValue = shortcut.value.trim();
  const categoryValue = category.value.trim();
  const costValue = cost.value.trim();
  let costNumber = null;

  if (!nameValue) {
    setStatus("Group name is required.", "error");
    groupName.focus();
    return;
  }
  if (!shortcutValue) {
    setStatus("Shortcut is required.", "error");
    shortcut.focus();
    return;
  }
  if (costValue !== "") {
    costNumber = Number(costValue);
    if (Number.isNaN(costNumber)) {
      setStatus("Price must be a number.", "error");
      cost.focus();
      return;
    }
  }

  const directTestIds = slots
    .map(slot => slot.testId)
    .filter(id => Number.isFinite(id));

  const subgroupDefs = groupSlots
    .map(slot => ({
      groupId: slot.groupId,
      showName: slot.showNameInput ? slot.showNameInput.checked : true
    }))
    .filter(item => Number.isFinite(item.groupId));

  const seen = new Set();
  const normalizedDirectIds = [];
  directTestIds.forEach(id => {
    if (!seen.has(id)) {
      seen.add(id);
      normalizedDirectIds.push(id);
    }
  });

  const normalizedSubGroups = [];
  subgroupDefs.forEach(def => {
    const group = groupMap.get(def.groupId);
    const rawIds = Array.isArray(group?.testIds) ? group.testIds : [];
    const filtered = rawIds
      .map(id => Number(id))
      .filter(id => Number.isFinite(id) && !seen.has(id) && testMap.has(id));
    filtered.forEach(id => seen.add(id));

    if (!filtered.length) {
      return;
    }

    normalizedSubGroups.push({
      groupId: def.groupId,
      groupName: group?.groupName || "",
      shortcut: group?.shortcut || "",
      showName: def.showName !== false,
      testIds: filtered
    });
  });

  const finalTestIds = [
    ...normalizedDirectIds,
    ...normalizedSubGroups.flatMap(item => item.testIds)
  ];

  if (!finalTestIds.length) {
    setStatus("Select at least one test or group.", "error");
    return;
  }

	  const payload = {
	    groupName: nameValue,
	    shortcut: shortcutValue,
	    category: categoryValue || null,
	    cost: costNumber,
	    active: active.checked,
	    showGroupName: showGroupName ? showGroupName.checked : true,
	    testIds: finalTestIds,
	    reportLayout: {
	      version: 1,
	      directTestIds: normalizedDirectIds,
      subGroups: normalizedSubGroups
    }
  };

  setStatus("Saving...");
  saveBtn.disabled = true;

  try {
    const url = editId
      ? API_BASE_URL + "/groups/" + editId
      : API_BASE_URL + "/groups";
    const method = editId ? "PUT" : "POST";

    const res = await fetch(url, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      setStatus(errText || "Save failed.", "error");
      saveBtn.disabled = false;
      return;
    }

    setStatus("Saved successfully.");
    setTimeout(() => {
      window.location.href = "../5-tests.html";
    }, 600);
  } catch (err) {
    console.error(err);
    setStatus("Backend not running or network error.", "error");
  } finally {
    saveBtn.disabled = false;
  }
}

loadData();
