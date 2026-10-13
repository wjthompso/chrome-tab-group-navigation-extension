import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  TAB_GROUP_ID_NONE,
  buildOrderedGroups,
  chooseListedWindow,
  groupIdsMissingTabs,
  groupIdsOnTabs,
  groupsIncludingActive,
  resolveActiveGroupId,
  mergeTabs,
  neighborMoveIndex,
} from "../lib/group-move.js";

const WORK = 10;
const RESEARCH = 20;
const PERSONAL = 30;

/**
 * 0 pinned ungrouped
 * 1-2 Work
 * 3 ungrouped
 * 4-6 Research (length 3)
 * 7-8 Personal
 */
function exampleTabs() {
  return [
    { index: 4, groupId: RESEARCH },
    { index: 0, groupId: TAB_GROUP_ID_NONE, pinned: true },
    { index: 8, groupId: PERSONAL },
    { index: 2, groupId: WORK },
    { index: 3, groupId: TAB_GROUP_ID_NONE },
    { index: 1, groupId: WORK },
    { index: 6, groupId: RESEARCH },
    { index: 7, groupId: PERSONAL },
    { index: 5, groupId: RESEARCH },
  ];
}

function exampleGroups(collapsed) {
  return [
    { id: PERSONAL, title: "Personal", color: "pink", collapsed },
    { id: WORK, title: "Work", color: "blue", collapsed },
    { id: 99, title: "Empty", color: "grey", collapsed: true },
    { id: RESEARCH, title: "Research", color: "green", collapsed },
  ];
}

/** Apply a post-removal insertion index. This mirrors tabGroups.move, not tabs.move. */
function applyGroupMove(tabs, groupId, insertIndex) {
  const sorted = [...tabs].sort((a, b) => a.index - b.index);
  const moving = sorted.filter((tab) => tab.groupId === groupId);
  const rest = sorted.filter((tab) => tab.groupId !== groupId);
  const next = rest.slice(0, insertIndex).concat(moving, rest.slice(insertIndex));
  return next.map((tab, index) => ({ ...tab, index }));
}

function groupIdSequence(tabs) {
  return [...tabs].sort((a, b) => a.index - b.index).map((tab) => tab.groupId);
}

function groupTitleOrder(tabs, titleById) {
  const order = [];
  for (const tab of [...tabs].sort((a, b) => a.index - b.index)) {
    if (tab.groupId === TAB_GROUP_ID_NONE) continue;
    if (order.at(-1) !== tab.groupId) order.push(tab.groupId);
  }
  return order.map((id) => titleById.get(id));
}

const TITLES = new Map([
  [WORK, "Work"],
  [RESEARCH, "Research"],
  [PERSONAL, "Personal"],
]);

describe("buildOrderedGroups", () => {
  test("orders groups by strip position and still lists a group with no tabs", () => {
    const ordered = buildOrderedGroups(exampleTabs(), exampleGroups(false));
    assert.deepEqual(
      ordered.map((group) => group.title),
      ["Work", "Research", "Personal", "Empty"],
    );
    assert.equal(ordered.at(-1).id, 99);
    assert.equal(ordered.at(-1).length, 0);
    assert.deepEqual(
      ordered.slice(0, 3).map((group) => [group.minIndex, group.maxIndex, group.length]),
      [
        [1, 2, 2],
        [4, 6, 3],
        [7, 8, 2],
      ],
    );
  });

  test("tab-less groups sort after known indexes, stable by id", () => {
    const ordered = buildOrderedGroups(
      [
        { index: 2, groupId: WORK },
        { index: 1, groupId: WORK },
      ],
      [
        { id: 50, title: "Later", collapsed: true },
        { id: 40, title: "", collapsed: false },
        { id: WORK, title: "Work" },
      ],
    );
    assert.deepEqual(ordered.map((group) => group.id), [WORK, 40, 50]);
    assert.equal(ordered[1].title, "");
    assert.equal(ordered[1].collapsed, false);
    assert.equal(ordered[2].collapsed, true);
  });
});

describe("chooseListedWindow", () => {
  test("uses the window that was focused before the popup opened", () => {
    const windows = [
      { id: 1, type: "normal", focused: true },
      { id: 2, type: "normal", focused: false },
    ];
    assert.equal(chooseListedWindow(windows, 2).id, 2);
    assert.equal(chooseListedWindow(windows, null).id, 1);
  });
});

describe("groupIdsOnTabs", () => {
  test("includes the focused tab's group and skips ungrouped tabs", () => {
    assert.deepEqual(groupIdsOnTabs([
      { groupId: TAB_GROUP_ID_NONE, active: false },
      { groupId: 40, active: true },
      { groupId: 40, active: false },
      { groupId: 10, active: false },
    ]), [40, 10]);
  });
});

