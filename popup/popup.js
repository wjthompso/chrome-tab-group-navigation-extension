import {
  buildOrderedGroups,
  chooseListedWindow,
  groupIdsOnTabs,
  groupsIncludingActive,
  neighborMoveIndex,
  resolveActiveGroupId,
} from "../lib/group-move.js";
import {
  coerceScenes,
  emptyScenes,
  SCENE_SLOT_COUNT,
  sceneSlotFromKeyEvent,
  sceneSummary,
} from "../lib/tab-scenes.js";
import {
  ACTIVE_GROUP_ID_BY_WINDOW,
  LAST_ACTIVE_TAB_ID_BY_GROUP,
  LAST_FOCUSED_WINDOW_ID,
  TAB_SCENES,
  coerceActiveGroupByWindow,
  coerceLastActiveMap,
} from "../lib/storage-keys.js";

const LOG = "[tab-group-nav]";

// Light solids, sampled from the menu the popup is styled after.
// Dark text stays readable on every one of them.
const GROUP_DOT_COLORS = {
  grey: "#d0d2d6",
  blue: "#89a9ed",
  red: "#d88379",
  yellow: "#f2d36b",
  green: "#81c995",
  pink: "#f0a3c8",
  purple: "#c9a6f5",
  cyan: "#7dced6",
  orange: "#f0b07a",
};

const NEUTRAL_DOT = "#bdbdbd";

const listEl = document.getElementById("tab-group-nav-group-list");
const emptyEl = document.getElementById("tab-group-nav-empty-state");
const statusEl = document.getElementById("status-message");
const mainEl = document.getElementById("tab-group-nav-popup-main");
const sceneListEl = document.getElementById("tab-group-nav-scene-list");

const UNGROUPED_STATUS = "The current tab isn’t in a group.";

let windowId = null;
let windowBlocked = false;
let loaded = false;
let ordered = [];
let highlightedId = null;
let currentGroupId = null;
let activeTabUngrouped = false;
let highlightInitialized = false;
let renaming = false;
let renameDraft = "";
let opDepth = 0;
let reloadChain = Promise.resolve();
let scenes = emptyScenes();

function setStatus(message) {
  statusEl.textContent = message;
}

function reportError(err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(LOG, err);
  setStatus(message);
}

function displayTitle(title) {
  const trimmed = typeof title === "string" ? title.trim() : "";
  return trimmed || "Unnamed group";
}

function tabCountLabel(count) {
  return count === 1 ? "1 tab" : `${count} tabs`;
}

function dotColor(color) {
  if (typeof color !== "string") return NEUTRAL_DOT;
  return GROUP_DOT_COLORS[color.toLowerCase()] ?? NEUTRAL_DOT;
}

function nearestGroupId(previous, previousId, next) {
  if (next.length === 0) return null;
  const oldIndex = previous.findIndex((group) => group.id === previousId);
  if (oldIndex < 0) return next[0].id;
  return next[Math.min(oldIndex, next.length - 1)].id;
}

function scrollHighlightedIntoView() {
  if (highlightedId == null) return;
  document.getElementById(`group-row-${highlightedId}`)?.scrollIntoView({ block: "nearest" });
}

function focusKeyboardSurface() {
  if (renaming) {
    const input = document.getElementById("group-rename-input");
    if (input && document.activeElement !== input) input.focus({ preventScroll: true });
    return;
  }
  if (listEl && !listEl.hidden && ordered.length > 0) {
    listEl.focus({ preventScroll: true });
    return;
  }
  mainEl?.focus({ preventScroll: true });
}

