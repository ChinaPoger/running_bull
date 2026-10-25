import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../public/mobile-web");
const src = fs.readFileSync(path.join(root, "game.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const match = src.match(/function difficultyCurve\(playSec, spec\) \{[\s\S]*?\n  \}/);
if (!match) throw new Error("difficultyCurve not found");
const difficultyCurve = new Function(`${match[0]}\nreturn difficultyCurve;`)();

function grab(name) {
  const m = src.match(new RegExp("const " + name + " = ([0-9.]+)"));
  if (!m) throw new Error("missing " + name);
  return Number(m[1]);
}

const normal = {
  speedStart: grab("SPEED_START"),
  speedMax: grab("SPEED_MAX"),
  speedRamp: grab("SPEED_RAMP"),
  spawnBase: grab("SPAWN_BASE"),
  spawnMin: grab("SPAWN_MIN"),
  spawnDiv: grab("SPAWN_DIST_DIV"),
};
const chill = {
  speedStart: grab("CHILL_SPEED_START"),
  speedMax: grab("CHILL_SPEED_MAX"),
  speedRamp: grab("CHILL_SPEED_RAMP"),
  spawnBase: grab("CHILL_SPAWN_BASE"),
  spawnMin: grab("CHILL_SPAWN_MIN"),
  spawnDiv: grab("CHILL_SPAWN_DIST_DIV"),
};

function checkSpec(spec, label) {
  const at0 = difficultyCurve(0, spec);
  assert(at0.speed === spec.speedStart, label + " t=0 speed is the easy start");
  assert(at0.interval === spec.spawnBase, label + " t=0 spawn gap is the wide start");
  assert(at0.extraChance === 0, label + " t=0 does not add extra obstacles");
  assert(at0.held === false, label + " t=0 is not yet capped");

  const at1 = difficultyCurve(1, spec);
  const span = spec.speedMax - spec.speedStart;
  assert(at1.speed >= at0.speed, label + " speed does not drop in the first second");
  assert(at1.speed - at0.speed < span * 0.05, label + " first second is not a spike");
  assert(at1.interval <= at0.interval, label + " gaps do not widen in the first second");
  assert(at0.interval - at1.interval < (spec.spawnBase - spec.spawnMin) * 0.05, label + " spawn rate does not spike");

  let prev = at0;
  for (let t = 1; t <= 120; t++) {
    const cur = difficultyCurve(t, spec);
    assert(cur.speed >= prev.speed - 1e-9, label + " speed rises through " + t);
    assert(cur.interval <= prev.interval + 1e-9, label + " interval shrinks through " + t);
    assert(cur.extraChance >= prev.extraChance - 1e-9, label + " extra chance rises through " + t);
    assert(cur.speed <= spec.speedMax + 1e-9, label + " speed stays within peak");
    assert(cur.interval >= spec.spawnMin - 1e-9, label + " interval stays within peak");
    prev = cur;
  }

  const atCap = difficultyCurve(120, spec);
  const later = difficultyCurve(240, spec);
  assert(atCap.held === true && later.held === true, label + " cap flag after 120s");
  assert(atCap.speed === later.speed, label + " speed holds after 120s");
  assert(atCap.interval === later.interval, label + " obstacle interval holds after 120s");
  assert(atCap.extraChance === later.extraChance, label + " obstacle count chance holds after 120s");
  assert(Math.abs(atCap.speed - spec.speedMax) < 1e-6, label + " speed peak is the existing max");
  assert(Math.abs(atCap.interval - spec.spawnMin) < 1e-6, label + " spawn peak is the existing minimum gap");
  assert(atCap.k === 1, label + " progress is complete at 120s");

  const mid = difficultyCurve(60, spec);
  assert(mid.speed > at0.speed && mid.speed < atCap.speed, label + " speed is still climbing at 60s");
  assert(mid.interval < at0.interval && mid.interval > atCap.interval, label + " gaps are still shrinking at 60s");
}

checkSpec(normal, "normal");
checkSpec(chill, "chill");

assert(!html.includes('id="touch-layer"'), "permanent control strip is gone");
assert(!html.includes('id="btn-left"'), "lane hint button is gone");
assert(!html.includes('id="btn-jump"'), "jump hint button is gone");
assert(!html.includes('id="btn-right"'), "right hint button is gone");
assert(!html.includes('id="btn-bomb"'), "free bomb button is gone from the strip");
assert(!html.includes('id="btn-boost"'), "free boost button is gone from the strip");
assert(!html.includes('id="btn-invuln"'), "free invuln button is gone from the strip");
assert(html.includes('id="ops-hint"'), "first-visit ops hint exists");
assert(html.includes("操作提示"), "ops hint is labeled");
assert(html.includes('id="run-shop"'), "paid in-run shop stays");
assert(html.includes('data-shop-buy="bomb"'), "portrait shop stays");
assert(src.includes("rb_ops_hint_v1:"), "seen flag is stored under the device id");
assert(src.includes("function presentOpsHint"), "first-run hint is wired");
assert(!css.includes("#touch-layer"), "tip strip styles are gone");
assert(css.includes("#ops-hint"), "ops hint styles exist");
assert(src.includes("onSwipeAxis"), "swipe gestures stay");
assert(src.includes("function slide"), "duck stays");

console.log("portrait hint + 120s difficulty cap OK");
