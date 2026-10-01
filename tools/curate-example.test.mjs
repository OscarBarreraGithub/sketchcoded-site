import { test } from "node:test";
import assert from "node:assert/strict";
import { curateExample, unwrittenWants } from "./curate-example.mjs";

test("curation omits isolated backlog without losing drawings, delegated pages or authored routes", () => {
  const project = {
    screens: [
      { id: "home", entry: true, assetId: "web", mobileAssetId: "mobile" },
      { id: "linked", assetId: null },
      { id: "detail", assetId: "detail-art" },
      { id: "ai", assetId: null, leftToAi: true },
      { id: "drawing-only", assetId: "standalone" },
      { id: "notes", assetId: null },
      { id: "backlog", assetId: null },
    ],
    pins: [
      { id: "go", screenId: "home" },
      {
        id: "reference",
        screenId: "home",
        kind: "detail",
        detailTarget: "detail",
      },
      { id: "note", screenId: "notes", kind: "annotation" },
      { id: "back", screenId: "linked" },
    ],
    transitions: [
      { pinId: "go", target: "linked", navigation: "modal" },
      { pinId: "back", target: null, navigation: "dismiss" },
    ],
    ideas: [{ screenId: "home" }, { screenId: "backlog" }, { screenId: null }],
    assets: ["web", "mobile", "detail-art", "standalone", "unused"].map(
      (id) => ({ id }),
    ),
    layout: { home: { x: 1 }, backlog: { x: 2 } },
    standardPages: { ai: { title: "Delegated" } },
  };
  const original = structuredClone(project);
  const result = curateExample(project);
  assert.deepEqual(
    result.screens.map((s) => s.id),
    ["home", "linked", "detail", "ai", "drawing-only", "notes"],
  );
  assert.deepEqual(result.pins, project.pins);
  assert.deepEqual(result.transitions, project.transitions);
  assert.equal(result.standardPages, undefined);
  assert.deepEqual(result.ideas, [{ screenId: "home" }]);
  assert.equal(result.assets.length, 4);
  assert.deepEqual(result.layout, { home: { x: 1 } });
  assert.deepEqual(project, original);
});

test("a frame left out by code takes its paths along, and undrawn pages say what they should do", () => {
  const project = {
    screens: [
      { id: "home", code: "P1", entry: true, assetId: "art" },
      {
        id: "outline",
        code: "P2",
        assetId: null,
        leftToAi: true,
        purpose: "Every screen once.",
      },
      { id: "help", code: "P3", assetId: null, leftToAi: true },
    ],
    pins: [
      { id: "to-outline", screenId: "home", title: "Outline" },
      {
        id: "to-help",
        screenId: "home",
        title: "Help",
        description: "Opens the help.",
      },
      { id: "back", screenId: "outline", title: "Back" },
      { id: "close-help", screenId: "help", title: "Close" },
    ],
    transitions: [
      { pinId: "to-outline", target: "outline", navigation: "push" },
      { pinId: "to-help", target: "help", navigation: "modal" },
      { pinId: "back", target: null, navigation: "back" },
      { pinId: "close-help", target: null, navigation: "dismiss" },
    ],
    ideas: [
      { code: "I1", title: "Each screen once", screenId: "outline" },
      { code: "I2", title: "Search", screenId: "outline" },
      { code: "I3", title: "Shortcuts", screenId: "help" },
    ],
    assets: [{ id: "art" }],
    layout: { home: {}, outline: {}, help: {} },
  };
  const pages = {
    P2: { I1: "list every screen once", "pin 1": "take me back" },
  };
  const result = curateExample(project, { omit: ["P3"], pages });
  assert.deepEqual(
    result.screens.map((s) => s.id),
    ["home", "outline"],
  );
  // The pin that only led to the omitted frame stays, as a note with its own words.
  assert.deepEqual(
    result.pins.find((p) => p.id === "to-help"),
    { ...project.pins[1], kind: "annotation" },
  );
  assert.deepEqual(
    result.transitions.map((t) => t.pinId),
    ["to-outline", "back"],
  );
  assert.deepEqual(
    result.ideas.map((i) => i.code),
    ["I1", "I2"],
  );
  assert.deepEqual(result.screens[1].wants, [
    { text: "list every screen once" },
    { text: "Search" },
    { text: "take me back", pinId: "back" },
  ]);
  assert.equal(result.screens[0].wants, undefined);
  assert.deepEqual(unwrittenWants(result, pages), ["P2 I2 “Search”"]);
});
