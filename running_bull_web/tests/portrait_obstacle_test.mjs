import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const gamePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../public/mobile-web/game.js"
);
const src = fs.readFileSync(gamePath, "utf8");
const match = src.match(/function obstacleClearedBy\(pose, e\) \{[\s\S]*?\n  \}/);
if (!match) {
  throw new Error("obstacleClearedBy not found");
}
const obstacleClearedBy = new Function(`${match[0]}\nreturn obstacleClearedBy;`)();

const pose = (extra) => Object.assign({ invuln: false, wallnut: false, jumping: false, sliding: false }, extra);
const high = { variant: "high_bar", duckOnly: true, tall: false };
const train = { variant: "train", duckOnly: false, tall: true };
const box = { variant: "box", duckOnly: false, tall: false };

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(obstacleClearedBy(pose({ jumping: true }), high) === false, "jump hits high bar");
assert(obstacleClearedBy(pose({ jumping: true, sliding: false }), high) === false, "jump-only hits high bar");
assert(obstacleClearedBy(pose({ sliding: true }), high) === true, "duck clears high bar");
assert(obstacleClearedBy(pose({}), high) === false, "standing hits high bar");
assert(obstacleClearedBy(pose({ invuln: true }), high) === true, "invuln still clears high bar");
assert(obstacleClearedBy(pose({ wallnut: true, jumping: true }), high) === true, "wallnut clears high bar");
assert(obstacleClearedBy(pose({ jumping: true }), train) === true, "jump still clears train");
assert(obstacleClearedBy(pose({ sliding: true }), train) === false, "duck does not clear train");
assert(obstacleClearedBy(pose({ sliding: true }), box) === true, "duck clears low box");
assert(obstacleClearedBy(pose({ jumping: true }), box) === true, "jump clears low box");
assert(obstacleClearedBy(pose({}), box) === false, "standing hits low box");
assert(src.includes("duckOnly: !!v.duckOnly"), "spawn stores duckOnly");
assert(src.includes('variant: "high_bar"'), "high bar is in the spawn mix");
assert(src.includes("function clearAllObstacles"), "paid bomb clears the field");

console.log("portrait obstacle rules OK");
