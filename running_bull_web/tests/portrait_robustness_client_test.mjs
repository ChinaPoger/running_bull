/**
 * 竖屏客户端健壮性示例。只读 public/mobile-web/game.js，用 node 跑，不需要浏览器。
 *
 * 更完整的障碍矩阵和 0–120 秒曲线在 portrait_obstacle_test.mjs、
 * portrait_hint_difficulty_test.mjs。这里只留可复制的健壮性例子：
 * 蹲姿对高栏的时机、难度在 120 秒封顶、NaN / 无穷车道。
 *
 * 产品已经挡住的情况直接断言。还没挡住的标了 expectedFail，
 * 输出 EXPECTED_FAIL_UNTIL_FIXED，进程仍以 0 退出。那种例子一旦通过，
 * 脚本会失败，提醒删掉标记。
 *
 * 用法：node tests/portrait_robustness_client_test.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const gamePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../public/mobile-web/game.js"
);
const src = fs.readFileSync(gamePath, "utf8");
const EXAMPLES = [];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function register(fn) {
  EXAMPLES.push(fn);
}

function titleOf(fn) {
  const m = String(fn).match(/\/\*\*\s*([^*]+?)\s*\*\//);
  return (m && m[1].trim()) || fn.name;
}

function grab(name) {
  const m = src.match(new RegExp("const " + name + " = ([0-9.]+)"));
  if (!m) throw new Error("missing " + name);
  return Number(m[1]);
}

function extractFn(name) {
  const m = src.match(new RegExp("function " + name + "\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}"));
  if (!m) throw new Error(name + " not found");
  return m[0];
}

const laneLine = src.match(/const LANE_X = \[[^\]]+\];/);
if (!laneLine) throw new Error("LANE_X missing");
const zLine = src.match(
  /const zSpeed = \(moveSpeed \/ 420\) \* \(mode === "chill" \? ([0-9.]+) : ([0-9.]+)\)/
);
if (!zLine) throw new Error("zSpeed formula missing");

const slideApi = new Function(
  [
    "const HIT_Z_MIN = " + grab("HIT_Z_MIN") + ";",
    "const HIT_Z_MAX = " + grab("HIT_Z_MAX") + ";",
    "const SLIDE_LEAD_Z = " + grab("SLIDE_LEAD_Z") + ";",
    "const SLIDE_EXIT_PAD = " + grab("SLIDE_EXIT_PAD") + ";",
    "const SLIDE_MIN_Z = " + grab("SLIDE_MIN_Z") + ";",
    "const SLIDE_MAX_Z = " + grab("SLIDE_MAX_Z") + ";",
    extractFn("obstacleClearedBy"),
    extractFn("obstacleSlideClearable"),
    extractFn("slidePoseHeld"),
    "return { obstacleClearedBy, obstacleSlideClearable, slidePoseHeld, HIT_Z_MIN, HIT_Z_MAX, SLIDE_EXIT_PAD, SLIDE_MIN_Z, SLIDE_MAX_Z };",
  ].join("\n")
)();

const difficultyCurve = new Function(
  extractFn("difficultyCurve") + "\nreturn difficultyCurve;"
)();

const projectApi = new Function(
  [
    "let mode = 'earth';",
    "let distance = 0;",
    "const LANES = " + grab("LANES") + ";",
    laneLine[0],
    "const ROAD_HALF_FAR = " + grab("ROAD_HALF_FAR") + ";",
    "const ROAD_HALF_NEAR = " + grab("ROAD_HALF_NEAR") + ";",
    "const ROAD_SCALE = " + grab("ROAD_SCALE") + ";",
    "const ROAD_HALF_FAR_SPACE = " + grab("ROAD_HALF_FAR_SPACE") + ";",
    "const ROAD_HALF_NEAR_SPACE = " + grab("ROAD_HALF_NEAR_SPACE") + ";",
    "const CURVE_K_FOREST = " + grab("CURVE_K_FOREST") + ";",
    "const CURVE_AMP_FOREST = " + grab("CURVE_AMP_FOREST") + ";",
    "const CURVE_K_EARTH = " + grab("CURVE_K_EARTH") + ";",
    "const CURVE_AMP_EARTH = " + grab("CURVE_AMP_EARTH") + ";",
    "const CURVE_K_PLANE = " + grab("CURVE_K_PLANE") + ";",
    "const CURVE_AMP_PLANE = " + grab("CURVE_AMP_PLANE") + ";",
    extractFn("curveDx"),
    extractFn("roadHalfPair"),
    extractFn("depthScale"),
    extractFn("project"),
    "return {",
    "  project: project,",
    "  setMode: function (m) { mode = m; },",
    "  setDistance: function (d) { distance = d; },",
    "};",
  ].join("\n")
)();

const planeLaneSrc = src.match(
  /const laneF = Number\.isFinite\(player\.displayLane\) \? player\.displayLane : player\.lane;[\s\S]*?const frac = Math\.max\(0, Math\.min\(1, laneF - lane0\)\);/
);
if (!planeLaneSrc) throw new Error("plane lane NaN guard missing");
const planeLane = new Function(
  "displayLane",
  "lane",
  [
    "const LANES = " + grab("LANES") + ";",
    "const player = { displayLane: displayLane, lane: lane };",
    planeLaneSrc[0],
    "return { laneF: laneF, lane0: lane0, lane1: lane1, frac: frac };",
  ].join("\n")
);

const { obstacleClearedBy, obstacleSlideClearable, slidePoseHeld } = slideApi;
const HIT_Z_MIN = slideApi.HIT_Z_MIN;
const HIT_Z_MAX = slideApi.HIT_Z_MAX;
const SLIDE_EXIT_PAD = slideApi.SLIDE_EXIT_PAD;
const CHILL_Z = Number(zLine[1]);
const NORM_Z = Number(zLine[2]);

function pose(extra) {
  return Object.assign({ invuln: false, wallnut: false, jumping: false, sliding: false }, extra);
}
const high = { variant: "high_bar", duckOnly: true, tall: false };
const train = { variant: "train", duckOnly: false, tall: true };
const box = { variant: "box", duckOnly: false, tall: false };

function zSpeedOf(moveSpeed, chill) {
  return (moveSpeed / 420) * (chill ? CHILL_Z : NORM_Z);
}

/** 先推进障碍，用上一帧的蹲姿做碰撞，再决定要不要站起来。和 update() 的顺序一致。 */
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
      if (!obstacleClearedBy(pose({ sliding: sliding }), spec)) died = true;
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

