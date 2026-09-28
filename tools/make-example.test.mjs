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
import { createServer } from "node:http";
import { makeExample } from "./make-example.mjs";

const file = `${"a".repeat(64)}.webp`;
const board = {
  id: "custom-id",
  name: "A new user's board",
  assets: [{ file }],
  screens: [],
  pins: [],
  transitions: [],
  ideas: [],
  standardPages: {},
};

test("custom addresses and board IDs work; failures preserve the existing example", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sketchcoded site "));
  const out = path.join(root, "example");
  let assetStatus = 200;
  let duplicate = false;
  let invalidFile = false;
  const server = createServer((req, res) => {
    if (req.url === "/api/projects")
      res.end(JSON.stringify(duplicate ? [board, board] : [board]));
    else if (req.url === "/api/projects/custom-id/example")
      res.end(
        JSON.stringify(
          invalidFile
            ? { ...board, assets: [{ file: "../../outside.webp" }] }
            : board,
        ),
      );
    else if (req.url === `/assets/${file}`) {
      res.statusCode = assetStatus;
      res.end("drawing bytes");
    } else {
      res.statusCode = 404;
      res.end();
    }
  });
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    await mkdir(out);
    await writeFile(path.join(out, "old.txt"), "keep this on failure");
    assetStatus = 404;
    await assert.rejects(
      makeExample({ base, board: board.name, out }),
      /HTTP 404/,
    );
    assert.equal(
      await readFile(path.join(out, "old.txt"), "utf8"),
      "keep this on failure",
    );
    assetStatus = 200;
    duplicate = true;
    await assert.rejects(
      makeExample({ base, board: board.name, out }),
      /--board-id/,
    );
    invalidFile = true;
    await assert.rejects(
      makeExample({ base, boardId: board.id, out }),
      /Invalid asset filename/,
    );
    assert.equal(
      await readFile(path.join(out, "old.txt"), "utf8"),
      "keep this on failure",
    );
    invalidFile = false;
    const result = await makeExample({ base, boardId: board.id, out });
    assert.deepEqual(result, board);
    assert.deepEqual(
      JSON.parse(await readFile(path.join(out, "board.json"), "utf8")),
      board,
    );
    assert.equal(
      await readFile(path.join(out, "art", file), "utf8"),
      "drawing bytes",
    );
    assert.deepEqual((await readdir(root)).sort(), ["example"]);
    assert.deepEqual((await readdir(out)).sort(), ["art", "board.json"]);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});
