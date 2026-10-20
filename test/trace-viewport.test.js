"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { captureViewport, findScrollContainer, restoreViewport } = require("../src/trace-viewport");

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
