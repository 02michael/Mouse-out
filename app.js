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

function detachKnob(x, y) {
  detached = true;
  landed = false;
  draggingAttached = false;

  knob.style.display = "none";
  freeKnob.style.display = "block";

  phys.x = x;
  phys.y = y;
  phys.vx = 0;
  phys.vy = 0;

  dragOffsetX = 0;
  dragOffsetY = 0;

  positionFreeKnob(phys.x, phys.y);
  updateValueLabel();
}

function setActive(type, id) {
  activeInputType = type;
  activeId = id;
}

function clearPointer() {
  activeInputType = null;
  activeId = null;
  draggingAttached = false;
  draggingDetached = false;
  resetEdgePullLock();
}

function addThrowSample(x, y) {
  const now = performance.now();
  throwSamples.push({ x, y, t: now });

  const cutoff = now - 120;
  while (throwSamples.length > 2 && throwSamples[0].t < cutoff) {
    throwSamples.shift();
  }
}

function applyThrowVelocity() {
  if (throwSamples.length < 2) {
    phys.vx = 0;
    phys.vy = 0;
    return;
  }

  const first = throwSamples[0];
  const last = throwSamples[throwSamples.length - 1];
  const dt = Math.max(16, last.t - first.t);
  const pxPerFrameFactor = 16.6667 / dt;

  phys.vx = (last.x - first.x) * pxPerFrameFactor;
  phys.vy = (last.y - first.y) * pxPerFrameFactor;

  phys.vx = clamp(phys.vx, -26, 26);
  phys.vy = clamp(phys.vy, -26, 26);
}

function updateAttachedDrag(clientX, clientY) {
  const rect = getTrackRect();
  const raw = (clientX - rect.left) / rect.width;
  setValue(raw);

  const nearLeftEnd = value <= 0.02;
  const nearRightEnd = value >= 0.98;

  const pulledPastLeft = clientX < rect.left - detachThreshold;
  const pulledPastRight = clientX > rect.right + detachThreshold;

  const trackCenterY = rect.top + rect.height / 2;
  const pulledVerticallyAway =
    Math.abs(clientY - trackCenterY) > detachVerticalThreshold;

  if (!nearLeftEnd && !nearRightEnd) {
    resetEdgePullLock();
  }

  if (nearLeftEnd) {
    if (!edgePullLock || edgePullLock.side !== "left") {
      edgePullLock = {
        side: "left",
        x: clientX,
        y: clientY
      };
    }

    const movedLeftEnough = clientX < edgePullLock.x - detachThreshold * 0.5;
    const movedAwayEnough =
      Math.abs(clientY - edgePullLock.y) > detachVerticalThreshold;

    if (
      pulledPastLeft ||
      movedLeftEnough ||
      (pulledVerticallyAway && movedAwayEnough)
    ) {
      detachKnob(clientX, clientY);
      draggingDetached = true;
      throwSamples = [];
      addThrowSample(clientX, clientY);
      resetEdgePullLock();
      return;
    }
  } else if (nearRightEnd) {
    if (!edgePullLock || edgePullLock.side !== "right") {
      edgePullLock = {
        side: "right",
        x: clientX,
        y: clientY
      };
    }

    const movedRightEnough = clientX > edgePullLock.x + detachThreshold * 0.5;
    const movedAwayEnough =
      Math.abs(clientY - edgePullLock.y) > detachVerticalThreshold;

    if (
      pulledPastRight ||
      movedRightEnough ||
      (pulledVerticallyAway && movedAwayEnough)
    ) {
      detachKnob(clientX, clientY);
      draggingDetached = true;
      throwSamples = [];
      addThrowSample(clientX, clientY);
      resetEdgePullLock();
      return;
    }
  }
}