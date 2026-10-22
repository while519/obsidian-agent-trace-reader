"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { captureViewport, findScrollContainer, restoreViewport, readingScrollers, isNearLiveEdge, scrollToLiveEdge } = require("../src/trace-viewport");

function fixture() {
  const scroller = {
    scrollTop: 450,
    scrollLeft: 11,
    scrollHeight: 3500,
    clientHeight: 600,
    parentElement: null,
    getBoundingClientRect() { return { top: 0, bottom: 600, height: 600 }; },
  };
  const data = [{ id: "event-12", y: 500, height: 70 }];
  const makeAnchor = entry => ({
    getAttribute(name) { return name === "data-atr-anchor" ? entry.id : null; },
    getBoundingClientRect() {
      return { top: entry.y - scroller.scrollTop, bottom: entry.y + entry.height - scroller.scrollTop };
    },
  });
  const root = {
    parentElement: scroller,
    scrollHeight: 0,
    clientHeight: 0,
    querySelector(selector) {
      if (selector === ".atr-trace-toolbar") return { getBoundingClientRect() { return { height: 42 }; } };
      return null;
    },
    querySelectorAll(selector) {
      return selector === "[data-atr-anchor]" ? data.map(makeAnchor) : [];
    },
    closest() { return scroller; },
  };
  return { scroller, data, root };
}

test("finds the actual scrolling ancestor, not the inner trace content", () => {
  const { scroller, root } = fixture();
  assert.equal(findScrollContainer(root), scroller);
});

test("refresh restores the same event position after earlier events grow", () => {
  const { scroller, data, root } = fixture();
  const snapshot = captureViewport(root);
  assert.equal(snapshot.anchor.id, "event-12");
  assert.equal(snapshot.anchor.offset, 50);
  data[0].y += 220; // additional trace material appeared above the reader
  scroller.scrollTop = 0; // DOM replacement briefly reset layout
  restoreViewport(root, snapshot);
  assert.equal(scroller.scrollTop, 670);
  assert.equal(scroller.scrollLeft, 11);
  assert.equal(data[0].y - scroller.scrollTop, 50);
});

test("restores scrollTop if a stable anchor is no longer in the refreshed view", () => {
  const { scroller, data, root } = fixture();
  const snapshot = captureViewport(root);
  data.length = 0;
  scroller.scrollTop = 0;
  restoreViewport(root, snapshot);
  assert.equal(scroller.scrollTop, 450);
});

test("ignores missing snapshots and tolerates no anchored events", () => {
  const { root, data } = fixture();
  data.length = 0;
  const snapshot = captureViewport(root);
  assert.equal(snapshot.anchor, null);
  assert.doesNotThrow(() => restoreViewport(root, null));
});

test("restores nested Explorer list and inspector scrolling", () => {
  const { root } = fixture();
  const list = { scrollTop: 180, scrollLeft: 0 };
  const details = { scrollTop: 420, scrollLeft: 14 };
  const baseQuery = root.querySelectorAll;
  root.querySelectorAll = selector => {
    if (selector === ".atr-explorer-tree") return [list];
    if (selector === ".atr-explorer-inspector-content") return [details];
    return baseQuery(selector);
  };
  const snapshot = captureViewport(root);
  list.scrollTop = 0;
  details.scrollTop = 0;
  details.scrollLeft = 0;
  restoreViewport(root, snapshot);
  assert.equal(list.scrollTop, 180);
  assert.equal(details.scrollTop, 420);
  assert.equal(details.scrollLeft, 14);
});

test("auto-follow does not redraw while the user reads an earlier scroll position", () => {
  const { scroller, root } = fixture();
  scroller.scrollTop = 420; // total scrollable range is 2900, far from bottom
  assert.equal(isNearLiveEdge(root), false);
  assert.equal(readingScrollers(root)[0], scroller);
});

test("auto-follow resumes when the reader reaches the live edge", () => {
  const { scroller, root } = fixture();
  scroller.scrollTop = scroller.scrollHeight - scroller.clientHeight - 60;
  assert.equal(isNearLiveEdge(root), true);
  scroller.scrollTop = 0;
  scrollToLiveEdge(root);
  assert.equal(scroller.scrollTop, 2900);
});

test("Explorer search or filtered events prevents automatic replacement", () => {
  const { root, scroller } = fixture();
  scroller.scrollTop = 2900;
  const base = root.querySelector;
  root.querySelector = selector => {
    if (selector === ".atr-explorer-search") return { value: "exec_command" };
    if (selector === ".atr-explorer-filter") return { value: "all" };
    return base(selector);
  };
  assert.equal(isNearLiveEdge(root), false);
  root.querySelector = selector => {
    if (selector === ".atr-explorer-search") return { value: "" };
    if (selector === ".atr-explorer-filter") return { value: "tool-call" };
    return base(selector);
  };
  assert.equal(isNearLiveEdge(root), false);
});

test("Explorer nested scrollers must both be at the live edge", () => {
  const { root, scroller } = fixture();
  scroller.scrollTop = 2900;
  const list = { scrollTop: 50, scrollHeight: 2000, clientHeight: 500 };
  const inspector = { scrollTop: 0, scrollHeight: 900, clientHeight: 400 };
  const base = root.querySelector;
  root.querySelector = selector => selector === ".atr-explorer-tree" ? list :
    selector === ".atr-explorer-inspector-content" ? inspector : base(selector);
  assert.equal(isNearLiveEdge(root), false);
  list.scrollTop = 1500;
  assert.equal(isNearLiveEdge(root), false);
  inspector.scrollTop = 500;
  assert.equal(isNearLiveEdge(root), true);
});
