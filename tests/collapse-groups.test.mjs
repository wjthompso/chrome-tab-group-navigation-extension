import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { nextCollapsedForGroup, nextCollapsedValue } from "../lib/collapse-groups.js";

describe("nextCollapsedValue", () => {
  test("one expanded among collapsed ones collapses all", () => {
    assert.equal(nextCollapsedValue([
      { id: 1, collapsed: true },
      { id: 2, collapsed: false },
      { id: 3, collapsed: true },
    ]), true);
  });

  test("all collapsed expands all", () => {
    assert.equal(nextCollapsedValue([
      { collapsed: true },
      { collapsed: true },
    ]), false);
  });

  test("all expanded collapses all", () => {
    assert.equal(nextCollapsedValue([
      { collapsed: false },
      { collapsed: false },
    ]), true);
  });

  test("empty does nothing", () => {
    assert.equal(nextCollapsedValue([]), null);
  });

  test("a group is expanded when collapsed is not strictly true", () => {
    assert.equal(nextCollapsedValue([{ collapsed: true }, {}]), true);
  });

  // Focus is irrelevant: the same function ignores which group is current.
  test("focus is irrelevant when the expanded group is current", () => {
    const groups = [
      { id: 1, collapsed: true },
      { id: 2, collapsed: false },
    ];
    const expandedMarkedCurrent = [
      { id: 1, collapsed: true },
      { id: 2, collapsed: false, current: true },
    ];
    assert.equal(nextCollapsedValue(expandedMarkedCurrent), nextCollapsedValue(groups));
    assert.equal(nextCollapsedValue(expandedMarkedCurrent), true);
  });
});

describe("nextCollapsedForGroup", () => {
  test("an expanded group collapses", () => {
    assert.equal(nextCollapsedForGroup({ collapsed: false }), true);
  });

  test("a collapsed group expands", () => {
    assert.equal(nextCollapsedForGroup({ collapsed: true }), false);
  });

  test("a group is expanded when collapsed is not strictly true", () => {
    assert.equal(nextCollapsedForGroup({}), true);
  });

  test("no group does nothing", () => {
    assert.equal(nextCollapsedForGroup(null), null);
    assert.equal(nextCollapsedForGroup(undefined), null);
  });

  test("a collapsed current group expands even when another group is expanded", () => {
    const groups = [
      { id: 1, collapsed: false },
      { id: 2, collapsed: true },
    ];
    assert.equal(nextCollapsedValue(groups), true);
    assert.equal(nextCollapsedForGroup(groups[1]), false);
  });
});
