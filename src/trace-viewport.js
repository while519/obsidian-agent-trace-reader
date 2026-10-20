"use strict";

/**
 * Capture/restore the reading viewport without depending on the Obsidian API.
 * A stable rendered event anchor is preferred to raw scrollTop when the trace
 * grows; the original pixel position is retained as a safe fallback.
 */
function findScrollContainer(root) {
  let node = root;
  while (node) {
    const size = Number(node.scrollHeight) - Number(node.clientHeight);
    if (size > 1 && Number(node.clientHeight) > 0) {
      const overflow = typeof getComputedStyle === "function"
        ? getComputedStyle(node).overflowY
        : "auto";
      if (/auto|scroll|overlay/.test(overflow)) return node;
    }
    node = node.parentElement;
  }
  return root.closest?.(".view-content") || root;
}

function findAnchor(root, id) {
  if (!id) return null;
  for (const el of root.querySelectorAll("[data-atr-anchor]")) {
    if (el.getAttribute("data-atr-anchor") === id) return el;
  }
  return null;
}

function captureViewport(root) {
  const scroll = findScrollContainer(root);
  const frame = scroll.getBoundingClientRect();
  const toolbar = root.querySelector(".atr-trace-toolbar");
  const toolbarHeight = toolbar?.getBoundingClientRect().height || 0;
  const threshold = frame.top + toolbarHeight + 8;
  let chosen = null;
  let distance = Infinity;
  for (const el of root.querySelectorAll("[data-atr-anchor]")) {
    const rect = el.getBoundingClientRect();
    if (rect.bottom < threshold || rect.top > frame.bottom) continue;
    const diff = Math.abs(rect.top - threshold);
    if (diff < distance) {
      chosen = { id: el.getAttribute("data-atr-anchor"), offset: rect.top - frame.top };
      distance = diff;
    }
  }
  const internalScroll = [".atr-explorer-tree", ".atr-explorer-inspector-content"]
    .flatMap(selector => Array.from(root.querySelectorAll(selector)).map((element, index) => ({
      selector, index, scrollTop: element.scrollTop, scrollLeft: element.scrollLeft,
    })));
  return {
    scroll,
    scrollTop: scroll.scrollTop,
    scrollLeft: scroll.scrollLeft,
    anchor: chosen,
    internalScroll,
  };
}

function restoreViewport(root, snapshot) {
  if (!snapshot?.scroll) return;
  const scroll = snapshot.scroll;
  scroll.scrollTop = snapshot.scrollTop;
  scroll.scrollLeft = snapshot.scrollLeft;
  const element = findAnchor(root, snapshot.anchor?.id);
  if (element) {
    const next = element.getBoundingClientRect().top;
    const expected = scroll.getBoundingClientRect().top + snapshot.anchor.offset;
    scroll.scrollTop += next - expected;
  }
  for (const item of snapshot.internalScroll || []) {
    const current = root.querySelectorAll(item.selector)[item.index];
    if (!current) continue;
    current.scrollTop = item.scrollTop;
    current.scrollLeft = item.scrollLeft;
  }
}

module.exports = { findScrollContainer, captureViewport, restoreViewport };
