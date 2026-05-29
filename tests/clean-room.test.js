import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const blockedPublicNames = [
  "initializeApp",
  "Firestore",
  "Cloud Functions",
  "Firebase Auth",
  "Firebase Storage",
  "Realtime Database"
];

describe("clean-room public surface", () => {
  it("does not introduce blocked product API names outside legal notes", () => {
    const files = walk(process.cwd()).filter((file) => file.includes("/src/") && !file.includes("node_modules"));

    const offenders = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const name of blockedPublicNames) {
        if (text.includes(name)) {
          offenders.push(`${file}: ${name}`);
        }
      }
    }

    assert.deepEqual(offenders, []);
  });
});

function walk(dir) {
  const entries = readdirSync(dir);
  return entries.flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      return walk(path);
    }

    return [path];
  });
}
