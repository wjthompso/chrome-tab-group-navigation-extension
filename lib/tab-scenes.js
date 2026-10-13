import { TAB_GROUP_ID_NONE } from "./group-move.js";
import {
  EXTENSION_CREATED_FINGERPRINTS,
  EXTENSION_CREATED_GROUPS,
  TAB_SCENES,
} from "./storage-keys.js";

export const SCENE_SLOT_COUNT = 9;

const GROUP_COLORS = new Set([
  "grey",
  "blue",
  "red",
  "yellow",
  "green",
  "pink",
  "purple",
  "cyan",
  "orange",
]);

export function normalizeColor(color) {
  const value = typeof color === "string" ? color.toLowerCase() : "";
  return GROUP_COLORS.has(value) ? value : "grey";
}

/** Slot 1–9 from a keyboard event, or null. Shift+1 still counts as slot 1. */
export function sceneSlotFromKeyEvent(event) {
  const code = typeof event?.code === "string" ? event.code : "";
  const fromCode = /^(?:Digit|Numpad)([1-9])$/.exec(code);
  if (fromCode) return Number(fromCode[1]);
  if (!event?.shiftKey && typeof event?.key === "string" && /^[1-9]$/.test(event.key)) {
    return Number(event.key);
  }
  return null;
}

/** Slot from a manifest command name such as "open-tab-scene-3". */
export function sceneSlotFromCommand(command) {
  if (typeof command !== "string") return null;
  const match = /^open-tab-scene-([1-9])$/.exec(command);
  return match ? Number(match[1]) : null;
}

export function emptyScenes() {
  const scenes = {};
  for (let slot = 1; slot <= SCENE_SLOT_COUNT; slot += 1) scenes[slot] = null;
  return scenes;
}

export function coerceScenes(stored) {
  const scenes = emptyScenes();
  const value = stored?.[TAB_SCENES];
  if (!value || typeof value !== "object" || Array.isArray(value)) return scenes;
  for (let slot = 1; slot <= SCENE_SLOT_COUNT; slot += 1) {
    scenes[slot] = coerceScene(value[String(slot)]);
  }
  return scenes;
}

/** Drop empty slots so storage only holds scenes that have groups. */
export function scenesForStorage(scenes) {
  const record = {};
  for (let slot = 1; slot <= SCENE_SLOT_COUNT; slot += 1) {
    const scene = coerceScene(scenes[slot]);
    if (scene) record[String(slot)] = scene;
  }
  return record;
}

export function sceneSummary(scene) {
  if (!scene?.groups?.length) return "Empty";
  return scene.groups
    .map((group) => (typeof group.title === "string" && group.title.trim()) || "Unnamed")
    .join(", ");
}

function tabAddress(tab) {
  if (typeof tab?.url === "string" && tab.url !== "") return tab.url;
  if (typeof tab?.pendingUrl === "string" && tab.pendingUrl !== "") return tab.pendingUrl;
  return null;
}

/**
 * Open groups in tab-row order. Each entry has the group id plus the fields
 * a frozen scene stores. Tabs outside a colored group label are skipped.
 */
export function describeOpenGroups(tabs, groups, none = TAB_GROUP_ID_NONE) {
  const meta = new Map(groups.map((group) => [group.id, group]));
  const ordered = [...tabs].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const built = new Map();
  const described = [];

  for (const tab of ordered) {
    if (typeof tab.groupId !== "number" || tab.groupId === none) continue;
    const url = tabAddress(tab);
    if (!url) continue;
    let group = built.get(tab.groupId);
    if (!group) {
      const source = meta.get(tab.groupId);
      group = {
        id: tab.groupId,
        title: typeof source?.title === "string" ? source.title : "",
        color: normalizeColor(source?.color),
        collapsed: source?.collapsed === true,
        urls: [],
      };
      built.set(tab.groupId, group);
      described.push(group);
    }
    group.urls.push(url);
  }

  return described;
}

