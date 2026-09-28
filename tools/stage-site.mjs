/** Copy only public website files into a directory ready for any static host. */
import { cp, mkdir, rm } from "node:fs/promises";
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
    "guide.html",
    "styles.css",
    "links.js",
    "demo.html",
    "demo.css",
    "demo.js",
    "_headers",
    "assets",
    "example",
  ])
    await cp(path.join(source, name), path.join(destination, name), {
      recursive: true,
    });
  return destination;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  console.log(`Public site staged at ${await stageSite()}`);
}
