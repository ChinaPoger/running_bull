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
assert(!src.includes("SLIDE_DURATION"), "duck is not a fixed short timer");
assert(src.includes("function slidePoseHeld"), "duck pose tracks the bar");
assert(src.includes("function obstacleSlideClearable"), "slide-clearable kinds are explicit");

function grab(name) {
  const m = src.match(new RegExp("const " + name + " = ([0-9.]+)"));
  if (!m) throw new Error("missing " + name);
  return Number(m[1]);
}

const HIT_Z_MIN = grab("HIT_Z_MIN");
const HIT_Z_MAX = grab("HIT_Z_MAX");
const SLIDE_LEAD_Z = grab("SLIDE_LEAD_Z");
const SLIDE_EXIT_PAD = grab("SLIDE_EXIT_PAD");
const SLIDE_MIN_Z = grab("SLIDE_MIN_Z");
const SLIDE_MAX_Z = grab("SLIDE_MAX_Z");
const SPEED_START = grab("SPEED_START");
const SPEED_MAX = grab("SPEED_MAX");
const CHILL_SPEED_START = grab("CHILL_SPEED_START");

function extractFn(name) {
  const m = src.match(new RegExp("function " + name + "\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}"));
  if (!m) throw new Error(name + " not found");
  return m[0];
}

const slideApi = new Function(
  [
    "const HIT_Z_MIN = " + HIT_Z_MIN + ";",
    "const HIT_Z_MAX = " + HIT_Z_MAX + ";",
    "const SLIDE_LEAD_Z = " + SLIDE_LEAD_Z + ";",
    "const SLIDE_EXIT_PAD = " + SLIDE_EXIT_PAD + ";",
    "const SLIDE_MIN_Z = " + SLIDE_MIN_Z + ";",
    "const SLIDE_MAX_Z = " + SLIDE_MAX_Z + ";",
    extractFn("obstacleSlideClearable"),
    extractFn("slidePoseHeld"),
    "return { obstacleSlideClearable, slidePoseHeld };",
  ].join("\n")
)();
const { obstacleSlideClearable, slidePoseHeld } = slideApi;

assert(obstacleSlideClearable(high) === true, "high bar is slide-clearable");
assert(obstacleSlideClearable(box) === true, "low box is slide-clearable");
assert(obstacleSlideClearable(train) === false, "train is not slide-clearable");
assert(slidePoseHeld(SLIDE_MIN_Z, [{ z: 0.5, alive: true, duckOnly: true, tall: false }]) === true, "pose holds while the bar is approaching");
assert(slidePoseHeld(SLIDE_MIN_Z, [{ z: HIT_Z_MAX + SLIDE_EXIT_PAD, alive: true, duckOnly: true, tall: false }]) === false, "pose releases once the bar clears the window");
assert(slidePoseHeld(SLIDE_MIN_Z, [{ z: 0.5, alive: true, duckOnly: false, tall: true }]) === false, "a train does not keep the duck held");
assert(slidePoseHeld(0.05, []) === true, "empty-lane duck still plays a short slide");
assert(slidePoseHeld(SLIDE_MAX_Z, [{ z: 0.5, alive: true, duckOnly: true, tall: false }]) === false, "duck cannot hold forever");

/** Same z step as update(): (moveSpeed / 420) * (chill ? 0.42 : 0.50). */
function zSpeedOf(moveSpeed, chill) {
  return (moveSpeed / 420) * (chill ? 0.42 : 0.5);
}

/**
 * Mirrors update order: advance the bar, resolve the hit while the pose is
 * still the previous frame's pose, then release the duck.
 * Old runs used a fixed 0.42s timer that ended before this window.
 */
function simulateDuck(zSpeed, z0, dt, kind) {
  let z = z0;
  let travel = 0;
  let sliding = true;
  let died = false;
  let releasedAt = null;
  const spec = kind === "train" ? train : kind === "box" ? box : high;
  for (let n = 0; n < 8000 && z < 1.6; n++) {
    z += zSpeed * dt;
    if (z >= HIT_Z_MIN && z <= HIT_Z_MAX) {
      const cleared = obstacleClearedBy(pose({ sliding: sliding }), spec);
      if (!cleared) died = true;
    }
    if (sliding) {
      travel += zSpeed * dt;
      const held = slidePoseHeld(travel, [Object.assign({ z: z, alive: true }, spec)]);
      if (!held) {
        sliding = false;
        releasedAt = z;
      }
    }
    if (!sliding && z > HIT_Z_MAX + SLIDE_EXIT_PAD) break;
  }
  return { died: died, releasedAt: releasedAt, sliding: sliding, z: z };
}

function simulateOldFixedSlide(zSpeed, z0, dt) {
  let z = z0;
  let slideT = 0;
  let sliding = true;
  let died = false;
  for (let n = 0; n < 8000 && z < 1.6; n++) {
    slideT += dt;
    if (slideT >= 0.42) sliding = false;
    z += zSpeed * dt;
    if (z >= HIT_Z_MIN && z <= HIT_Z_MAX && !sliding) died = true;
    if (z > HIT_Z_MAX) break;
  }
  return died;
}

const speeds = [
  ["earth-start", zSpeedOf(SPEED_START, false)],
  ["earth-max", zSpeedOf(SPEED_MAX, false)],
  ["chill-start", zSpeedOf(CHILL_SPEED_START, true)],
];
const duckStarts = [0.0, 0.4, 0.55, 0.72];
for (const [label, zSpeed] of speeds) {
  for (const z0 of duckStarts) {
    for (const dt of [1 / 60, 1 / 20]) {
      const run = simulateDuck(zSpeed, z0, dt, "high");
      assert(!run.died, label + " duck from z=" + z0 + " dt=" + dt.toFixed(3) + " dies under the tall bar");
      assert(run.releasedAt == null || run.releasedAt > HIT_Z_MAX, label + " stood up inside the tall bar");
    }
  }
  assert(simulateOldFixedSlide(zSpeed, 0.45, 1 / 60) === true, label + " old 0.42s duck from mid-approach still dies");
  const late = simulateDuck(zSpeed, 0.5, 1 / 60, "box");
  assert(!late.died, label + " duck still clears a low box");
  const jumped = simulateDuck(zSpeed, 0.72, 1 / 60, "train");
  assert(jumped.died, label + " duck still hits a train");
}

const stand = simulateDuck(zSpeedOf(SPEED_START, false), 0.5, 1 / 60, "high");
assert(stand.releasedAt == null || stand.releasedAt > HIT_Z_MAX, "release is past the kill window");

console.log("portrait obstacle rules OK");
