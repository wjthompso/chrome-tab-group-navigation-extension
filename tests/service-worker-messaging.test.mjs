import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { handleSceneMessage } from '../lib/scene-message-handler.js';
import { TAB_SCENES } from '../lib/storage-keys.js';

const NONE = -1;

describe('scene message handler', () => {
  // FBT-E001 — Bug Check
  test('Saving a scene replies to the popup even while the service worker is busy with queued work.', async () => {
    const api = fakeChrome({
      tabs: [{ id: 1, windowId: 1, index: 0, groupId: 4, url: 'https://mail.example/' }],
      groups: [{ id: 4, windowId: 1, title: 'Mail', color: 'red', collapsed: false }],
    });

    // Simulate writeChain being permanently occupied — it never resolves.
    const neverResolves = new Promise(() => {});

    // handleSceneMessage must win the race without waiting on neverResolves.
    const result = await Promise.race([
      handleSceneMessage({ type: 'save-tab-scene', slot: 1, windowId: 1 }, api),
      neverResolves,
    ]);

    assert.equal(result.ok, true);
  });

  test('Opening an empty scene slot returns a failure without closing the tab row.', async () => {
    const api = fakeChrome({
      tabs: [{ id: 1, windowId: 1, index: 0, groupId: NONE, url: 'https://a.example/' }],
    });

    const result = await handleSceneMessage({ type: 'open-tab-scene', slot: 2, windowId: 1 }, api);

    assert.equal(result.ok, false);
    assert.equal(api.calls.some((call) => call[0] === 'remove'), false);
  });

  test('An unrecognized message type returns null.', async () => {
    const api = fakeChrome({});

    const result = await handleSceneMessage({ type: 'unknown' }, api);

    assert.equal(result, null);
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
        if (typeof info.windowId === 'number') {
          return state.groups.filter((group) => group.windowId === info.windowId);
        }
        return state.groups;
      },
      async update(id, props) {
        calls.push(['update', id, props]);
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
        if (typeof info.windowId === 'number') {
          return state.tabs.filter((tab) => tab.windowId === info.windowId);
        }
        return state.tabs;
      },
      async ungroup(ids) {
        const list = Array.isArray(ids) ? ids : [ids];
        calls.push(['ungroup', list]);
        for (const id of list) {
          const tab = state.tabs.find((item) => item.id === id);
          if (tab) tab.groupId = NONE;
        }
      },
      async create(props) {
        calls.push(['create', props.url]);
        if (String(props.url).startsWith('chrome:')) throw new Error('cannot open');
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
        calls.push(['remove', list]);
        state.tabs = state.tabs.filter((tab) => !list.includes(tab.id));
      },
      async group({ tabIds }) {
        calls.push(['group', tabIds]);
        const id = nextGroupId;
        nextGroupId += 1;
        for (const tabId of tabIds) {
          const tab = state.tabs.find((item) => item.id === tabId);
          if (tab) tab.groupId = id;
        }
        state.groups.push({ id, title: '', color: 'grey', collapsed: false, windowId: 1 });
        return id;
      },
      async update(id, props) {
        calls.push(['activate', id, props]);
        return { id, ...props };
      },
    },
    storage: {
      local: area(state.local),
      session: area(state.session),
    },
  };
}