function exampleDuckHoldVsTallBar() {
  /** 高栏要一直蹲到栏身过去；固定 0.42 秒的旧计时会在栏里站起来。 */
  assert(obstacleClearedBy(pose({ sliding: true }), high) === true, "duck clears high bar");
  assert(obstacleClearedBy(pose({ jumping: true }), high) === false, "jump hits high bar");
  assert(obstacleClearedBy(pose({}), high) === false, "standing hits high bar");
  assert(obstacleClearedBy(pose({ sliding: true }), train) === false, "duck hits train");
  assert(obstacleClearedBy(pose({ jumping: true }), train) === true, "jump clears train");
  assert(obstacleSlideClearable(high) === true, "high bar holds a duck");
  assert(obstacleSlideClearable(train) === false, "train does not hold a duck");
  assert(!src.includes("SLIDE_DURATION"), "duck is not a fixed short timer");

  const speeds = [
    ["earth-start", zSpeedOf(grab("SPEED_START"), false)],
    ["earth-max", zSpeedOf(grab("SPEED_MAX"), false)],
    ["chill-start", zSpeedOf(grab("CHILL_SPEED_START"), true)],
  ];
  for (const [label, zSpeed] of speeds) {
    for (const dt of [1 / 60, 1 / 20]) {
      const run = simulateDuck(zSpeed, 0.45, dt, "high");
      assert(!run.died, label + " duck from mid-approach dies under the tall bar dt=" + dt);
      assert(run.releasedAt == null || run.releasedAt > HIT_Z_MAX, label + " stood up inside the tall bar");
    }
    const late = simulateDuck(zSpeed, 0.72, 1 / 60, "high");
    assert(!late.died, label + " late duck dies under the tall bar");
    assert(simulateOldFixedSlide(zSpeed, 0.45, 1 / 60) === true, label + " old 0.42s duck still dies");
    assert(!simulateDuck(zSpeed, 0.5, 1 / 60, "box").died, label + " duck still clears a low box");
    assert(simulateDuck(zSpeed, 0.72, 1 / 60, "train").died, label + " duck still hits a train");
  }

  const bar = { z: (HIT_Z_MIN + HIT_Z_MAX) / 2, alive: true, duckOnly: true, tall: false };
  assert(slidePoseHeld(NaN, [bar]) === true, "NaN travel still holds while the bar covers the lane");
  assert(slidePoseHeld(NaN, []) === false, "NaN travel with an empty lane does not throw");
  assert(slidePoseHeld(Infinity, [bar]) === false, "infinite travel cannot hold the duck forever");
  assert(slidePoseHeld(-1, []) === true, "negative travel still counts as the start of a slide");
}
register(exampleDuckHoldVsTallBar);

