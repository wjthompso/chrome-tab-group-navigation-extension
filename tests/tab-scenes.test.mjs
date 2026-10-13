import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { openTabScene, saveTabScene } from "../lib/tab-scene-actions.js";
import {
  EXTENSION_CREATED_FINGERPRINTS,
  EXTENSION_CREATED_GROUPS,
  TAB_SCENES,
} from "../lib/storage-keys.js";
import {
  captureScene,
  fingerprintsStillOpen,
  groupsToUngroup,
  sceneSlotFromCommand,
  sceneSlotFromKeyEvent,
  sceneSummary,
} from "../lib/tab-scenes.js";

const NONE = -1;

describe("scene slots", () => {
  test("number keys and the matching shortcuts page command use slots 1 through 9", () => {
    assert.equal(sceneSlotFromKeyEvent({ code: "Digit1", key: "1", shiftKey: false }), 1);
    assert.equal(sceneSlotFromKeyEvent({ code: "Digit9", key: "(", shiftKey: true }), 9);
    assert.equal(sceneSlotFromKeyEvent({ code: "Numpad2", key: "2", shiftKey: false }), 2);
    assert.equal(sceneSlotFromKeyEvent({ code: "Digit0", key: "0", shiftKey: false }), null);
    assert.equal(sceneSlotFromCommand("open-tab-scene-4"), 4);
    assert.equal(sceneSlotFromCommand("group-by-domain"), null);
  });
});

describe("captureScene", () => {
  test("stores colored group labels in tab-row order and skips loose tabs", () => {
    const scene = captureScene([
      { id: 1, index: 0, groupId: NONE, url: "https://loose.example/", pinned: true },
      { id: 2, index: 1, groupId: 4, url: "https://mail.example/" },
      { id: 3, index: 2, groupId: 9, url: "https://linear.example/a" },
      { id: 4, index: 3, groupId: 9, url: "https://linear.example/b" },
    ], [
      { id: 4, title: "Mail", color: "red", collapsed: true },
      { id: 9, title: "Linear", color: "blue", collapsed: false },
    ]);

    assert.deepEqual(scene, {
      groups: [
        { title: "Mail", color: "red", collapsed: true, urls: ["https://mail.example/"] },
        {
          title: "Linear",
          color: "blue",
          collapsed: false,
          urls: ["https://linear.example/a", "https://linear.example/b"],
        },
      ],
    });
    assert.equal(sceneSummary(scene), "Mail, Linear");
  });

  test("is empty when the tab row has no colored group labels", () => {
    assert.equal(captureScene([
      { index: 0, groupId: NONE, url: "https://loose.example/" },
    ], []), null);
    assert.equal(sceneSummary(null), "Empty");
  });
});

describe("groupsToUngroup", () => {
  const mine = { id: 4, title: "Mine", color: "blue", urls: ["https://mine.example/"] };
  const created = { id: 7, title: "Old", color: "red", urls: ["https://old.example/"] };

  test("session id is ungrouped even after the pages change, and a hand-made group is not", () => {
    const edited = { ...created, urls: ["https://edited.example/"] };
    const { ungroupIds, remainingFingerprints } = groupsToUngroup(
      [mine, edited],
      [created],
      [created],
    );
    assert.deepEqual(ungroupIds, [7]);
    assert.deepEqual(remainingFingerprints, []);
  });

  test("after a restart, an exact saved copy is ungrouped and a different group is kept", () => {
    const { ungroupIds, remainingFingerprints } = groupsToUngroup(
      [mine, created],
      [],
      [created],
    );
    assert.deepEqual(ungroupIds, [7]);
    assert.deepEqual(remainingFingerprints, []);
  });

  test("a fingerprint with no open group is dropped", () => {
    assert.deepEqual(fingerprintsStillOpen([created], [mine]), []);
    assert.equal(fingerprintsStillOpen([created], [created]).length, 1);
  });
});

describe("openTabScene", () => {
  test("builds the scene before closing tabs, and ungroups only extension-created groups", async () => {
    const api = fakeChrome({
      tabs: [
        { id: 1, windowId: 1, index: 0, groupId: 4, url: "https://mine.example/a" },
        { id: 2, windowId: 1, index: 1, groupId: 4, url: "https://mine.example/b" },
        { id: 3, windowId: 1, index: 2, groupId: 7, url: "https://old.example/" },
        { id: 4, windowId: 1, index: 3, groupId: NONE, url: "https://loose.example/", pinned: true },
      ],
      groups: [
        { id: 4, windowId: 1, title: "Mine", color: "blue", collapsed: false },
        { id: 7, windowId: 1, title: "Old", color: "red", collapsed: false },
      ],
      local: {
        [TAB_SCENES]: {
          1: {
            groups: [{
              title: "Linear",
              color: "blue",
              collapsed: false,
              urls: ["https://linear.example/a", "https://linear.example/b"],
            }],
          },
        },
        [EXTENSION_CREATED_FINGERPRINTS]: [
          { title: "Old", color: "red", urls: ["https://old.example/"] },
        ],
      },
      session: {
        [EXTENSION_CREATED_GROUPS]: [
          { id: 7, title: "Old", color: "red", urls: ["https://old.example/"] },
        ],
      },
    });

    const result = await openTabScene(api, 1, 1);

    assert.equal(result.ok, true);
    assert.equal(result.message, "Opened scene 1.");
    const names = api.calls.map((call) => call[0]);
    assert.ok(names.indexOf("create") < names.indexOf("group"));
    assert.ok(names.indexOf("group") < names.indexOf("ungroup"));
    assert.ok(names.indexOf("ungroup") < names.indexOf("remove"));
    assert.deepEqual(api.calls.find((call) => call[0] === "ungroup")[1], [3]);
    assert.deepEqual(api.calls.find((call) => call[0] === "remove")[1], [1, 2, 3, 4]);

    const created = api.state.session[EXTENSION_CREATED_GROUPS];
    assert.equal(created.length, 1);
    assert.notEqual(created[0].id, 7);
    assert.deepEqual(created[0].urls, ["https://linear.example/a", "https://linear.example/b"]);
    assert.equal(api.state.local[EXTENSION_CREATED_FINGERPRINTS][0].title, "Linear");
  });

  test("an empty slot does not close the tab row", async () => {
    const api = fakeChrome({ tabs: [{ id: 1, windowId: 1, index: 0, groupId: NONE, url: "https://a.example/" }] });
    const result = await openTabScene(api, 2, 1);
    assert.equal(result.ok, false);
    assert.equal(result.message, "Scene 2 is empty.");
    assert.equal(api.calls.some((call) => call[0] === "remove"), false);
  });

  test("a scene whose pages cannot be opened leaves the tab row alone", async () => {
    const api = fakeChrome({
      tabs: [{ id: 1, windowId: 1, index: 0, groupId: 4, url: "https://mine.example/" }],
      groups: [{ id: 4, windowId: 1, title: "Mine", color: "blue", collapsed: false }],
      local: {
        [TAB_SCENES]: {
          1: { groups: [{ title: "Nope", color: "grey", collapsed: false, urls: ["chrome://settings"] }] },
        },
      },
    });
    const result = await openTabScene(api, 1, 1);
    assert.equal(result.ok, false);
    assert.equal(api.calls.some((call) => call[0] === "remove" || call[0] === "ungroup"), false);
    assert.equal(api.state.tabs.some((tab) => tab.id === 1), true);
  });
});

