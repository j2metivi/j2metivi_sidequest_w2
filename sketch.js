// Y-position of the floor (ground level)
let floorY3;

// Player character (soft, animated blob)
let blob3 = {
  // Position (centre of the blob)
  x: 80,
  y: 0,

  // Visual properties
  r: 26, // Base radius
  points: 48, // Number of points used to draw the blob
  wobble: 7, // Edge deformation amount
  wobbleFreq: 0.9,

  // Time values for breathing animation
  t: 0,
  tSpeed: 0.01,

  // Physics: velocity
  vx: 0, // Horizontal velocity
  vy: 0, // Vertical velocity

  // Movement tuning
  accel: 0.55, // Horizontal acceleration
  maxRun: 4.0, // Maximum horizontal speed
  gravity: 0.65, // Downward force
  jumpV: -11.0, // Initial jump impulse

  // State
  onGround: false, // True when standing on a platform

  // Friction
  frictionAir: 0.995, // Light friction in air
  frictionGround: 0.88, // Stronger friction on ground
};

// List of solid platforms the blob can stand on
// Each platform is an axis-aligned rectangle (AABB)
let platforms = [];

// --- FEAR SYSTEM (Package A) ---
let panic = 0; // 0 calm → 1 terrified
let safeLights = []; // positions of "safe" light pools
let shadows = []; // background silhouettes

function setup() {
  createCanvas(640, 360);

  // Define the floor height
  floorY3 = height - 36;

  noStroke();
  textFont("sans-serif");
  textSize(14);

  // Create platforms (floor + steps)
  platforms = [
    { x: 0, y: floorY3, w: width, h: height - floorY3 }, // floor
    { x: 120, y: floorY3 - 70, w: 120, h: 12 }, // low step
    { x: 300, y: floorY3 - 120, w: 90, h: 12 }, // mid step
    { x: 440, y: floorY3 - 180, w: 130, h: 12 }, // high step
    { x: 520, y: floorY3 - 70, w: 90, h: 12 }, // return ramp
  ];

  // Start the blob resting on the floor
  blob3.y = floorY3 - blob3.r - 1;

  // Safe light pools (calm zones)
  safeLights = [
    { x: 80, y: floorY3 - 40, r: 120 },
    { x: 320, y: floorY3 - 140, r: 110 },
    { x: 560, y: floorY3 - 80, r: 120 },
  ];

  // Drifting background shadows (unease in the dark)
  for (let i = 0; i < 8; i++) {
    shadows.push({
      x: random(width),
      y: random(height),
      r: random(30, 90),
      vx: random(0.2, 0.8) * random([-1, 1]),
      phase: random(1000),
    });
  }
}

