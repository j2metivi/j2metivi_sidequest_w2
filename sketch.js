let showHitbox = false;

// Y-position of the floor (ground level)
let floorY3;

// Player character (soft, animated blob)
let blob3 = {
  x: 80,
  y: 0,

  r: 26,
  points: 48,
  wobble: 6,
  wobbleFreq: 0.9,

  t: 0,
  tSpeed: 0.012,

  vx: 0,
  vy: 0,

  accel: 0.55,
  maxRun: 4.0,
  gravity: 0.65,
  jumpV: -11.0,

  onGround: false,

  frictionAir: 0.995,
  frictionGround: 0.88,
};

let platforms = [];

// --- FEAR SYSTEM (Package A) ---
let panic = 0; // 0 calm → 1 terrified
let safeLights = [];
let shadows = [];

function setup() {
  createCanvas(640, 360);
  floorY3 = height - 36;

  noStroke();
  textFont("sans-serif");
  textSize(14);

  platforms = [
    { x: 0, y: floorY3, w: width, h: height - floorY3, isFloor: true }, // floor
    { x: 120, y: floorY3 - 70, w: 120, h: 12 },
    { x: 300, y: floorY3 - 120, w: 90, h: 12 },
    { x: 440, y: floorY3 - 180, w: 130, h: 12 },
    { x: 520, y: floorY3 - 70, w: 90, h: 12 },
  ];

  blob3.y = floorY3 - blob3.r - 1;

  // Visible safe light pools (these are what create “light areas”)
  safeLights = [
    { x: 80, y: floorY3 - 40, r: 130 },
    { x: 320, y: floorY3 - 140, r: 120 },
    { x: 560, y: floorY3 - 80, r: 130 },
  ];

  for (let i = 0; i < 8; i++) {
    shadows.push({
      x: random(width),
      y: random(height),
      r: random(40, 120),
      vx: random(0.15, 0.55) * random([-1, 1]),
      phase: random(1000),
    });
  }
}

function draw() {
  // Base “dark world”
  background(18);

  // Shadows first (behind everything)
  drawShadows();

  // Draw visible light pools (THIS makes light/dark readable)
  drawLightPools();

  // Panic = how far outside light pools the blob is
  let nearest = 99999;
  for (const L of safeLights) {
    const d = dist(blob3.x, blob3.y, L.x, L.y) - L.r;
    nearest = min(nearest, d);
  }
  // nearest < 0 means you're in light
  let darkness = constrain(map(nearest, -60, 260, 0, 1), 0, 1);
  panic = lerp(panic, darkness, 0.05);

  // Panic-driven animation tuning (keep wobble reasonable)
  blob3.tSpeed = lerp(0.012, 0.05, panic);
  blob3.wobble = lerp(5, 9, panic);
  blob3.wobbleFreq = lerp(0.9, 1.5, panic);

  // --- Draw platforms (slightly dim so lights stand out) ---
  fill(70);
  for (const p of platforms) rect(p.x, p.y, p.w, p.h);

  // --- Input ---
  let move = 0;
  if (keyIsDown(65) || keyIsDown(LEFT_ARROW)) move -= 1;
  if (keyIsDown(68) || keyIsDown(RIGHT_ARROW)) move += 1;

  // Skittish acceleration: fear makes the first push a bit sharper
  let skittishBoost = 1 + 0.5 * panic;
  blob3.vx += blob3.accel * move * skittishBoost;

  // Tremble when grounded + scared (small involuntary shake)
  if (blob3.onGround && panic > 0.15) {
    blob3.vx += (noise(frameCount * 0.25) - 0.5) * 0.28 * panic;
  }

  // Fear slightly reduces control (more slide) + slightly reduces top speed
  let fearFriction = lerp(1.0, 0.95, panic);
  blob3.vx *=
    (blob3.onGround ? blob3.frictionGround : blob3.frictionAir) * fearFriction;

  let fearMaxRun = lerp(blob3.maxRun, blob3.maxRun * 0.85, panic);
  blob3.vx = constrain(blob3.vx, -fearMaxRun, fearMaxRun);

  // Gravity
  blob3.vy += blob3.gravity;

  // --- IMPORTANT FIX: collision radius matches visual blob size ---
  // The blob is drawn up to (r + wobble), so collide using that.
  // Hitbox tuned to match perceived size (not max wobble)
  let collisionR = blob3.r;

  let box = {
    x: blob3.x - collisionR,
    y: blob3.y - collisionR,
    w: collisionR * 2,
    h: collisionR * 2,
  };

  // Move X + resolve (skip floor so it doesn't act like a side wall)
  box.x += blob3.vx;
  for (const s of platforms) {
    if (s.isFloor) continue;
    if (overlap(box, s)) {
      if (blob3.vx > 0) box.x = s.x - box.w;
      else if (blob3.vx < 0) box.x = s.x + s.w;
      blob3.vx = 0;
    }
  }

  // Move Y + resolve
  box.y += blob3.vy;
  blob3.onGround = false;

  for (const s of platforms) {
    if (overlap(box, s)) {
      if (blob3.vy > 0) {
        box.y = s.y - box.h;
        blob3.vy = 0;
        blob3.onGround = true;
      } else if (blob3.vy < 0) {
        box.y = s.y + s.h;
        blob3.vy = 0;
      }
    }
  }

  // Safety clamp: never allow box to remain inside the floor
  box.y = min(box.y, floorY3 - box.h);

  // Convert back to center position
  blob3.x = box.x + box.w / 2;
  blob3.y = box.y + box.h / 2;
  // DEBUG: draw hitbox (press H to toggle)
  if (showHitbox) {
    push();
    noFill();
    stroke(255, 0, 0);
    rect(box.x, box.y, box.w, box.h);
    pop();
    noStroke();
  }

  // Keep inside canvas horizontally using collision radius
  blob3.x = constrain(blob3.x, collisionR, width - collisionR);

  // Draw blob
  blob3.t += blob3.tSpeed;
  drawBlobCircle(blob3, panic);

  // Optional vignette (adds tension without killing the light pools)
  drawVignette();

  // HUD
  fill(220);
  text("Move: A/D or ←/→  •  Jump: Space/W/↑", 10, 18);
  text("Stay in light to calm down. Darkness increases panic.", 10, 36);
}

