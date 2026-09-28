import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { stageSite } from "./stage-site.mjs";

test("publishing contains only public files and removes stale staged content", async () => {
  const source = await mkdtemp(path.join(os.tmpdir(), "site staging "));
  try {
    const files = [
      "index.html",
      "guide.html",
      "styles.css",
      "links.js",
      "demo.html",
      "demo.css",
      "demo.js",
      "_headers",
    ];
    for (const file of [...files, "README.md", ".env"])
      await writeFile(path.join(source, file), file);
    for (const dir of [
      "assets",
      "example",
      "tools",
      ".git",
      ".wrangler",
      ".site-dist",
    ]) {
      await mkdir(path.join(source, dir));
      await writeFile(path.join(source, dir, "fixture"), dir);
    }
    const output = await stageSite(source);
    assert.deepEqual(
      (await readdir(output)).sort(),
      [...files, "assets", "example"].sort(),
    );
    assert.equal(
      await readFile(path.join(output, "example/fixture"), "utf8"),
      "example",
    );
  } finally {
    await rm(source, { recursive: true, force: true });
  }
});
