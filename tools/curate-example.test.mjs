import { test } from "node:test";
import assert from "node:assert/strict";
import { curateExample } from "./curate-example.mjs";

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
  assert.deepEqual(result.standardPages, project.standardPages);
  assert.deepEqual(result.ideas, [{ screenId: "home" }]);
  assert.equal(result.assets.length, 4);
  assert.deepEqual(result.layout, { home: { x: 1 } });
  assert.deepEqual(project, original);
});
