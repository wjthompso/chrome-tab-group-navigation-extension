const GROUP_COLOR_MAP = {
  grey: "#9aa0a6",
  blue: "#1a73e8",
  red: "#d93025",
  yellow: "#f9ab00",
  green: "#188038",
  pink: "#d01884",
  purple: "#9334e6",
  cyan: "#007b83",
  orange: "#fa903e",
};

const listEl = document.getElementById("tab-group-nav-group-list");
const emptyEl = document.getElementById("tab-group-nav-empty-state");
const errorEl = document.getElementById("tab-group-nav-error-state");

function showError(message) {
  errorEl.hidden = false;
  errorEl.textContent = message;
  listEl.replaceChildren();
  emptyEl.hidden = true;
}

function swatchForColor(colorName) {
  const swatch = document.createElement("span");
  swatch.className = "tab-group-nav-color-swatch";
  swatch.style.background = GROUP_COLOR_MAP[colorName] ?? GROUP_COLOR_MAP.grey;
  swatch.setAttribute("aria-hidden", "true");
  return swatch;
}

async function focusGroup(groupId) {
  const tabs = await chrome.tabs.query({ groupId });
  if (tabs.length === 0) return;
  const target = tabs.find((t) => t.active) ?? tabs[0];
  await chrome.tabs.update(target.id, { active: true });
  if (target.windowId != null) {
    await chrome.windows.update(target.windowId, { focused: true });
  }
}

function renderGroups(groups) {
  errorEl.hidden = true;
  listEl.replaceChildren();

  if (groups.length === 0) {
    emptyEl.hidden = false;
    return;
  }

  emptyEl.hidden = true;
  for (const group of withTabs) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.id = `tab-group-nav-group-${group.id}`;
    button.className = "tab-group-nav-group-button";
    const label = document.createElement("span");
    label.className = "tab-group-nav-group-label";
    label.textContent = group.title?.trim() || "Untitled group";
    button.append(swatchForColor(group.color), label);

    button.addEventListener("click", () => {
      void focusGroup(group.id).then(() => window.close());
    });

    item.append(button);
    listEl.append(item);
  }
}

async function loadGroups() {
  try {
    const groups = await chrome.tabGroups.query({});
    renderGroups(groups);
  } catch (err) {
    showError(err instanceof Error ? err.message : "Could not load tab groups.");
  }
}

void loadGroups();
