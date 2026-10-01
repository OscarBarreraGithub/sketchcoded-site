/**
 * Copy only public website files into a directory ready for any static host.
 *
 * Pages are never cached, but hosts let browsers keep stylesheets, scripts and images for hours.
 * So every reference from a page (and the example's board, which demo.js fetches) gets a
 * fingerprint of the file it points to, `styles.css?v=…`: after a deploy, a browser fetches the
 * new files instead of mixing a new page with yesterday's stylesheet or script.
 */
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export async function stageSite(
  source = root,
  destination = path.join(source, ".site-dist"),
) {
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  for (const name of [
    "index.html",
    "404.html",
    "styles.css",
    "links.js",
    "demo.html",
    "demo.css",
    "demo.js",
    "_headers",
    "_redirects",
    "assets",
    "example",
  ])
    await cp(path.join(source, name), path.join(destination, name), {
      recursive: true,
    });
  await fingerprint(destination);
  return destination;
}

const fingerprints = new Map();
async function versionOf(destination, file) {
  if (!fingerprints.has(file)) {
    const body = await readFile(path.join(destination, file)).catch(() => null);
    fingerprints.set(
      file,
      body && createHash("sha256").update(body).digest("hex").slice(0, 10),
    );
  }
  return fingerprints.get(file);
}
async function versioned(destination, text, pattern) {
  let out = "",
    last = 0;
  for (const match of text.matchAll(pattern)) {
    const { before, slash, file } = match.groups;
    const version = await versionOf(destination, file);
    out += text.slice(last, match.index);
    out += version ? `${before}${slash}${file}?v=${version}` : match[0];
    last = match.index + match[0].length;
  }
  return out + text.slice(last);
}
async function fingerprint(destination) {
  fingerprints.clear();
  for (const name of await readdir(destination)) {
    const file = path.join(destination, name);
    if (name.endsWith(".html")) {
      // A local href or src, relative or from the root, without a query or fragment.
      const local =
        /(?<before>(?:href|src)=")(?<slash>\/?)(?<file>(?![a-z]+:)[^"?#]+\.(?:css|js|svg|png|webp|json))(?=")/g;
      await writeFile(
        file,
        await versioned(destination, await readFile(file, "utf8"), local),
      );
    } else if (name === "demo.js") {
      const board = /(?<before>")(?<slash>)(?<file>example\/board\.json)(?=")/g;
      await writeFile(
        file,
        await versioned(destination, await readFile(file, "utf8"), board),
      );
    }
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  console.log(`Public site staged at ${await stageSite()}`);
}
