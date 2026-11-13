
let bwImg;
let colorImg;
let handImg;
let bwLayer;

// Hand cursor
let brushSize = 80;
let handWidth = 100;
let handHeight = 102;

// Reveal progress
let revealProgress = 0;
let burnTriggered = false;

// Burning layers
let burnLayer;
let displayLayer;
let burnMask;
let charLayer;

// Low-resolution burning mask
let maskW;
let maskH;
let noiseOffsets;
let burnSpeedMap;
let burnMaxDepth;

// Burning animation
let burnProgress = 0;
let burnDuration = 18000;

// Fire particles
let fireParticles = [];

async function setup() {
  pixelDensity(1);

  // Load images
  bwImg = await loadImage("kyzmq_bw.png");
  colorImg = await loadImage("kyzmq_color.jpg");
  handImg = await loadImage("hand.png");

  // Create canvas
  createCanvas(bwImg.width, bwImg.height);

  // Create black-and-white layer
  bwLayer = createGraphics(width, height);
  bwLayer.pixelDensity(1);
  bwLayer.image(bwImg, 0, 0);

  noCursor();

  calculateProgress();
}

function draw() {

  // BEFORE BURNING
  if (!burnTriggered) {

    background(240);

    // Show color photograph
    image(colorImg, 0, 0);

    // Show black-and-white layer
    image(bwLayer, 0, 0);

    // Update reveal progress
    if (frameCount % 10 === 0) {
      calculateProgress();
    }

    // Progress bar
    drawProgressBar();

    // Hand cursor
    image(
      handImg,
      mouseX - handWidth / 2,
      mouseY - handHeight / 2,
      handWidth,
      handHeight
    );

    // Start burning at 80%
    if (revealProgress >= 0.80) {
      burnTriggered = true;
      startBurning();
    }

  } else {

    // BURNING STAGE
    background(15, 11, 9);

    updateBurning();

    image(displayLayer, 0, 0);

    drawFireParticles();
  }
}


// Erase black-and-white layer
function mouseDragged() {

  if (burnTriggered) return;

  bwLayer.erase();
  bwLayer.circle(mouseX, mouseY, brushSize);
  bwLayer.noErase();
}


// Calculate reveal progress
function calculateProgress() {

  bwLayer.loadPixels();

  let totalPixels = 0;
  let erasedPixels = 0;

  for (let y = 0; y < height; y += 8) {
    for (let x = 0; x < width; x += 8) {

      let index = (y * width + x) * 4;
      let alpha = bwLayer.pixels[index + 3];

      totalPixels++;

      if (alpha < 250) {
        erasedPixels++;
      }
    }
  }

  revealProgress = erasedPixels / totalPixels;
}


// Draw progress bar
function drawProgressBar() {

  let barWidth = 180;
  let barHeight = 10;

  push();

  noStroke();

  fill(0, 170);
  rect(12, 12, 210, 55, 8);

  fill(255);
  textSize(12);
  textAlign(LEFT, CENTER);

  text(
    "COLOR REVEALED: " +
    floor(revealProgress * 100) + "%",
    22,
    29
  );

  fill(100);
  rect(22, 43, barWidth, barHeight, 5);

  fill(255, 170, 50);
  rect(
    22,
    43,
    barWidth * revealProgress,
    barHeight,
    5
  );

  pop();
}


// Start burning
function startBurning() {

  burnProgress = 0;

  // Save the complete photograph
  burnLayer = createGraphics(width, height);
  burnLayer.pixelDensity(1);

  burnLayer.image(colorImg, 0, 0);
  burnLayer.image(bwLayer, 0, 0);

  // Create display layer
  displayLayer = createGraphics(width, height);
  displayLayer.pixelDensity(1);

  // Create low-resolution masks
  let scaleFactor = 4;

  maskW = floor(width / scaleFactor);
  maskH = floor(height / scaleFactor);

  burnMask = createGraphics(maskW, maskH);
  charLayer = createGraphics(maskW, maskH);

  burnMask.pixelDensity(1);
  charLayer.pixelDensity(1);

  // Maximum burning depth
  burnMaxDepth = min(maskW, maskH) / 2;

  // Create random maps
  noiseOffsets = new Float32Array(maskW * maskH);
  burnSpeedMap = new Float32Array(maskW * maskH);

  for (let y = 0; y < maskH; y++) {
    for (let x = 0; x < maskW; x++) {

      let index = y * maskW + x;

      // Irregular burning edge
      noiseOffsets[index] =
        (noise(x * 0.035, y * 0.035) - 0.5) * 8;

      // Different burning speeds in different areas
      burnSpeedMap[index] = random(0.82, 1.18);
    }
  }

  updateBurningMask();
  composeBurningImage();
}