describe("saveTabScene", () => {
  test("refuses a tab row with no colored group labels", async () => {
    const api = fakeChrome({
      tabs: [{ id: 1, windowId: 1, index: 0, groupId: NONE, url: "https://loose.example/" }],
    });
    const result = await saveTabScene(api, 3, 1);
    assert.equal(result.message, "No tab groups to save.");
    assert.equal(api.state.local[TAB_SCENES], undefined);
  });

  test("first save and a later overwrite use the same slot", async () => {
    const tabs = [{ id: 2, windowId: 1, index: 0, groupId: 4, url: "https://mail.example/" }];
    const groups = [{ id: 4, windowId: 1, title: "Mail", color: "red", collapsed: false }];
    const api = fakeChrome({ tabs, groups });

    const saved = await saveTabScene(api, 3, 1);
    assert.equal(saved.message, "Saved scene 3.");
    assert.equal(api.state.local[TAB_SCENES]["3"].groups[0].title, "Mail");

    api.state.groups[0].title = "Inbox";
    const replaced = await saveTabScene(api, 3, 1);
    assert.equal(replaced.message, "Overwrote scene 3.");
    assert.equal(api.state.local[TAB_SCENES]["3"].groups[0].title, "Inbox");
  });
});

function fakeChrome({ tabs = [], groups = [], local = {}, session = {} }) {
  const calls = [];
  let nextTabId = 100;
  let nextGroupId = 50;
  const state = {
    tabs: tabs.map((tab) => ({ ...tab })),
    groups: groups.map((group) => ({ ...group })),
    local: { ...local },
    session: { ...session },
  };

  function area(bag) {
    return {
      async get(key) {
        if (bag[key] === undefined) return {};
        return { [key]: bag[key] };
      },
      async set(values) {
        Object.assign(bag, values);
      },
    };
  }

  return {
    calls,
    state,
    tabGroups: {
      TAB_GROUP_ID_NONE: NONE,
      async query(info = {}) {
        if (typeof info.windowId === "number") {
          return state.groups.filter((group) => group.windowId === info.windowId);
        }
        return state.groups;
      },
      async update(id, props) {
        calls.push(["update", id, props]);
        const group = state.groups.find((item) => item.id === id);
        if (group) Object.assign(group, props);
        return group;
      },
      async get(id) {
        return state.groups.find((group) => group.id === id);
      },
    },
    tabs: {
      async query(info = {}) {
        if (typeof info.windowId === "number") {
          return state.tabs.filter((tab) => tab.windowId === info.windowId);
        }
        return state.tabs;
      },
      async ungroup(ids) {
        const list = Array.isArray(ids) ? ids : [ids];
        calls.push(["ungroup", list]);
        for (const id of list) {
          const tab = state.tabs.find((item) => item.id === id);
          if (tab) tab.groupId = NONE;
        }
      },
      async create(props) {
        calls.push(["create", props.url]);
        if (String(props.url).startsWith("chrome:")) throw new Error("cannot open");
        const tab = {
          id: nextTabId,
          windowId: props.windowId,
          url: props.url,
          groupId: NONE,
          index: state.tabs.length,
          pinned: false,
        };
        nextTabId += 1;
        state.tabs.push(tab);
        return tab;
      },
      async remove(ids) {
        const list = Array.isArray(ids) ? ids : [ids];
        calls.push(["remove", list]);
        state.tabs = state.tabs.filter((tab) => !list.includes(tab.id));
      },
      async group({ tabIds }) {
        calls.push(["group", tabIds]);
        const id = nextGroupId;
        nextGroupId += 1;
        for (const tabId of tabIds) {
          const tab = state.tabs.find((item) => item.id === tabId);
          if (tab) tab.groupId = id;
        }
        state.groups.push({ id, title: "", color: "grey", collapsed: false, windowId: 1 });
        return id;
      },
      async update(id, props) {
        calls.push(["activate", id, props]);
        return { id, ...props };
      },
    },
    storage: {
      local: area(state.local),
      session: area(state.session),
    },
  };
}
