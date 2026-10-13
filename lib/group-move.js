/** Ungrouped tabs use this groupId. Matches chrome.tabGroups.TAB_GROUP_ID_NONE. */
export const TAB_GROUP_ID_NONE = -1;

/**
 * Prefer the window the user was in before the popup opened.
 * `windows` should already be normal browser windows.
 *
 * @param {Array<{id: number, focused?: boolean, type?: string}>} windows
 * @param {number | null | undefined} preferredId
 */
export function chooseListedWindow(windows, preferredId) {
  const normal = windows.filter((win) => win && (win.type === "normal" || win.type == null));
  if (typeof preferredId === "number") {
    const preferred = normal.find((win) => win.id === preferredId);
    if (preferred) return preferred;
  }
  return normal.find((win) => win.focused) ?? normal[0] ?? null;
}

/** Real group ids on these tabs, first-seen order. Ungrouped tabs are skipped. */
export function groupIdsOnTabs(tabs) {
  const ids = [];
  const seen = new Set();
  for (const tab of tabs) {
    if (typeof tab.groupId !== "number" || tab.groupId === TAB_GROUP_ID_NONE) continue;
    if (seen.has(tab.groupId)) continue;
    seen.add(tab.groupId);
    ids.push(tab.groupId);
  }
  return ids;
}

/**
 * Sorts after every real tab index. Groups with no tabs yet share this
 * value and then sort by id. It is not a valid `tabGroups.move` index.
 */
const NO_STRIP_INDEX = Number.MAX_SAFE_INTEGER;

function hasStripIndex(group) {
  return typeof group.minIndex === "number" && group.minIndex < NO_STRIP_INDEX;
}

function groupRecord(id, span, meta) {
  return {
    id,
    minIndex: span.minIndex,
    maxIndex: span.maxIndex,
    length: span.length,
    collapsed: meta?.collapsed ?? false,
    title: meta?.title ?? "",
    color: meta?.color ?? "",
  };
}

/**
 * Group ids whose tabs still need a follow-up query.
 * A queried group is listed when `tabs` has none of its tabs. `activeGroupId`
 * is listed when it is a real group that is still absent. Ungrouped tabs
 * (`TAB_GROUP_ID_NONE`) are never listed. Order is query order, then the
 * active group if it was not already included.
 *
 * @param {Array<{groupId?: number}>} tabs
 * @param {Array<{id: number}>} groups
 * @param {number | null} [activeGroupId]
 * @returns {number[]}
 */
export function groupIdsMissingTabs(tabs, groups, activeGroupId = null) {
  const present = new Set();
  for (const tab of tabs) {
    if (typeof tab.groupId === "number" && tab.groupId !== TAB_GROUP_ID_NONE) {
      present.add(tab.groupId);
    }
  }

  const missing = [];
  const queued = new Set();
  for (const group of groups) {
    if (typeof group.id !== "number" || present.has(group.id) || queued.has(group.id)) continue;
    queued.add(group.id);
    missing.push(group.id);
  }

  if (
    typeof activeGroupId === "number" &&
    activeGroupId !== TAB_GROUP_ID_NONE &&
    !present.has(activeGroupId) &&
    !queued.has(activeGroupId)
  ) {
    missing.push(activeGroupId);
  }

  return missing;
}

/**
 * One entry per tab id. A later copy replaces an earlier one so a follow-up
 * query can correct a stale groupId. Tabs with no id are appended.
 *
 * @param {Array<{id?: number, index: number, groupId: number}>} tabs
 * @param {Array<{id?: number, index: number, groupId: number}>} extras
 */
export function mergeTabs(tabs, extras) {
  const merged = [];
  const indexById = new Map();

  for (const tab of tabs) {
    if (typeof tab.id === "number") indexById.set(tab.id, merged.length);
    merged.push(tab);
  }

  for (const tab of extras) {
    if (typeof tab.id !== "number") {
      merged.push(tab);
      continue;
    }
    const existing = indexById.get(tab.id);
    if (existing == null) {
      indexById.set(tab.id, merged.length);
      merged.push(tab);
    } else {
      merged[existing] = tab;
    }
  }

  return merged;
}

/**
 * Every queried group, plus the active tab's group when that id is real.
 * Does not invent a row for an ungrouped tab (`TAB_GROUP_ID_NONE`).
 * A group already in `groups` is kept once; its queried fields win.
 *
 * @param {Array<{id: number}>} groups
 * @param {number | null | undefined} activeGroupId
 * @param {{id: number, collapsed?: boolean, title?: string, color?: string} | null} [activeGroup]
 */
/**
 * Group to mark as current. The live tab wins. If the popup query reports
 * the active tab as ungrouped, the id remembered before the popup opened is used.
 *
 * @param {number | null | undefined} liveGroupId
 * @param {number | null | undefined} rememberedGroupId
 * @returns {number | null}
 */