describe("resolveActiveGroupId", () => {
  test("uses the group remembered before the popup opened when the live tab looks ungrouped", () => {
    assert.equal(resolveActiveGroupId(TAB_GROUP_ID_NONE, 40), 40);
    assert.equal(resolveActiveGroupId(undefined, 40), 40);
  });

  test("prefers the live group id when the popup can see it", () => {
    assert.equal(resolveActiveGroupId(WORK, 40), WORK);
    assert.equal(resolveActiveGroupId(TAB_GROUP_ID_NONE, TAB_GROUP_ID_NONE), null);
  });
});

describe("groupsIncludingActive", () => {
  test("includes a group that only the active tab knew about, once its tabs are merged", () => {
    const current = 40;
    const before = buildOrderedGroups(exampleTabs(), exampleGroups(false));
    assert.equal(before.some((group) => group.id === current), false);

    const groups = groupsIncludingActive(exampleGroups(false), current, {
      id: current,
      title: "Here",
      color: "cyan",
      collapsed: false,
    });
    const stillMissingTabs = buildOrderedGroups(exampleTabs(), groups);
    assert.equal(stillMissingTabs.filter((group) => group.id === current).length, 1);

    const tabs = mergeTabs(exampleTabs(), [{ id: 70, index: 9, groupId: current }]);
    const ordered = buildOrderedGroups(tabs, groups);
    const rows = ordered.filter((group) => group.id === current);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].title, "Here");
    assert.equal(rows[0].minIndex, 9);
    assert.equal(rows[0].length, 1);
    assert.deepEqual(ordered.map((group) => group.id), [WORK, RESEARCH, PERSONAL, current, 99]);
  });

  test("does not invent a group for an ungrouped active tab", () => {
    const groups = groupsIncludingActive(exampleGroups(false), TAB_GROUP_ID_NONE);
    assert.equal(groups.some((group) => group.id === TAB_GROUP_ID_NONE), false);
    const ordered = buildOrderedGroups(exampleTabs(), groups);
    assert.equal(ordered.some((group) => group.id === TAB_GROUP_ID_NONE), false);
  });

  test("an active group already queried is not duplicated", () => {
    const groups = groupsIncludingActive(exampleGroups(false), WORK, { id: WORK, title: "Other" });
    assert.equal(groups.filter((group) => group.id === WORK).length, 1);
    assert.equal(groups.find((group) => group.id === WORK).title, "Work");
  });
});

describe("groupIdsMissingTabs", () => {
  test("lists queried groups with no tabs, and the active group when both queries missed it", () => {
    const tabs = exampleTabs().filter((tab) => tab.groupId !== WORK);
    const groups = exampleGroups(false).filter((group) => group.id !== WORK);

    assert.deepEqual(groupIdsMissingTabs(tabs, groups, WORK), [99, WORK]);
    assert.deepEqual(groupIdsMissingTabs(exampleTabs(), exampleGroups(false), WORK), [99]);
    assert.deepEqual(groupIdsMissingTabs(exampleTabs(), exampleGroups(false), TAB_GROUP_ID_NONE), [99]);
    assert.equal(groupIdsMissingTabs(exampleTabs(), exampleGroups(false), null).includes(TAB_GROUP_ID_NONE), false);
  });

  test("recovered tabs put the omitted group back in strip order", () => {
    const tabs = exampleTabs().filter((tab) => tab.groupId !== WORK);
    const recovered = [
      { id: 11, index: 1, groupId: WORK },
      { id: 12, index: 2, groupId: WORK },
    ];
    const ordered = buildOrderedGroups(mergeTabs(tabs, recovered), exampleGroups(false));

    assert.deepEqual(ordered.map((group) => group.title), ["Work", "Research", "Personal", "Empty"]);
    assert.deepEqual(
      ordered.filter((group) => group.id !== 99).map((group) => group.id),
      [WORK, RESEARCH, PERSONAL],
    );
    assert.equal(ordered.at(-1).id, 99);
  });

  test("a later copy replaces a stale tab and strip order wins over title order", () => {
    const stale = [
      { id: 1, index: 4, groupId: TAB_GROUP_ID_NONE },
      { id: 2, index: 0, groupId: 1 },
      { id: 3, index: 1, groupId: 1 },
    ];
    const groups = [
      { id: 2, title: "Alpha" },
      { id: 1, title: "Zulu" },
    ];
    const recovered = [
      { id: 1, index: 4, groupId: 2 },
      { id: 4, index: 5, groupId: 2 },
    ];
    const ordered = buildOrderedGroups(mergeTabs(stale, recovered), groups);

    assert.deepEqual(ordered.map((group) => group.title), ["Zulu", "Alpha"]);
    assert.deepEqual(
      ordered.map((group) => [group.minIndex, group.maxIndex, group.length]),
      [
        [0, 1, 2],
        [4, 5, 2],
      ],
    );
  });
});

