/** chrome.storage.session key. Values are string groupId -> numeric tab id. */
export const LAST_ACTIVE_TAB_ID_BY_GROUP = "lastActiveTabIdByGroup";

/** chrome.storage.session key. Values are string windowId -> numeric group id. */
export const ACTIVE_GROUP_ID_BY_WINDOW = "activeGroupIdByWindow";

/** chrome.storage.session key. The normal window the user last activated a tab in. */
export const LAST_FOCUSED_WINDOW_ID = "lastFocusedNormalWindowId";

/** chrome.storage.local key. Frozen tab scenes, keyed by slot "1" through "9". */
export const TAB_SCENES = "tabScenes";

/**
 * chrome.storage.session key. Groups this extension created.
 * Values are { id, title, color, urls }. Ids last for this browser session.
 */
export const EXTENSION_CREATED_GROUPS = "extensionCreatedGroups";

/**
 * chrome.storage.local key. Fingerprints for groups this extension created.
 * Survives a browser restart, when group ids are gone.
 */
export const EXTENSION_CREATED_FINGERPRINTS = "extensionCreatedFingerprints";

/** Copy a stored map, keeping only finite numeric tab ids. */
export function coerceLastActiveMap(stored) {
  const value = stored?.[LAST_ACTIVE_TAB_ID_BY_GROUP];
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const map = {};
  for (const [groupId, tabId] of Object.entries(value)) {
    if (typeof tabId === "number" && Number.isFinite(tabId)) map[groupId] = tabId;
  }
  return map;
}

/** Copy a stored map, keeping only finite numeric group ids. */
export function coerceActiveGroupByWindow(stored) {
  const value = stored?.[ACTIVE_GROUP_ID_BY_WINDOW];
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const map = {};
  for (const [windowId, groupId] of Object.entries(value)) {
    if (typeof groupId === "number" && Number.isFinite(groupId)) map[windowId] = groupId;
  }
  return map;
}