/** Frozen scene for the colored group labels in one window, or null when there are none. */
export function captureScene(tabs, groups, none = TAB_GROUP_ID_NONE) {
  const described = describeOpenGroups(tabs, groups, none);
  if (described.length === 0) return null;
  return {
    groups: described.map(({ title, color, collapsed, urls }) => ({
      title,
      color,
      collapsed,
      urls: [...urls],
    })),
  };
}

export function sameFingerprint(a, b) {
  if (!a || !b) return false;
  if (a.title !== b.title || a.color !== b.color) return false;
  if (a.urls.length !== b.urls.length) return false;
  return a.urls.every((url, index) => url === b.urls[index]);
}

function cloneFingerprint(fingerprint) {
  return {
    title: fingerprint.title,
    color: fingerprint.color,
    urls: [...fingerprint.urls],
  };
}

function takeFingerprint(pool, fingerprint) {
  const index = pool.findIndex((item) => sameFingerprint(item, fingerprint));
  if (index >= 0) pool.splice(index, 1);
}

export function coerceCreatedGroups(stored) {
  const value = stored?.[EXTENSION_CREATED_GROUPS];
  if (!Array.isArray(value)) return [];
  return value.map(coerceCreatedGroup).filter(Boolean);
}

export function coerceFingerprints(stored) {
  const value = stored?.[EXTENSION_CREATED_FINGERPRINTS];
  if (!Array.isArray(value)) return [];
  return value.map(coerceFingerprint).filter(Boolean);
}

/**
 * Keep fingerprints that still match some open group. A fingerprint whose
 * group is already gone cannot be deleted later, so it is dropped.
 */
export function fingerprintsStillOpen(fingerprints, openGroups) {
  const pool = openGroups.map(cloneFingerprint);
  const kept = [];
  for (const fingerprint of fingerprints) {
    const index = pool.findIndex((group) => sameFingerprint(group, fingerprint));
    if (index < 0) continue;
    pool.splice(index, 1);
    kept.push(cloneFingerprint(fingerprint));
  }
  return kept;
}

/**
 * Groups to Ungroup before their website tabs close.
 * A session id wins even when the pages changed. Otherwise an exact
 * name/color/address match counts, which covers a browser restart.
 */
export function groupsToUngroup(windowGroups, createdGroups, fingerprints) {
  const pool = fingerprints.map(cloneFingerprint);
  const ungroupIds = [];

  for (const group of windowGroups) {
    const created = createdGroups.find((item) => item.id === group.id);
    if (created) {
      ungroupIds.push(group.id);
      takeFingerprint(pool, created);
      continue;
    }
    const index = pool.findIndex((fingerprint) => sameFingerprint(fingerprint, group));
    if (index < 0) continue;
    pool.splice(index, 1);
    ungroupIds.push(group.id);
  }

  return { ungroupIds, remainingFingerprints: pool };
}

/** Created groups that were outside this window, followed by the ones just opened. */
export function nextCreatedGroups(createdGroups, frontWindowGroupIds, addedGroups) {
  const inFront = new Set(frontWindowGroupIds);
  return [
    ...createdGroups.filter((group) => !inFront.has(group.id)),
    ...addedGroups,
  ];
}

function coerceScene(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.groups)) return null;
  const groups = [];
  for (const group of value.groups) {
    const fingerprint = coerceFingerprint(group);
    if (!fingerprint) continue;
    groups.push({
      ...fingerprint,
      collapsed: group.collapsed === true,
    });
  }
  if (groups.length === 0) return null;
  return { groups };
}

function coerceCreatedGroup(value) {
  const fingerprint = coerceFingerprint(value);
  if (!fingerprint || typeof value?.id !== "number" || !Number.isFinite(value.id)) return null;
  return { id: value.id, ...fingerprint };
}

function coerceFingerprint(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.urls)) return null;
  const urls = value.urls.filter((url) => typeof url === "string" && url !== "");
  if (urls.length === 0) return null;
  return {
    title: typeof value.title === "string" ? value.title : "",
    color: normalizeColor(value.color),
    urls,
  };
}
