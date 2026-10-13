import { TAB_GROUP_ID_NONE } from "./group-move.js";
import {
  EXTENSION_CREATED_FINGERPRINTS,
  EXTENSION_CREATED_GROUPS,
  TAB_SCENES,
} from "./storage-keys.js";
import {
  SCENE_SLOT_COUNT,
  captureScene,
  coerceCreatedGroups,
  coerceFingerprints,
  coerceScenes,
  describeOpenGroups,
  fingerprintsStillOpen,
  groupsToUngroup,
  nextCreatedGroups,
  scenesForStorage,
} from "./tab-scenes.js";

/**
 * Open a frozen scene in one window.
 * New pages are created before any existing tab closes, so the window stays open.
 * Extension-created groups are ungrouped first. That matches Delete group:
 * the saved group name does not stay on the new-tab page.
 * Other groups only have their tabs closed, which matches Close group.
 */
export async function openTabScene(api, slot, windowId) {
  if (!validSlot(slot)) return fail("That scene slot does not exist.");

  const scenes = coerceScenes(await api.storage.local.get(TAB_SCENES));
  const scene = scenes[slot];
  if (!scene) return fail(`Scene ${slot} is empty.`);

  const winId = await resolveWindowId(api, windowId);
  if (winId == null) return fail("No browser window to open this scene in.");

  const none = groupIdNone(api);
  const windowTabs = await api.tabs.query({ windowId: winId });
  const windowGroups = await api.tabGroups.query({ windowId: winId });
  const openEverywhere = describeOpenGroups(
    await api.tabs.query({}),
    await api.tabGroups.query({}),
    none,
  );
  const front = describeOpenGroups(windowTabs, windowGroups, none);
  const created = coerceCreatedGroups(await api.storage.session.get(EXTENSION_CREATED_GROUPS));
  const pruned = fingerprintsStillOpen(
    coerceFingerprints(await api.storage.local.get(EXTENSION_CREATED_FINGERPRINTS)),
    openEverywhere,
  );
  const { ungroupIds, remainingFingerprints } = groupsToUngroup(front, created, pruned);

  const openedGroups = [];
  let failedPages = 0;
  for (const group of scene.groups) {
    const tabIds = [];
    const urls = [];
    for (const url of group.urls) {
      try {
        const tab = await api.tabs.create({ windowId: winId, url, active: false });
        if (typeof tab?.id !== "number") {
          failedPages += 1;
          continue;
        }
        tabIds.push(tab.id);
        urls.push(url);
      } catch {
        failedPages += 1;
      }
    }
    if (tabIds.length > 0) {
      openedGroups.push({
        title: group.title,
        color: group.color,
        collapsed: group.collapsed,
        urls,
        tabIds,
      });
    }
  }

  if (openedGroups.length === 0) return fail(`Scene ${slot} could not be opened.`, failedPages);

  const added = [];
  for (const group of openedGroups) {
    try {
      const groupId = await api.tabs.group({
        tabIds: group.tabIds,
        createProperties: { windowId: winId },
      });
      await api.tabGroups.update(groupId, {
        title: group.title,
        color: group.color,
        collapsed: group.collapsed,
      });
      added.push({
        id: groupId,
        title: group.title,
        color: group.color,
        urls: group.urls,
        collapsed: group.collapsed,
        tabIds: group.tabIds,
      });
    } catch {
      failedPages += group.urls.length;
    }
  }

  if (added.length === 0) {
    await removeTabs(api, openedGroups.flatMap((group) => group.tabIds));
    return fail(`Scene ${slot} could not be opened.`, failedPages);
  }

  const ungroupTabIds = windowTabs
    .filter((tab) => ungroupIds.includes(tab.groupId))
    .map((tab) => tab.id)
    .filter((id) => typeof id === "number");
  await ungroupTabs(api, ungroupTabIds);

  const oldTabIds = windowTabs.map((tab) => tab.id).filter((id) => typeof id === "number");
  await removeTabs(api, oldTabIds);

  const first = added[0];
  try {
    await api.tabs.update(first.tabIds[0], { active: true });
  } catch {
    // The page is open even if activation fails.
  }
  if (first.collapsed) await collapseAgain(api, first.id);

  const nextCreated = nextCreatedGroups(
    created,
    front.map((group) => group.id),
    added.map(({ id, title, color, urls }) => ({ id, title, color, urls })),
  );
  const nextPrints = [
    ...remainingFingerprints,
    ...added.map(({ title, color, urls }) => ({ title, color, urls })),
  ];
  await api.storage.session.set({ [EXTENSION_CREATED_GROUPS]: nextCreated });
  await api.storage.local.set({ [EXTENSION_CREATED_FINGERPRINTS]: nextPrints });

  const message = failedPages > 0
    ? `Opened scene ${slot}. ${failedPages} ${failedPages === 1 ? "page" : "pages"} could not be opened.`
    : `Opened scene ${slot}.`;
  return { ok: true, message, failedPages };
}

/** Overwrite one frozen slot with the colored group labels in this window. */
export async function saveTabScene(api, slot, windowId) {
  if (!validSlot(slot)) return fail("That scene slot does not exist.");

  const winId = await resolveWindowId(api, windowId);
  if (winId == null) return fail("No browser window to save from.");

  const tabs = await api.tabs.query({ windowId: winId });
  let groups = [];
  try {
    groups = await api.tabGroups.query({ windowId: winId });
  } catch {
    groups = [];
  }
  const scene = captureScene(tabs, groups, groupIdNone(api));
  if (!scene) return fail("No tab groups to save.");

  const scenes = coerceScenes(await api.storage.local.get(TAB_SCENES));
  const replacing = scenes[slot] != null;
  scenes[slot] = scene;
  await api.storage.local.set({ [TAB_SCENES]: scenesForStorage(scenes) });
  const message = replacing ? `Overwrote scene ${slot}.` : `Saved scene ${slot}.`;
  return { ok: true, message, failedPages: 0 };
}

function validSlot(slot) {
  return Number.isInteger(slot) && slot >= 1 && slot <= SCENE_SLOT_COUNT;
}

function fail(message, failedPages = 0) {
  return { ok: false, message, failedPages };
}

function groupIdNone(api) {
  return typeof api.tabGroups?.TAB_GROUP_ID_NONE === "number"
    ? api.tabGroups.TAB_GROUP_ID_NONE
    : TAB_GROUP_ID_NONE;
}

async function resolveWindowId(api, windowId) {
  if (typeof windowId === "number") return windowId;
  const win = await api.windows.getLastFocused({ windowTypes: ["normal"] });
  return typeof win?.id === "number" ? win.id : null;
}

async function ungroupTabs(api, tabIds) {
  if (tabIds.length === 0) return;
  try {
    await api.tabs.ungroup(tabIds);
  } catch {
    for (const tabId of tabIds) {
      try {
        await api.tabs.ungroup(tabId);
      } catch {
        // That tab may already have left its group.
      }
    }
  }
}

async function removeTabs(api, tabIds) {
  if (tabIds.length === 0) return;
  try {
    await api.tabs.remove(tabIds);
  } catch {
    for (const tabId of tabIds) {
      try {
        await api.tabs.remove(tabId);
      } catch {
        // That tab may already be closed.
      }
    }
  }
}

/** Activating a tab can unfold its group. Write the folded state again once. */
async function collapseAgain(api, groupId) {
  try {
    await api.tabGroups.update(groupId, { collapsed: true });
    const group = await api.tabGroups.get(groupId);
    if (group?.collapsed === true) return;
    await api.tabGroups.update(groupId, { collapsed: true });
  } catch {
    // The group can close before the second write.
  }
}