describe("neighborMoveIndex", () => {
  test("Research right jumps past Personal; the loose tab stays left of Personal", () => {
    const tabs = exampleTabs();
    const ordered = buildOrderedGroups(tabs, exampleGroups(false));
    const index = neighborMoveIndex(ordered, RESEARCH, "right");

    assert.equal(index, 6);
    assert.notEqual(index, -1);

    const moved = applyGroupMove(tabs, RESEARCH, index);
    assert.deepEqual(groupTitleOrder(moved, TITLES), ["Work", "Personal", "Research"]);
    assert.deepEqual(groupIdSequence(moved), [
      TAB_GROUP_ID_NONE,
      WORK,
      WORK,
      TAB_GROUP_ID_NONE,
      PERSONAL,
      PERSONAL,
      RESEARCH,
      RESEARCH,
      RESEARCH,
    ]);
  });

  test("Research left swaps with Work; the loose tab cannot stay between them", () => {
    const tabs = exampleTabs();
    const ordered = buildOrderedGroups(tabs, exampleGroups(false));
    const index = neighborMoveIndex(ordered, RESEARCH, "left");

    assert.equal(index, 1);

    const moved = applyGroupMove(tabs, RESEARCH, index);
    assert.deepEqual(groupTitleOrder(moved, TITLES), ["Research", "Work", "Personal"]);
    // One group move has a single insertion index, so the ungrouped tab that
    // sat between Work and Research ends up after Work (still before Personal).
    assert.deepEqual(groupIdSequence(moved), [
      TAB_GROUP_ID_NONE,
      RESEARCH,
      RESEARCH,
      RESEARCH,
      WORK,
      WORK,
      TAB_GROUP_ID_NONE,
      PERSONAL,
      PERSONAL,
    ]);
  });

  test("contiguous A B C: B right yields A C B at the post-removal index", () => {
    const tabs = [
      { index: 0, groupId: 1 },
      { index: 1, groupId: 1 },
      { index: 2, groupId: 2 },
      { index: 3, groupId: 2 },
      { index: 4, groupId: 2 },
      { index: 5, groupId: 3 },
      { index: 6, groupId: 3 },
    ];
    const groups = [
      { id: 1, title: "A", collapsed: false },
      { id: 2, title: "B", collapsed: false },
      { id: 3, title: "C", collapsed: false },
    ];
    const ordered = buildOrderedGroups(tabs, groups);
    // C.maxIndex + 1 - B.length = 7 - 3 = 4
    const index = neighborMoveIndex(ordered, 2, "right");

    assert.equal(index, 4);
    assert.deepEqual(groupTitleOrder(applyGroupMove(tabs, 2, index), new Map([[1, "A"], [2, "B"], [3, "C"]])), [
      "A",
      "C",
      "B",
    ]);
  });

  test("contiguous A B C: B left yields B A C", () => {
    const tabs = [
      { index: 0, groupId: 1 },
      { index: 1, groupId: 1 },
      { index: 2, groupId: 2 },
      { index: 3, groupId: 2 },
      { index: 4, groupId: 2 },
      { index: 5, groupId: 3 },
      { index: 6, groupId: 3 },
    ];
    const groups = [
      { id: 1, title: "A" },
      { id: 2, title: "B" },
      { id: 3, title: "C" },
    ];
    const ordered = buildOrderedGroups(tabs, groups);
    const index = neighborMoveIndex(ordered, 2, "left");

    assert.equal(index, 0);
    assert.deepEqual(
      groupTitleOrder(applyGroupMove(tabs, 2, index), new Map([[1, "A"], [2, "B"], [3, "C"]])),
      ["B", "A", "C"],
    );
  });

  test("leftmost left and rightmost right are no-ops", () => {
    const ordered = buildOrderedGroups(exampleTabs(), exampleGroups(false));
    assert.equal(neighborMoveIndex(ordered, WORK, "left"), null);
    assert.equal(neighborMoveIndex(ordered, PERSONAL, "right"), null);
    assert.equal(neighborMoveIndex(ordered, 404, "left"), null);
  });

  test("collapsed flag does not change the index math", () => {
    const expanded = buildOrderedGroups(exampleTabs(), exampleGroups(false));
    const collapsed = buildOrderedGroups(exampleTabs(), exampleGroups(true));

    assert.equal(collapsed.every((group) => group.collapsed), true);
    assert.equal(
      neighborMoveIndex(collapsed, RESEARCH, "right"),
      neighborMoveIndex(expanded, RESEARCH, "right"),
    );
    assert.equal(
      neighborMoveIndex(collapsed, RESEARCH, "left"),
      neighborMoveIndex(expanded, RESEARCH, "left"),
    );
    assert.equal(neighborMoveIndex(collapsed, RESEARCH, "right"), 6);
    assert.equal(neighborMoveIndex(collapsed, RESEARCH, "left"), 1);
  });
});