function finiteCurve(cur, msg) {
  for (const key of ["k", "speed", "interval", "extraChance"]) {
    assert(typeof cur[key] === "number" && Number.isFinite(cur[key]), msg + " " + key + "=" + cur[key]);
  }
  assert(cur.k >= 0 && cur.k <= 1, msg + " k out of range");
  assert(typeof cur.held === "boolean", msg + " held");
}

function sig(cur) {
  return [cur.k, cur.speed, cur.interval, cur.extraChance, cur.held].join("|");
}

function exampleDifficultyClamp() {
  /** 难度在 120 秒封顶；负数、NaN、Infinity 和非数字不能把速度算成 NaN，也不能继续加难。 */
  const specs = [
    {
      label: "normal",
      speedStart: grab("SPEED_START"),
      speedMax: grab("SPEED_MAX"),
      speedRamp: grab("SPEED_RAMP"),
      spawnBase: grab("SPAWN_BASE"),
      spawnMin: grab("SPAWN_MIN"),
      spawnDiv: grab("SPAWN_DIST_DIV"),
    },
    {
      label: "chill",
      speedStart: grab("CHILL_SPEED_START"),
      speedMax: grab("CHILL_SPEED_MAX"),
      speedRamp: grab("CHILL_SPEED_RAMP"),
      spawnBase: grab("CHILL_SPAWN_BASE"),
      spawnMin: grab("CHILL_SPAWN_MIN"),
      spawnDiv: grab("CHILL_SPAWN_DIST_DIV"),
    },
  ];
  for (const spec of specs) {
    const at0 = difficultyCurve(0, spec);
    const at120 = difficultyCurve(120, spec);
    const at240 = difficultyCurve(240, spec);
    const later = difficultyCurve(1e9, spec);
    finiteCurve(at0, spec.label + " t=0");
    finiteCurve(at120, spec.label + " t=120");
    assert(at0.held === false && at0.extraChance === 0, spec.label + " t=0 is not capped");
    assert(at120.held === true && at120.k === 1, spec.label + " 120s is the cap");
    assert(sig(at120) === sig(at240), spec.label + " 240s matches 120s");
    assert(sig(at120) === sig(later), spec.label + " far future matches 120s");
    assert(Math.abs(at120.speed - spec.speedMax) < 1e-6, spec.label + " speed holds at the existing max");
    assert(Math.abs(at120.interval - spec.spawnMin) < 1e-6, spec.label + " spawn gap holds at the existing minimum");
    assert(difficultyCurve(119.999, spec).held === false, spec.label + " just before 120s is not yet held");

    const easy = [
      ["negative", -10],
      ["neg-inf", -Infinity],
      ["nan", NaN],
      ["undefined", undefined],
      ["null", null],
      ["blank", ""],
      ["word", "nope"],
      ["array", [1, 2]],
      ["object", {}],
    ];
    for (const [name, value] of easy) {
      const cur = difficultyCurve(value, spec);
      finiteCurve(cur, spec.label + " " + name);
      assert(cur.held === false, spec.label + " " + name + " must not count as capped");
      assert(sig(cur) === sig(at0), spec.label + " " + name + " should match t=0");
    }
    const hard = [
      ["inf", Infinity],
      ["string-120", "120"],
      ["array-120", [120]],
      ["huge", 1e308],
    ];
    for (const [name, value] of hard) {
      const cur = difficultyCurve(value, spec);
      finiteCurve(cur, spec.label + " " + name);
      assert(sig(cur) === sig(at120), spec.label + " " + name + " should match the 120s cap");
    }
  }
}
register(exampleDifficultyClamp);

function assertFinitePoint(p, msg) {
  for (const key of ["x", "y", "scale", "half"]) {
    assert(typeof p[key] === "number" && Number.isFinite(p[key]), msg + " " + key + "=" + p[key]);
  }
}