export function resolveActiveGroupId(liveGroupId, rememberedGroupId) {
  if (typeof liveGroupId === "number" && liveGroupId !== TAB_GROUP_ID_NONE) return liveGroupId;
  if (typeof rememberedGroupId === "number" && rememberedGroupId !== TAB_GROUP_ID_NONE) {
    return rememberedGroupId;
  }
  return null;
}

export function groupsIncludingActive(groups, activeGroupId, activeGroup = null) {
  const byId = new Map();
  for (const group of groups) {
    if (typeof group?.id !== "number" || group.id === TAB_GROUP_ID_NONE) continue;
    byId.set(group.id, group);
  }

  if (typeof activeGroupId !== "number" || activeGroupId === TAB_GROUP_ID_NONE) {
    return [...byId.values()];
  }
  if (byId.has(activeGroupId)) return [...byId.values()];

  const extra = activeGroup && activeGroup.id === activeGroupId
    ? activeGroup
    : { id: activeGroupId };
  byId.set(activeGroupId, extra);
  return [...byId.values()];
}

/**
 * Groups in left-to-right strip order.
 * `tabs` may be unsorted. A group in `groups` stays even when no tab carries
 * its id: those rows sort after groups that have a tab index, stable by id.
 * A group id that shows up only on a tab is included too. `length` is the
 * tab count. Collapsed, focused, and unnamed groups are not filtered.
 * Titles are not sorted alphabetically.
 *
 * @param {Array<{index: number, groupId: number}>} tabs
 * @param {Array<{id: number, collapsed?: boolean, title?: string, color?: string}>} groups
 */
export function buildOrderedGroups(tabs, groups) {
  const metaById = new Map();
  for (const group of groups) {
    if (typeof group?.id !== "number" || group.id === TAB_GROUP_ID_NONE) continue;
    metaById.set(group.id, group);
  }

  const spanById = new Map();
  for (const tab of tabs) {
    if (typeof tab.groupId !== "number" || tab.groupId === TAB_GROUP_ID_NONE) continue;

    let span = spanById.get(tab.groupId);
    if (!span) {
      span = { minIndex: tab.index, maxIndex: tab.index, length: 0 };
      spanById.set(tab.groupId, span);
    }
    if (tab.index < span.minIndex) span.minIndex = tab.index;
    if (tab.index > span.maxIndex) span.maxIndex = tab.index;
    span.length += 1;
  }

  const ordered = [];
  for (const [id, span] of spanById) {
    if (span.length === 0) continue;
    ordered.push(groupRecord(id, span, metaById.get(id)));
  }

  const listed = new Set(ordered.map((group) => group.id));
  for (const [id, meta] of metaById) {
    if (listed.has(id)) continue;
    ordered.push(groupRecord(id, {
      minIndex: NO_STRIP_INDEX,
      maxIndex: NO_STRIP_INDEX,
      length: 0,
    }, meta));
  }

  ordered.sort((a, b) => a.minIndex - b.minIndex || a.id - b.id);
  return ordered;
}

/**
 * Tab insertion index for `chrome.tabGroups.move`, or null if there is no
 * neighboring group that way. The index is applied AFTER this group is
 * removed from the strip. Neighbors are groups, not ungrouped or pinned tabs.
 *
 * Left inserts at the previous group's minIndex (those tabs sit further left,
 * so removing the mover does not shift them). Right inserts at
 * `(next.maxIndex + 1) - mover.length`, which is the slot just after the next
 * group once the mover has been pulled out. Do not pass -1 for "one group
 * right"; -1 means the end of the window.
 *
 * One move cannot keep ungrouped tabs between the two swapped groups. Those
 * tabs stay beside the group that was not the insertion anchor. Do not try
 * to repair that with tabs.move.
 *
 * @param {Array<{id: number, minIndex: number, maxIndex: number, length: number}>} orderedGroups
 * @param {number} groupId
 * @param {"left" | "right"} direction
 * @returns {number | null}
 */
export function neighborMoveIndex(orderedGroups, groupId, direction) {
  const index = orderedGroups.findIndex((group) => group.id === groupId);
  if (index < 0) return null;

  const mover = orderedGroups[index];
  if (direction === "left") {
    for (let i = index - 1; i >= 0; i -= 1) {
      const previous = orderedGroups[i];
      if (!hasStripIndex(previous)) continue;
      return previous.minIndex;
    }
    return null;
  }

  if (direction === "right") {
    for (let i = index + 1; i < orderedGroups.length; i += 1) {
      const next = orderedGroups[i];
      if (!hasStripIndex(next)) continue;
      return next.maxIndex + 1 - mover.length;
    }
    return null;
  }

  return null;
}