function draw() {
  background(240);

  // --- FEAR: compute how "safe" we are (distance to nearest light) ---
  let nearest = 99999;
  for (const L of safeLights) {
    const d = dist(blob3.x, blob3.y, L.x, L.y) - L.r;
    nearest = min(nearest, d);
  }
  // nearest < 0 means inside a safe light pool
  let darkness = constrain(map(nearest, -60, 220, 0, 1), 0, 1);

  // Panic rises in darkness, calms in light
  panic = lerp(panic, darkness, 0.04);

  // --- Draw all platforms (base layer) ---
  fill(200);
  for (const p of platforms) {
    rect(p.x, p.y, p.w, p.h);
  }

  // --- Input: left/right movement ---
  let move = 0;
  if (keyIsDown(65) || keyIsDown(LEFT_ARROW)) move -= 1; // A or ←
  if (keyIsDown(68) || keyIsDown(RIGHT_ARROW)) move += 1; // D or →
  // Skittish acceleration (fear makes inputs feel jerky)
  let skittishBoost = 1 + 0.6 * panic;
  blob3.vx += blob3.accel * move * skittishBoost;

  // Tremble when grounded + scared (tiny involuntary shake)
  if (blob3.onGround && panic > 0.15) {
    blob3.vx += (noise(frameCount * 0.2) - 0.5) * 0.35 * panic;
  }

  // --- Apply friction and clamp speed (panic affects control) ---
  let fearFriction = lerp(1.0, 0.94, panic); // lower = more slide
  blob3.vx *=
    (blob3.onGround ? blob3.frictionGround : blob3.frictionAir) * fearFriction;

  let fearMaxRun = lerp(blob3.maxRun, blob3.maxRun * 0.82, panic);
  blob3.vx = constrain(blob3.vx, -fearMaxRun, fearMaxRun);

  // --- Apply gravity ---
  blob3.vy += blob3.gravity;

  // --- Collision representation ---
  // We collide using a rectangle (AABB),
  // even though the blob is drawn as a circle
  let box = {
    x: blob3.x - blob3.r,
    y: blob3.y - blob3.r,
    w: blob3.r * 2,
    h: blob3.r * 2,
  };

  // --- STEP 1: Move horizontally, then resolve X collisions ---
  box.x += blob3.vx;
  for (const s of platforms) {
    if (overlap(box, s)) {
      if (blob3.vx > 0) {
        // Moving right → hit the left side of a platform
        box.x = s.x - box.w;
      } else if (blob3.vx < 0) {
        // Moving left → hit the right side of a platform
        box.x = s.x + s.w;
      }
      blob3.vx = 0;
    }
  }

  // --- STEP 2: Move vertically, then resolve Y collisions ---
  box.y += blob3.vy;
  blob3.onGround = false;

  for (const s of platforms) {
    if (overlap(box, s)) {
      if (blob3.vy > 0) {
        // Falling → land on top of a platform
        box.y = s.y - box.h;
        blob3.vy = 0;
        blob3.onGround = true;
      } else if (blob3.vy < 0) {
        // Rising → hit the underside of a platform
        box.y = s.y + s.h;
        blob3.vy = 0;
      }
    }
  }

  // --- Convert collision box back to blob centre ---
  blob3.x = box.x + box.w / 2;
  blob3.y = box.y + box.h / 2;

  // Keep blob inside the canvas horizontally
  blob3.x = constrain(blob3.x, blob3.r, width - blob3.r);

  // --- Panic-driven animation: faster breathing + more wobble ---
  blob3.tSpeed = lerp(0.01, 0.05, panic);
  blob3.wobble = lerp(7, 14, panic);
  blob3.wobbleFreq = lerp(0.9, 1.6, panic);

  // --- Draw the animated blob ---
  blob3.t += blob3.tSpeed;
  drawBlobCircle(blob3);

  // --- HUD ---
  fill(0);
  text("Move: A/D or ←/→  •  Jump: Space/W/↑", 10, 18);
  text("Stay in light to calm down. Darkness increases panic.", 10, 36);

  // --- Fear environment overlay (draw last) ---
  drawShadows();
  drawSpotlight();
}

// Axis-Aligned Bounding Box (AABB) overlap test
// Returns true if rectangles a and b intersect
function overlap(a, b) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

// Draws the blob using Perlin noise for a soft, breathing effect
function drawBlobCircle(b) {
  fill(20, 120, 255);
  beginShape();

  for (let i = 0; i < b.points; i++) {
    const a = (i / b.points) * TAU;

    // Noise-based radius offset
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

// Jump input (only allowed when grounded)
function keyPressed() {
  if (
    (key === " " || key === "W" || key === "w" || keyCode === UP_ARROW) &&
    blob3.onGround
  ) {
    blob3.vy = blob3.jumpV;
    blob3.onGround = false;
  }
}

// --- Fear ambience: drifting silhouettes ---
function drawShadows() {
  push();
  noStroke();
  for (const s of shadows) {
    s.x += s.vx;
    if (s.x < -100) s.x = width + 100;
    if (s.x > width + 100) s.x = -100;

    // shadow "breath"
    let rr = s.r + sin(frameCount * 0.02 + s.phase) * 8;

    // darker when panic is high
    fill(0, 30 + 120 * panic);
    ellipse(s.x, s.y, rr * 1.2, rr);
  }
  pop();
}

// --- Fear ambience: darkness overlay + spotlight around blob ---
function drawSpotlight() {
  push();

  // Dark overlay
  fill(0, 170 * (0.35 + 0.65 * panic)); // darker as fear rises
  rect(0, 0, width, height);

  // Cut a hole out of the darkness
  erase();
  let r = lerp(160, 90, panic); // spotlight shrinks when scared
  ellipse(blob3.x, blob3.y, r * 2, r * 2);
  noErase();

  // Extra vignette feel
  fill(0, 60 * panic);
  rect(0, 0, width, height);

  pop();
}