function renderRow(group) {
  const selected = group.id === highlightedId;
  const row = document.createElement("li");
  row.id = `group-row-${group.id}`;
  row.role = "option";
  row.tabIndex = -1;
  row.setAttribute("aria-selected", selected ? "true" : "false");
  row.style.setProperty("--group", dotColor(group.color));

  const name = document.createElement("span");
  name.id = `group-name-${group.id}`;
  if (renaming && selected) {
    const input = document.createElement("input");
    input.id = "group-rename-input";
    input.type = "text";
    input.value = renameDraft;
    input.autocomplete = "off";
    input.spellcheck = false;
    input.setAttribute("aria-label", "Group name");
    input.addEventListener("input", () => {
      renameDraft = input.value;
    });
    name.append(input);
  } else {
    const title = displayTitle(group.title);
    const titleEl = document.createElement("span");
    titleEl.id = `group-title-${group.id}`;
    titleEl.textContent = title;
    titleEl.title = title;
    name.append(titleEl);
    if (group.id === currentGroupId) {
      const current = document.createElement("span");
      current.id = `group-current-${group.id}`;
      current.textContent = "current";
      name.append(current);
    }
  }

  const count = document.createElement("span");
  count.id = `group-count-${group.id}`;
  count.textContent = tabCountLabel(group.length);

  const state = document.createElement("span");
  state.id = `group-state-${group.id}`;
  state.dataset.collapsed = group.collapsed ? "true" : "false";
  state.textContent = group.collapsed ? "collapsed" : "expanded";

  row.addEventListener("click", (event) => {
    if (event.target instanceof HTMLInputElement) return;
    if (group.id === highlightedId && !renaming) return;
    renaming = false;
    renameDraft = "";
    highlightedId = group.id;
    setStatus("");
    render();
  });

  row.append(name, count, state);
  return row;
}

function syncCurrentTabStatus() {
  if (!loaded || windowBlocked) return;
  const showing = statusEl.textContent;
  if (activeTabUngrouped) {
    if (showing === "" || showing === UNGROUPED_STATUS) setStatus(UNGROUPED_STATUS);
    return;
  }
  if (showing === UNGROUPED_STATUS) setStatus("");
}

function renderOpenGroup() {
  const el = document.getElementById("tab-group-nav-open-group");
  if (!el) return;
  if (!loaded || windowBlocked) {
    el.textContent = "";
    return;
  }
  if (activeTabUngrouped) {
    el.textContent = "Open tab is not in a group.";
    return;
  }
  const group = ordered.find((item) => item.id === currentGroupId);
  el.textContent = group ? `Open group: ${displayTitle(group.title)}` : "";
}

function render() {
  syncCurrentTabStatus();
  renderOpenGroup();
  listEl.replaceChildren();

  if (windowBlocked || ordered.length === 0) {
    listEl.hidden = true;
    listEl.removeAttribute("aria-activedescendant");
    emptyEl.hidden = !(loaded && !windowBlocked && ordered.length === 0);
    focusKeyboardSurface();
    return;
  }

  listEl.hidden = false;
  emptyEl.hidden = true;
  for (const group of ordered) listEl.append(renderRow(group));

  if (highlightedId == null) listEl.removeAttribute("aria-activedescendant");
  else listEl.setAttribute("aria-activedescendant", `group-row-${highlightedId}`);

  scrollHighlightedIntoView();
  focusKeyboardSurface();
}

async function readOr(task) {
  try {
    return { ok: true, value: await task() };
  } catch (err) {
    console.error(LOG, err);
    return { ok: false, value: null };
  }
}

function mergeGroups(groups, extras) {
  const byId = new Map(groups.map((group) => [group.id, group]));
  for (const group of extras) {
    if (!group || typeof group.id !== "number") continue;
    byId.set(group.id, group);
  }
  return [...byId.values()];
}