// Update burning animation
function updateBurning() {

  // Frame-based progress
  let totalFrames = burnDuration * 60 / 1000;

  burnProgress = min(
    1,
    burnProgress + 1 / totalFrames
  );

  // Update mask every 2 frames
  if (frameCount % 2 === 0) {
    updateBurningMask();
    composeBurningImage();
  }

  // Generate random flames
  if (burnProgress < 1) {
    spawnFireParticles();
  }
}


// Generate low-resolution burning mask
function updateBurningMask() {

  burnMask.clear();
  charLayer.clear();

  burnMask.loadPixels();
  charLayer.loadPixels();

  let front = burnProgress * burnMaxDepth;

  let charWidth = 2.5;

  for (let y = 0; y < maskH; y++) {
    for (let x = 0; x < maskW; x++) {

      let index = y * maskW + x;

      // Distance from nearest edge
      let edgeDistance = min(
        x,
        y,
        maskW - 1 - x,
        maskH - 1 - y
      );

      // Different areas burn at different speeds
      let localFront =
        front +
        front * (burnSpeedMap[index] - 1) *
        (1 - burnProgress);

      // Irregular burning boundary
      let boundary =
        localFront + noiseOffsets[index];

      let distance = abs(edgeDistance - boundary);

      let pixelIndex = index * 4;

      // Fully burned area
      if (edgeDistance < boundary - charWidth) {

        burnMask.pixels[pixelIndex] = 0;
        burnMask.pixels[pixelIndex + 1] = 0;
        burnMask.pixels[pixelIndex + 2] = 0;
        burnMask.pixels[pixelIndex + 3] = 255;

      }

      // Charred edge
      else if (distance < charWidth) {

        let alpha = map(
          distance,
          0,
          charWidth,
          220,
          0
        );

        charLayer.pixels[pixelIndex] = 10;
        charLayer.pixels[pixelIndex + 1] = 5;
        charLayer.pixels[pixelIndex + 2] = 2;
        charLayer.pixels[pixelIndex + 3] = alpha;
      }
    }
  }

  burnMask.updatePixels();
  charLayer.updatePixels();
}


// Combine photograph, charred edge and burn mask
function composeBurningImage() {

  displayLayer.clear();

  // Original photograph
  displayLayer.image(burnLayer, 0, 0);

  // Charred edge
  displayLayer.image(
    charLayer,
    0,
    0,
    width,
    height
  );

  // Remove burned area
  displayLayer.erase();

  displayLayer.image(
    burnMask,
    0,
    0,
    width,
    height
  );

  displayLayer.noErase();
}


// Generate random fire particles
function spawnFireParticles() {

  // Random chance of generating flames
  if (random() > 0.45) {
    return;
  }

  let front =
    burnProgress * min(width, height) / 2;

  // Random number of particles
  let particleCount = floor(random(1, 5));

  for (let i = 0; i < particleCount; i++) {

    // Randomly choose one of four edges
    let edge = floor(random(4));

    if (edge === 0) {

      // Top
      addFireParticle(
        random(width),
        front + random(-15, 15)
      );

    } else if (edge === 1) {

      // Bottom
      addFireParticle(
        random(width),
        height - front + random(-15, 15)
      );

    } else if (edge === 2) {

      // Left
      addFireParticle(
        front + random(-15, 15),
        random(height)
      );

    } else {

      // Right
      addFireParticle(
        width - front + random(-15, 15),
        random(height)
      );
    }
  }
}


// Create one fire particle
function addFireParticle(x, y) {

  fireParticles.push({

    x: x,
    y: y,

    // Random movement speed
    vx: random(-1.5, 1.5),
    vy: random(-4.8, -0.8),

    // Random size
    size: random(5, 22),

    // Random lifetime
    life: random(25, 80),
    maxLife: 80
  });
}


// Draw and update fire particles
function drawFireParticles() {

  for (let i = fireParticles.length - 1; i >= 0; i--) {

    let p = fireParticles[i];

    p.x += p.vx;
    p.y += p.vy;

    // Random movement variation
    p.vx += random(-0.08, 0.08);
    p.vy *= 0.99;

    p.life--;

    // Remove dead particles
    if (p.life <= 0) {
      fireParticles.splice(i, 1);
      continue;
    }

    let alpha = map(
      p.life,
      0,
      p.maxLife,
      0,
      230
    );

    push();

    translate(p.x, p.y);
    rotate(p.vx * 0.15);

    noStroke();

    // Outer red flame
    fill(220, 45, 10, alpha);
    ellipse(0, 0, p.size, p.size * 1.8);

    // Middle orange flame
    fill(255, 115, 15, alpha);
    ellipse(0, 2, p.size * 0.7, p.size * 1.3);

    // Inner yellow flame
    fill(255, 210, 75, alpha);
    ellipse(0, 4, p.size * 0.35, p.size * 0.7);

    pop();
  }
}