// AABB overlap
function overlap(a, b) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

// Blob drawing (color shifts slightly with panic)
function drawBlobCircle(b, panicAmt) {
  // More fear = less saturated / paler
  let baseR = lerp(30, 200, 1 - panicAmt);
  let baseG = lerp(120, 210, 1 - panicAmt);
  let baseB = lerp(255, 230, 1 - panicAmt);
  fill(baseR, baseG, baseB);

  beginShape();
  for (let i = 0; i < b.points; i++) {
    const a = (i / b.points) * TAU;
    const n = noise(
      cos(a) * b.wobbleFreq + 100,
      sin(a) * b.wobbleFreq + 100,
      b.t,
    );
    const r = b.r + map(n, 0, 1, -b.wobble, b.wobble);
    vertex(b.x + cos(a) * r, b.y + sin(a) * r);
  }
  endShape(CLOSE);
}

function keyPressed() {
  if (key === "h" || key === "H") showHitbox = !showHitbox;

  if (
    (key === " " || key === "W" || key === "w" || keyCode === UP_ARROW) &&
    blob3.onGround
  ) {
    blob3.vy = blob3.jumpV;
    blob3.onGround = false;
  }
}

// Drift silhouettes (subtle fear texture)
function drawShadows() {
  push();
  noStroke();
  for (const s of shadows) {
    s.x += s.vx;
    if (s.x < -150) s.x = width + 150;
    if (s.x > width + 150) s.x = -150;

    let rr = s.r + sin(frameCount * 0.02 + s.phase) * 10;
    fill(0, 50);
    ellipse(s.x, s.y, rr * 1.2, rr);
  }
  pop();
}

// Visible light pools (so you clearly see safe zones)
function drawLightPools() {
  push();
  noStroke();
  for (const L of safeLights) {
    // Draw a simple radial glow using layered circles
    for (let i = 12; i >= 1; i--) {
      let t = i / 12;
      let rr = L.r * (1.0 + (1 - t) * 0.25);
      let alpha = 18 * t;
      fill(255, 240, 200, alpha);
      ellipse(L.x, L.y, rr * 2, rr * 2);
    }

    // bright core
    fill(255, 245, 210, 55);
    ellipse(L.x, L.y, L.r * 0.9, L.r * 0.9);
  }
  pop();
}

// Vignette that strengthens with panic (doesn't erase lights)
function drawVignette() {
  push();
  noStroke();
  fill(0, 90 * panic);
  rect(0, 0, width, height);
  pop();
}