async function listedModel() {
  const windowsRead = await readOr(() => chrome.windows.getAll({
    populate: true,
    windowTypes: ["normal"],
  }));
  const stored = await chrome.storage.session.get([
    ACTIVE_GROUP_ID_BY_WINDOW,
    LAST_FOCUSED_WINDOW_ID,
  ]).catch((err) => {
    console.error(LOG, err);
    return {};
  });
  const preferredId = typeof stored?.[LAST_FOCUSED_WINDOW_ID] === "number"
    ? stored[LAST_FOCUSED_WINDOW_ID]
    : null;
  const win = chooseListedWindow(windowsRead.ok ? windowsRead.value : [], preferredId);
  if (!win?.id) {
    return {
      tabs: [],
      groups: [],
      active: null,
      activeGroupId: null,
      groupsOk: false,
      tabsOk: false,
      windowId: null,
    };
  }

  const tabs = Array.isArray(win.tabs) ? win.tabs : [];
  const active = tabs.find((tab) => tab.active) ?? null;
  const remembered = coerceActiveGroupByWindow(stored)[String(win.id)] ?? null;
  const activeGroupId = resolveActiveGroupId(active?.groupId, remembered);

  const groupsRead = await readOr(() => chrome.tabGroups.query({ windowId: win.id }));
  const queried = groupsRead.ok ? groupsRead.value : [];
  const known = new Set(queried.map((group) => group.id));
  const extras = [];
  const wantedIds = groupIdsOnTabs(tabs);
  if (activeGroupId != null && !wantedIds.includes(activeGroupId)) wantedIds.push(activeGroupId);
  for (const id of wantedIds) {
    if (known.has(id)) continue;
    const got = await readOr(() => chrome.tabGroups.get(id));
    if (!got.ok || !got.value || got.value.windowId !== win.id) continue;
    extras.push(got.value);
    known.add(id);
  }

  const activeGroup = [...queried, ...extras].find((group) => group.id === activeGroupId) ?? null;
  const groups = groupsIncludingActive(mergeGroups(queried, extras), activeGroupId, activeGroup);

  return {
    tabs,
    groups,
    active,
    activeGroupId,
    groupsOk: groupsRead.ok || extras.length > 0,
    tabsOk: true,
    windowId: win.id,
  };
}

async function reload() {
  const pendingInput = document.getElementById("group-rename-input");
  if (renaming && pendingInput) renameDraft = pendingInput.value;

  const model = await listedModel();
  if (model.windowId == null) {
    if (windowId == null) {
      windowBlocked = true;
      loaded = false;
      ordered = [];
      setStatus("Tab groups are listed only for a normal browser window.");
      render();
    }
    return;
  }

  windowId = model.windowId;
  windowBlocked = false;
  if (!model.groupsOk && !model.tabsOk && model.activeGroupId == null) {
    if (!loaded) {
      loaded = true;
      setStatus("Couldn't read tab groups in this window.");
      render();
    }
    return;
  }

  // A failed group query must not drop rows already on screen.
  const groups = model.groupsOk ? model.groups : mergeGroups(ordered, model.groups);
  const next = rowsAfterRead(model, groups);
  if (next.length === 0 && ordered.length > 0 && (!model.groupsOk || !model.tabsOk)) return;

  const active = model.active;
  const activeGroupId = model.activeGroupId;
  const previous = ordered;
  const previousHighlight = highlightedId;

  if (!highlightInitialized) {
    highlightInitialized = true;
    const activeGroup = next.find((group) => group.id === activeGroupId);
    highlightedId = activeGroup?.id ?? next[0]?.id ?? null;
  } else if (!next.some((group) => group.id === highlightedId)) {
    highlightedId = nearestGroupId(previous, previousHighlight, next);
    renaming = false;
    renameDraft = "";
  }

  ordered = next;
  loaded = true;
  activeTabUngrouped = active != null && activeGroupId == null;
  currentGroupId = activeGroupId != null && next.some((group) => group.id === activeGroupId)
    ? activeGroupId
    : null;
  render();
}

function rowsAfterRead(model, groups) {
  const next = buildOrderedGroups(model.tabs, groups);
  if (model.tabsOk || ordered.length === 0) return next;

  const previousById = new Map(ordered.map((group) => [group.id, group]));
  const kept = next.map((group) => {
    const previous = previousById.get(group.id);
    if (!previous || previous.length === 0) return group;
    return {
      ...group,
      minIndex: previous.minIndex,
      maxIndex: previous.maxIndex,
      length: previous.length,
    };
  });
  kept.sort((a, b) => a.minIndex - b.minIndex || a.id - b.id);
  return kept;
}

function scheduleReload() {
  reloadChain = reloadChain.then(() => reload()).catch((err) => {
    reportError(err);
  });
  return reloadChain;
}

function onWindowChanged(changedWindowId) {
  if (changedWindowId !== windowId || opDepth > 0) return;
  void scheduleReload();
}

function watchWindow() {
  const onGroup = (group) => onWindowChanged(group.windowId);
  chrome.tabGroups.onCreated.addListener(onGroup);
  chrome.tabGroups.onRemoved.addListener(onGroup);
  chrome.tabGroups.onUpdated.addListener(onGroup);
  chrome.tabGroups.onMoved.addListener(onGroup);
  chrome.tabs.onMoved.addListener((_tabId, info) => onWindowChanged(info.windowId));
  chrome.tabs.onRemoved.addListener((_tabId, info) => onWindowChanged(info.windowId));
}

