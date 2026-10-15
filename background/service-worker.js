import { nextCollapsedForGroup, nextCollapsedValue } from "../lib/collapse-groups.js";
import { clusterByDomain } from "../lib/domain-groups.js";
import { openTabScene, saveTabScene } from "../lib/tab-scene-actions.js";
import { handleSceneMessage } from "../lib/scene-message-handler.js";
import { sceneSlotFromCommand } from "../lib/tab-scenes.js";
import {
  ACTIVE_GROUP_ID_BY_WINDOW,
  LAST_ACTIVE_TAB_ID_BY_GROUP,
  LAST_FOCUSED_WINDOW_ID,
  coerceActiveGroupByWindow,
  coerceLastActiveMap,
} from "../lib/storage-keys.js";

const LOG = "[tab-group-nav]";
const GROUP_BY_DOMAIN = "group-by-domain";
const COLLAPSE_EXPAND_ALL = "collapse-expand-all-groups";
const COLLAPSE_EXPAND_CURRENT = "collapse-expand-current-group";

let writeChain = Promise.resolve();

function enqueue(task) {
  writeChain = writeChain.then(task).catch((err) => {
    console.error(LOG, err);
  });
}

chrome.runtime.onInstalled.addListener(() => {
  console.info(`${LOG} installed`);
  enqueue(() => snapshotOpenGroups());
});

enqueue(() => snapshotOpenGroups());

chrome.commands.onCommand.addListener((command) => {
  if (command !== GROUP_BY_DOMAIN) return;
  enqueue(() => groupFocusedWindowByDomain());
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== COLLAPSE_EXPAND_ALL) return;
  enqueue(() => collapseOrExpandAllGroups());
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== COLLAPSE_EXPAND_CURRENT) return;
  enqueue(() => collapseOrExpandCurrentGroup());
});

chrome.commands.onCommand.addListener((command) => {
  const slot = sceneSlotFromCommand(command);
  if (slot == null) return;
  enqueue(async () => {
    const result = await openTabScene(chrome, slot);
    if (!result.ok) console.error(LOG, result.message);
    else console.info(LOG, result.message);
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const opening = message?.type === "open-tab-scene";
  const saving = message?.type === "save-tab-scene";
  if (!opening && !saving) return;
  // Answer directly, not behind writeChain. The reply must not wait on the
  // load-time snapshot or an unrelated command, or Chrome closes the message
  // port and the popup sees "Receiving end does not exist."
  handleSceneMessage(message, chrome).then(sendResponse).catch((err) => {
    console.error(LOG, err);
    const text = err instanceof Error ? err.message : String(err);
    sendResponse({ ok: false, message: text, failedPages: 0 });
  });
  return true;
});

async function groupFocusedWindowByDomain() {
  const win = await chrome.windows.getLastFocused({ windowTypes: ["normal"] });
  if (!win?.id) return;

  const tabs = await chrome.tabs.query({ windowId: win.id });
  const unpinned = tabs.filter((tab) => !tab.pinned);
  if (unpinned.length > 0 && unpinned.every((tab) => !tab.url && !tab.pendingUrl)) {
    console.error(LOG, "Tab URLs unavailable. Reload the extension and allow the tabs permission.");
    return;
  }

  const none = chrome.tabGroups.TAB_GROUP_ID_NONE;
  for (const cluster of clusterByDomain(tabs)) {
    try {
      const groupId = await reuseExactGroup(tabs, cluster, none)
        ?? await chrome.tabs.group({ tabIds: cluster.tabIds, createProperties: { windowId: win.id } });
      await chrome.tabGroups.update(groupId, { title: cluster.title, collapsed: true });
    } catch (err) {
      console.error(LOG, cluster.domain, err);
    }
  }
}

function reuseExactGroup(tabs, cluster, none) {
  const members = tabs.filter((tab) => cluster.tabIds.includes(tab.id));
  const groupIds = new Set(members.map((tab) => tab.groupId));
  if (groupIds.size !== 1) return null;

  const groupId = [...groupIds][0];
  if (groupId === none) return null;

  const inGroup = tabs.filter((tab) => tab.groupId === groupId);
  const wanted = new Set(cluster.tabIds);
  const exact = inGroup.length === wanted.size && inGroup.every((tab) => wanted.has(tab.id));
  return exact ? groupId : null;
}

async function collapseOrExpandAllGroups() {
  const win = await chrome.windows.getLastFocused({ windowTypes: ["normal"] });
  if (!win?.id) return;

  const groups = await chrome.tabGroups.query({ windowId: win.id });
  const collapsed = nextCollapsedValue(groups);
  if (collapsed === null) return;

  const activeGroupId = collapsed ? await activeGroupIdIn(win.id, groups) : null;
  for (const group of groupsWithIdLast(groups, activeGroupId)) {
    try {
      await chrome.tabGroups.update(group.id, { collapsed });
    } catch (err) {
      console.error(LOG, group.id, err);
    }
  }

  if (activeGroupId == null) return;
  await collapseAgainIfReopened(activeGroupId);
}

async function collapseOrExpandCurrentGroup() {
  const win = await chrome.windows.getLastFocused({ windowTypes: ["normal"] });
  if (!win?.id) return;

  const groups = await chrome.tabGroups.query({ windowId: win.id });
  const groupId = await activeGroupIdIn(win.id, groups);
  const group = groupId == null ? null : groups.find((item) => item.id === groupId);
  const collapsed = nextCollapsedForGroup(group);
  if (collapsed === null) return;

  try {
    await chrome.tabGroups.update(groupId, { collapsed });
  } catch (err) {
    console.error(LOG, groupId, err);
  }

  if (collapsed) await collapseAgainIfReopened(groupId);
}

async function activeGroupIdIn(windowId, groups) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    const none = chrome.tabGroups.TAB_GROUP_ID_NONE;
    if (typeof tab?.groupId !== "number" || tab.groupId === none) return null;
    return groups.some((group) => group.id === tab.groupId) ? tab.groupId : null;
  } catch (err) {
    console.error(LOG, err);
    return null;
  }
}

