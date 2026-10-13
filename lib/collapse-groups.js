/**
 * Whether the focused window's groups should all collapse or all expand.
 * Focus does not matter. A group is expanded when `collapsed` is not strictly true.
 *
 * @param {Array<{collapsed?: boolean}>} groups
 * @returns {true | false | null} true collapses every group, false expands every group, null when there are no groups
 */
export function nextCollapsedValue(groups) {
  if (!Array.isArray(groups) || groups.length === 0) return null;
  return groups.some((group) => group.collapsed !== true);
}

/**
 * Collapse this group when it is expanded, and expand it when it is collapsed.
 * Other groups are ignored. A group is expanded when `collapsed` is not strictly true.
 *
 * @param {{collapsed?: boolean} | null | undefined} group
 * @returns {true | false | null} null when there is no group
 */
export function nextCollapsedForGroup(group) {
  if (group == null) return null;
  return group.collapsed !== true;
}