async function runOp(task) {
  opDepth += 1;
  try {
    await task();
    setStatus("");
  } catch (err) {
    reportError(err);
  } finally {
    opDepth -= 1;
  }
  await scheduleReload();
}

function shiftHighlight(delta) {
  if (ordered.length === 0 || highlightedId == null) return;
  const index = ordered.findIndex((group) => group.id === highlightedId);
  const nextIndex = index + delta;
  if (nextIndex < 0 || nextIndex >= ordered.length) return;
  highlightedId = ordered[nextIndex].id;
  setStatus("");
  render();
}

async function moveHighlighted(direction) {
  if (highlightedId == null) {
    setStatus(direction === "left" ? "No group to the left" : "No group to the right");
    return;
  }

  const insertionIndex = neighborMoveIndex(ordered, highlightedId, direction);
  if (insertionIndex == null) {
    setStatus(direction === "left" ? "No group to the left" : "No group to the right");
    return;
  }

  const groupId = highlightedId;
  const collapsed = ordered.find((group) => group.id === groupId)?.collapsed ?? false;
  await runOp(async () => {
    await chrome.tabGroups.move(groupId, { index: insertionIndex });
    // Move does not document a collapsed change. If Chrome flipped it, put it back.
    const updated = await chrome.tabGroups.get(groupId);
    if (updated.collapsed !== collapsed) {
      await chrome.tabGroups.update(groupId, { collapsed });
    }
  });
}

async function toggleCollapsed() {
  const group = ordered.find((item) => item.id === highlightedId);
  if (!group) return;
  await runOp(() => chrome.tabGroups.update(group.id, { collapsed: !group.collapsed }));
}

function beginRename() {
  const group = ordered.find((item) => item.id === highlightedId);
  if (!group) return;
  renaming = true;
  renameDraft = group.title ?? "";
  render();
  setTimeout(() => {
    const input = document.getElementById("group-rename-input");
    if (!input) return;
    input.focus();
    input.select();
  }, 0);
}

function cancelRename() {
  renaming = false;
  renameDraft = "";
  render();
}

async function commitRename() {
  const groupId = highlightedId;
  if (groupId == null || opDepth > 0) return;
  const input = document.getElementById("group-rename-input");
  const title = input ? input.value : renameDraft;
  opDepth += 1;
  try {
    await chrome.tabGroups.update(groupId, { title });
    renaming = false;
    renameDraft = "";
    setStatus("");
  } catch (err) {
    reportError(err);
    opDepth -= 1;
    return;
  }
  opDepth -= 1;
  await scheduleReload();
}

async function rememberedTabId(groupId) {
  const stored = await chrome.storage.session.get(LAST_ACTIVE_TAB_ID_BY_GROUP);
  const tabId = coerceLastActiveMap(stored)[String(groupId)];
  if (typeof tabId !== "number") return null;
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.groupId === groupId) return tab.id;
  } catch (err) {
    console.error(LOG, err);
  }
  return null;
}

async function firstTabId(groupId) {
  const tabs = await chrome.tabs.query({ windowId, groupId });
  tabs.sort((a, b) => a.index - b.index);
  return tabs[0]?.id ?? null;
}

async function activateHighlighted() {
  const groupId = highlightedId;
  if (groupId == null) {
    setStatus("No tab group to open.");
    return;
  }
  const tabId = (await rememberedTabId(groupId)) ?? (await firstTabId(groupId));
  if (tabId == null) {
    setStatus("That group has no tabs.");
    return;
  }
  await chrome.tabs.update(tabId, { active: true });
  window.close();
}

function renderScenes() {
  if (!sceneListEl) return;
  sceneListEl.replaceChildren();
  for (let slot = 1; slot <= SCENE_SLOT_COUNT; slot += 1) {
    sceneListEl.append(renderSceneSlot(slot, scenes[slot]));
  }
}