function exampleLaneNanGuard() {
  /** 车道是 NaN、Infinity 或 1.01 这种小数时，投影和飞机绘制仍要用有限坐标，不能去读不存在的 LANE_X 下标。 */
  const { project, setMode, setDistance } = projectApi;
  setDistance(12);
  const vw = 420;
  const vh = 740;
  const z = 0.6;
  for (const mode of ["earth", "forest", "space", "chill", "plant", "plane"]) {
    setMode(mode);
    assertFinitePoint(project(1, z, vw, vh), mode + " lane 1");
    assertFinitePoint(project(1.01, z, vw, vh), mode + " lane 1.01");
  }
  setMode("earth");
  setDistance(0);
  const lane0 = project(0, z, vw, vh);
  const lane1 = project(1, z, vw, vh);
  const lane2 = project(2, z, vw, vh);
  const mid = project(1.01, z, vw, vh);
  assertFinitePoint(lane0, "lane 0");
  assertFinitePoint(mid, "lane 1.01");
  const lo = Math.min(lane1.x, lane2.x);
  const hi = Math.max(lane1.x, lane2.x);
  assert(mid.x >= lo - 0.01 && mid.x <= hi + 0.01, "lane 1.01 stays between lane 1 and lane 2");
  for (const bad of [NaN, Infinity, -Infinity]) {
    const p = project(bad, z, vw, vh);
    assertFinitePoint(p, "lane " + bad);
    assert(p.x === lane0.x && p.scale === lane0.scale, "non-finite lane falls back to lane 0");
  }
  assertFinitePoint(project(null, z, vw, vh), "null lane");
  assertFinitePoint(project(undefined, z, vw, vh), "undefined lane");
  assertFinitePoint(project("1.5", z, vw, vh), "string lane");
  assertFinitePoint(project(-0.5, z, vw, vh), "negative fractional lane");
  assertFinitePoint(project(99.2, z, vw, vh), "lane past the last index");

  const nanDisplay = planeLane(NaN, 1);
  assert(nanDisplay.laneF === 1 && nanDisplay.lane0 === 1, "NaN displayLane uses the integer lane");
  const infDisplay = planeLane(Infinity, 0);
  assert(infDisplay.laneF === 0 && infDisplay.lane0 === 0 && Number.isFinite(infDisplay.frac), "Infinity displayLane falls back");
  const frac = planeLane(1.25, 0);
  assert(frac.lane0 === 1 && Math.abs(frac.frac - 0.25) < 1e-9, "fractional displayLane lerps");
  const neg = planeLane(-3, 2);
  assert(neg.lane0 === 0 && Number.isFinite(neg.frac), "negative displayLane clamps to lane 0");
  const missing = planeLane(undefined, 2);
  assert(missing.laneF === 2 && missing.lane0 === 2, "missing displayLane uses player.lane");
}
register(exampleLaneNanGuard);

function exampleProjectNonFiniteDepth() {
  /** z 或路程不是有限数时，投影坐标仍应全部是有限数，避免整帧画飞。 */
  const { project, setMode, setDistance } = projectApi;
  setMode("earth");
  const problems = [];
  function check(label, p) {
    for (const key of ["x", "y", "scale", "half"]) {
      if (!p || typeof p[key] !== "number" || !Number.isFinite(p[key])) {
        problems.push(label + "." + key + "=" + (p && p[key]));
      }
    }
  }
  setDistance(0);
  check("z=NaN", project(1, NaN, 420, 740));
  check("z=Infinity", project(1, Infinity, 420, 740));
  check("z=-Infinity", project(1, -Infinity, 420, 740));
  setDistance(NaN);
  check("distance=NaN", project(1, 0.5, 420, 740));
  setDistance(Infinity);
  check("distance=Infinity", project(1, 0.5, 420, 740));
  setDistance(0);
  if (problems.length) throw new Error(problems.join("; "));
}
exampleProjectNonFiniteDepth.expectedFail = true; // EXPECTED_FAIL_UNTIL_FIXED
register(exampleProjectNonFiniteDepth);

function examplePlaneLaneBothNan() {
  /** displayLane 和 lane 都是 NaN 时，飞机绘制用的车道下标和插值比例仍应是有限数。 */
  const both = planeLane(NaN, NaN);
  assert(Number.isFinite(both.laneF), "laneF=" + both.laneF);
  assert(Number.isFinite(both.lane0), "lane0=" + both.lane0);
  assert(Number.isFinite(both.lane1), "lane1=" + both.lane1);
  assert(Number.isFinite(both.frac), "frac=" + both.frac);
  assert(both.lane0 >= 0 && both.lane0 <= 2, "lane0 out of range");
}
examplePlaneLaneBothNan.expectedFail = true; // EXPECTED_FAIL_UNTIL_FIXED
register(examplePlaneLaneBothNan);

let passed = 0;
let expected = 0;
let failed = 0;
for (const fn of EXAMPLES) {
  const title = titleOf(fn);
  try {
    fn();
  } catch (e) {
    if (fn.expectedFail) {
      expected += 1;
      console.log("EXPECTED_FAIL_UNTIL_FIXED:", title);
      console.log("   ", e && e.message ? e.message : e);
      continue;
    }
    failed += 1;
    console.log("FAIL:", title);
    console.log(e && e.stack ? e.stack : e);
    continue;
  }
  if (fn.expectedFail) {
    failed += 1;
    console.log("FAIL: robustness now holds, remove EXPECTED_FAIL_UNTIL_FIXED:", title);
    continue;
  }
  passed += 1;
  console.log("ok:", title);
}
console.log(
  "portrait robustness client examples: " + passed + " ok, " + expected + " expected-fail, " + failed + " failed"
);
if (failed) process.exit(1);
