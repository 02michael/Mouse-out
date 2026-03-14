const track = document.getElementById("track");
const fill = document.getElementById("fill");
const knob = document.getElementById("knob");
const freeKnob = document.getElementById("freeKnob");
const valueText = document.getElementById("valueText");

const detachThreshold = 18;
const detachVerticalThreshold = 34;

const gravity = 0.72;
const airDrag = 0.995;
const wallBounce = 0.72;
const floorBounce = 0.42;
const floorFriction = 0.985;
const settleSpeed = 0.18;

let value = 0.35;

let detached = false;
let landed = false;

let activeInputType = null;
let activeId = null;
let draggingAttached = false;
let draggingDetached = false;

let dragOffsetX = 0;
let dragOffsetY = 0;
let edgePullLock = null;

const phys = {
  x: 0,
  y: 0,
  vx: 0,
  vy: 0
};

let throwSamples = [];

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function getKnobSize() {
  const cssValue = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--knob-size")
  );
  return Number.isFinite(cssValue) && cssValue > 0
    ? cssValue
    : freeKnob.offsetWidth || knob.offsetWidth || 46;
}

function getRadius() {
  return getKnobSize() / 2;
}

function getTrackRect() {
  return track.getBoundingClientRect();
}

function setValue(v) {
  value = clamp(v, 0, 1);
  fill.style.width = `${value * 100}%`;
  knob.style.left = `${value * 100}%`;
  updateValueLabel();
}

function updateValueLabel() {
  valueText.textContent = detached ? "?%" : `${Math.round(value * 100)}%`;
}

function floorY() {
  return window.innerHeight - getRadius();
}

function positionFreeKnob(x, y) {
  const radius = getRadius();
  freeKnob.style.transform = `translate3d(${x - radius}px, ${y - radius}px, 0)`;
}

function trackValueFromX(x) {
  const rect = getTrackRect();
  return clamp((x - rect.left) / rect.width, 0, 1);
}

function resetEdgePullLock() {
  edgePullLock = null;
}

function attachKnobAtX(x) {
  detached = false;
  landed = false;
  draggingDetached = false;

  phys.vx = 0;
  phys.vy = 0;

  freeKnob.style.display = "none";
  knob.style.display = "block";

  resetEdgePullLock();
  setValue(trackValueFromX(x));
}