function renderSceneSlot(slot, scene) {
  const summary = sceneSummary(scene);
  const row = document.createElement("li");
  row.id = `tab-scene-slot-${slot}`;

  const open = document.createElement("button");
  open.id = `tab-scene-open-${slot}`;
  open.type = "button";
  open.title = summary;
  open.setAttribute("aria-label", `Open tab scene ${slot}, ${summary}`);

  const number = document.createElement("span");
  number.id = `tab-scene-number-${slot}`;
  number.textContent = String(slot);

  const label = document.createElement("span");
  label.id = `tab-scene-summary-${slot}`;
  label.dataset.empty = scene ? "false" : "true";
  label.textContent = summary;
  open.append(number, label);
  open.addEventListener("click", (event) => {
    if (event.shiftKey) void saveSceneFromPopup(slot);
    else void openSceneFromPopup(slot);
  });

  const save = document.createElement("button");
  save.id = `tab-scene-save-${slot}`;
  save.type = "button";
  const occupied = scene != null;
  save.textContent = occupied ? "Overwrite" : "Save";
  save.setAttribute(
    "aria-label",
    occupied ? `Overwrite tab scene ${slot}` : `Save tab scene ${slot}`,
  );
  save.addEventListener("click", () => {
    void saveSceneFromPopup(slot);
  });

  row.append(open, save);
  return row;
}

async function loadScenes() {
  const stored = await chrome.storage.local.get(TAB_SCENES);
  scenes = coerceScenes(stored);
  renderScenes();
}

async function openSceneFromPopup(slot) {
  if (opDepth > 0) return;
  opDepth += 1;
  let stayOpen = true;
  try {
    const result = await chrome.runtime.sendMessage({
      type: "open-tab-scene",
      slot,
      windowId,
    });
    setStatus(result.message);
    if (result.ok && result.failedPages === 0) {
      stayOpen = false;
      window.close();
    }
  } catch (err) {
    reportError(err);
  } finally {
    opDepth -= 1;
  }
  if (stayOpen) {
    focusKeyboardSurface();
    await scheduleReload();
  }
}

async function saveSceneFromPopup(slot) {
  if (opDepth > 0) return;
  opDepth += 1;
  try {
    const result = await chrome.runtime.sendMessage({
      type: "save-tab-scene",
      slot,
      windowId,
    });
    setStatus(result.message);
    if (result.ok) await loadScenes();
  } catch (err) {
    reportError(err);
  } finally {
    opDepth -= 1;
  }
  focusKeyboardSurface();
}

function onKeyDown(event) {
  if (renaming) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) cancelRename();
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (!event.repeat) void commitRename();
    }
    return;
  }

  const sceneSlot = sceneSlotFromKeyEvent(event);
  if (sceneSlot && !event.metaKey && !event.ctrlKey && !event.altKey && !event.repeat) {
    event.preventDefault();
    event.stopPropagation();
    if (opDepth > 0) return;
    if (event.shiftKey) void saveSceneFromPopup(sceneSlot);
    else void openSceneFromPopup(sceneSlot);
    return;
  }

  if (event.target instanceof HTMLButtonElement) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;

  const key = event.key;
  if (key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight" || key === " ") {
    event.preventDefault();
  }
  if (opDepth > 0) return;
  if (event.repeat && key !== "ArrowUp" && key !== "ArrowDown") return;

  if (key === "ArrowUp") shiftHighlight(-1);
  else if (key === "ArrowDown") shiftHighlight(1);
  else if (key === "ArrowLeft") void moveHighlighted("left");
  else if (key === "ArrowRight") void moveHighlighted("right");
  else if (key === " ") void toggleCollapsed();
  else if (key === "r" || key === "R") {
    event.preventDefault();
    beginRename();
  } else if (key === "Enter") {
    void activateHighlighted().catch(reportError);
  } else if (key === "Escape") {
    event.preventDefault();
    window.close();
  }
}

async function init() {
  focusKeyboardSurface();
  watchWindow();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[TAB_SCENES]) return;
    scenes = coerceScenes({ [TAB_SCENES]: changes[TAB_SCENES].newValue });
    renderScenes();
  });
  try {
    await Promise.all([scheduleReload(), loadScenes()]);
  } catch (err) {
    reportError(err);
  }
}

document.addEventListener("keydown", onKeyDown, true);
void init();