function groupsWithIdLast(groups, groupId) {
  if (groupId == null) return groups;
  const index = groups.findIndex((group) => group.id === groupId);
  if (index < 0 || index === groups.length - 1) return groups;
  return [...groups.slice(0, index), ...groups.slice(index + 1), groups[index]];
}

/** Chrome may reopen the active tab's group after a collapse. Update once more, then stop. */
async function collapseAgainIfReopened(groupId) {
  try {
    const group = await chrome.tabGroups.get(groupId);
    if (group.collapsed === true) return;
    await chrome.tabGroups.update(groupId, { collapsed: true });
    const again = await chrome.tabGroups.get(groupId);
    if (again.collapsed !== true) {
      console.error(LOG, "active group stayed expanded", groupId);
    }
  } catch (err) {
    console.error(LOG, groupId, err);
  }
}

chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  enqueue(async () => {
    const tab = await chrome.tabs.get(tabId);
    await rememberWindowGroup(windowId, tab.groupId, true);
    const none = chrome.tabGroups.TAB_GROUP_ID_NONE;
    if (typeof tab.groupId !== "number" || tab.groupId === none) return;

    const stored = await chrome.storage.session.get(LAST_ACTIVE_TAB_ID_BY_GROUP);
    const map = coerceLastActiveMap(stored);
    map[String(tab.groupId)] = tabId;
    await chrome.storage.session.set({ [LAST_ACTIVE_TAB_ID_BY_GROUP]: map });
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!tab.active || !Object.hasOwn(changeInfo, "groupId")) return;
  enqueue(() => rememberWindowGroup(tab.windowId, changeInfo.groupId, true));
});

async function snapshotOpenGroups() {
  const windows = await chrome.windows.getAll({ populate: true, windowTypes: ["normal"] });
  for (const win of windows) {
    const active = win.tabs?.find((tab) => tab.active);
    if (!active) continue;
    await rememberWindowGroup(win.id, active.groupId, win.focused === true);
  }
}

async function rememberWindowGroup(windowId, groupId, focused = false) {
  if (typeof windowId !== "number") return;
  const stored = await chrome.storage.session.get(ACTIVE_GROUP_ID_BY_WINDOW);
  const map = coerceActiveGroupByWindow(stored);
  const key = String(windowId);
  const none = chrome.tabGroups.TAB_GROUP_ID_NONE;
  if (typeof groupId === "number" && groupId !== none) map[key] = groupId;
  else delete map[key];
  const payload = { [ACTIVE_GROUP_ID_BY_WINDOW]: map };
  if (focused) payload[LAST_FOCUSED_WINDOW_ID] = windowId;
  await chrome.storage.session.set(payload);
}

chrome.tabGroups.onRemoved.addListener((group) => {
  enqueue(async () => {
    const stored = await chrome.storage.session.get([
      LAST_ACTIVE_TAB_ID_BY_GROUP,
      ACTIVE_GROUP_ID_BY_WINDOW,
    ]);
    const map = coerceLastActiveMap(stored);
    const key = String(group.id);
    if (Object.hasOwn(map, key)) {
      delete map[key];
      await chrome.storage.session.set({ [LAST_ACTIVE_TAB_ID_BY_GROUP]: map });
    }

    const byWindow = coerceActiveGroupByWindow(stored);
    let changed = false;
    for (const [windowId, groupId] of Object.entries(byWindow)) {
      if (groupId !== group.id) continue;
      delete byWindow[windowId];
      changed = true;
    }
    if (changed) {
      await chrome.storage.session.set({ [ACTIVE_GROUP_ID_BY_WINDOW]: byWindow });
    }
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  enqueue(async () => {
    const stored = await chrome.storage.session.get(LAST_ACTIVE_TAB_ID_BY_GROUP);
    const map = coerceLastActiveMap(stored);
    let changed = false;
    for (const [groupId, storedTabId] of Object.entries(map)) {
      if (storedTabId !== tabId) continue;
      delete map[groupId];
      changed = true;
    }
    if (!changed) return;
    await chrome.storage.session.set({ [LAST_ACTIVE_TAB_ID_BY_GROUP]: map });
  });
});
