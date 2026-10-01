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
      "404.html",
      "styles.css",
      "links.js",
      "demo.html",
      "demo.css",
      "demo.js",
      "_headers",
      "_redirects",
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

test("pages and the example point at fingerprinted files, so a deploy never mixes old and new", async () => {
  const source = await mkdtemp(path.join(os.tmpdir(), "site fingerprints "));
  try {
    const page = `<link rel="stylesheet" href="styles.css" /><img src="assets/logo.svg" /><a href="https://example.com/x.css">out</a><script src="/links.js"></script>`;
    for (const [file, body] of [
      ["index.html", page],
      ["404.html", page],
      ["styles.css", "body{}"],
      ["links.js", "1"],
      ["demo.html", '<script src="demo.js"></script>'],
      ["demo.css", ""],
      ["demo.js", 'fetch("example/board.json")'],
      ["_headers", ""],
      ["_redirects", ""],
    ])
      await writeFile(path.join(source, file), body);
    await mkdir(path.join(source, "assets"));
    await writeFile(path.join(source, "assets/logo.svg"), "<svg/>");
    await mkdir(path.join(source, "example"));
    await writeFile(path.join(source, "example/board.json"), "{}");
    const output = await stageSite(source);
    const index = await readFile(path.join(output, "index.html"), "utf8");
    assert.match(index, /href="styles\.css\?v=[0-9a-f]{10}"/);
    assert.match(index, /src="assets\/logo\.svg\?v=[0-9a-f]{10}"/);
    assert.match(index, /src="\/links\.js\?v=[0-9a-f]{10}"/);
    assert.match(index, /href="https:\/\/example\.com\/x\.css"/);
    assert.match(
      await readFile(path.join(output, "demo.js"), "utf8"),
      /fetch\("example\/board\.json\?v=[0-9a-f]{10}"\)/,
    );
    // The fingerprint follows the content.
    await writeFile(path.join(source, "styles.css"), "body{color:red}");
    const again = await readFile(
      path.join(await stageSite(source), "index.html"),
      "utf8",
    );
    assert.notEqual(
      again.match(/styles\.css\?v=(\w+)/)[1],
      index.match(/styles\.css\?v=(\w+)/)[1],
    );
  } finally {
    await rm(source, { recursive: true, force: true });
  }
});
