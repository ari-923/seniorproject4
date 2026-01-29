// ===== Auto Detect Room (OpenCV.js) + Scale Calibration =====

const fileInput = document.getElementById("fileInput");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const statusEl = document.getElementById("status");
const cvOut = document.getElementById("cvOut");
const scaleOut = document.getElementById("scaleOut");
const areaOut = document.getElementById("areaOut");

const btnSetScale = document.getElementById("btnSetScale");
const btnAuto = document.getElementById("btnAuto");
const btnClear = document.getElementById("btnClear");
const btnReset = document.getElementById("btnReset");

const realDistanceInput = document.getElementById("realDistance");
const unitSelect = document.getElementById("unit");

let img = new Image();
let imgLoaded = false;
let fit = { x: 0, y: 0, w: 0, h: 0 };

// Modes
const MODE_NONE = "none";
const MODE_SCALE = "scale";
const MODE_AUTO_SEED = "auto_seed";
let mode = MODE_NONE;

// Scale: click 2 points => pixelsPerUnit
let scaleClicks = [];
let pixelsPerUnit = null;

// Result polygon (from detected contour)
let resultPoly = []; // [{x,y}]
let resultClosed = false;

// OpenCV loaded?
let cvReady = false;

// ---------- Helpers ----------
function setStatus(msg) {
  statusEl.textContent = "Status: " + msg;
}

function unitLabel() {
  const u = unitSelect.value;
  if (u === "ft") return "ft";
  if (u === "in") return "in";
  return "m";
}
function areaUnitLabel() {
  const u = unitSelect.value;
  if (u === "ft") return "sq ft";
  if (u === "in") return "sq in";
  return "sq m";
}

function getFitRect(imgW, imgH, boxW, boxH) {
  const imgRatio = imgW / imgH;
  const boxRatio = boxW / boxH;
  let w, h;
  if (imgRatio > boxRatio) {
    w = boxW;
    h = w / imgRatio;
  } else {
    h = boxH;
    w = h * imgRatio;
  }
  const x = (boxW - w) / 2;
  const y = (boxH - h) / 2;
  return { x, y, w, h };
}

function canvasPointFromMouse(e) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  return { x, y };
}

function isPointOnImage(p) {
  return p.x >= fit.x && p.x <= fit.x + fit.w && p.y >= fit.y && p.y <= fit.y + fit.h;
}

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function polygonAreaPixels(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    sum += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  return Math.abs(sum) / 2;
}

function updateScaleOutput() {
  if (!pixelsPerUnit) {
    scaleOut.textContent = "Not set";
    return;
  }
  const unitPerPixel = 1 / pixelsPerUnit;
  scaleOut.textContent = `${pixelsPerUnit.toFixed(4)} px/${unitLabel()} (=${unitPerPixel.toFixed(6)} ${unitLabel()}/px)`;
}

function drawPoint(p, color = "orange") {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLine(a, b, color = "orange") {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();
}

function drawPolygon(points, stroke = "lime", fill = true) {
  if (points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.stroke();
  if (fill) {
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = stroke;
    ctx.fill();
  }
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!imgLoaded) {
    ctx.save();
    ctx.fillStyle = "#666";
    ctx.font = "16px Arial";
    ctx.fillText("Upload an image to begin.", 20, 30);
    ctx.restore();
    return;
  }

  fit = getFitRect(img.width, img.height, canvas.width, canvas.height);
  ctx.drawImage(img, fit.x, fit.y, fit.w, fit.h);

  // Draw scale reference
  if (scaleClicks.length > 0) drawPoint(scaleClicks[0], "orange");
  if (scaleClicks.length > 1) {
    drawPoint(scaleClicks[1], "orange");
    drawLine(scaleClicks[0], scaleClicks[1], "orange");
  }

  // Draw auto-detected polygon
  if (resultClosed && resultPoly.length >= 3) {
    drawPolygon(resultPoly, "lime", true);
  }
}

// ---------- Reset / Clear ----------
function clearResult() {
  resultPoly = [];
  resultClosed = false;
  areaOut.textContent = "—";
  setStatus("Cleared detected result.");
  draw();
}

function resetAll(keepImage = true) {
  scaleClicks = [];
  pixelsPerUnit = null;
  updateScaleOutput();
  clearResult();
  mode = MODE_NONE;

  if (!keepImage) {
    imgLoaded = false;
    img = new Image();
  }

  setStatus(keepImage ? "Ready. Set scale, then auto-detect." : "Upload an image to begin.");
  draw();
}

// ---------- OpenCV readiness ----------
function markCvReady() {
  cvReady = true;
  cvOut.textContent = "ready";
  setStatus("OpenCV ready. Upload an image to begin.");
}

// OpenCV sets Module.onRuntimeInitialized when ready
function waitForOpenCV() {
  const check = () => {
    if (typeof cv !== "undefined" && cv.Mat) {
      // Sometimes cv exists before runtime is ready
      if (cv["onRuntimeInitialized"]) {
        cv["onRuntimeInitialized"] = markCvReady;
      } else {
        // fallback
        markCvReady();
      }
      return;
    }
    setTimeout(check, 100);
  };
  check();
}
waitForOpenCV();

// ---------- Upload ----------
fileInput.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  img = new Image();
  img.onload = () => {
    imgLoaded = true;
    resetAll(true);
    setStatus("Image loaded. Click Set Scale (2 clicks).");
    draw();
  };
  img.src = url;
});

// ---------- Buttons ----------
btnSetScale.addEventListener("click", () => {
  if (!imgLoaded) return setStatus("Upload an image first.");
  mode = MODE_SCALE;
  scaleClicks = [];
  pixelsPerUnit = null;
  updateScaleOutput();
  setStatus("Scale mode: click 2 points with a known real distance between them.");
  draw();
});

btnAuto.addEventListener("click", () => {
  if (!cvReady) return setStatus("OpenCV still loading… try again in a moment.");
  if (!imgLoaded) return setStatus("Upload an image first.");
  if (!pixelsPerUnit) return setStatus("Set scale first (2 clicks).");

  mode = MODE_AUTO_SEED;
  setStatus("Auto-detect: click once INSIDE the room you want to measure.");
});

btnClear.addEventListener("click", () => clearResult());
btnReset.addEventListener("click", () => resetAll(true));

// ---------- Canvas click behavior ----------
canvas.addEventListener("click", (e) => {
  if (!imgLoaded) return;

  const p = canvasPointFromMouse(e);
  if (!isPointOnImage(p)) {
    setStatus("Click inside the blueprint image area.");
    return;
  }

  if (mode === MODE_SCALE) {
    if (scaleClicks.length >= 2) scaleClicks = [];
    scaleClicks.push(p);

    if (scaleClicks.length === 2) {
      const pxDist = dist(scaleClicks[0], scaleClicks[1]);
      const realDist = Number(realDistanceInput.value);

      if (!realDist || realDist <= 0) {
        setStatus("Enter a valid real distance.");
        scaleClicks = [];
        draw();
        return;
      }

      pixelsPerUnit = pxDist / realDist;
      updateScaleOutput();
      mode = MODE_NONE;
      setStatus(`Scale set. Now click Auto Detect Room, then click inside the room.`);
    } else {
      setStatus("Scale mode: click the second point.");
    }

    draw();
    return;
  }

  if (mode === MODE_AUTO_SEED) {
    mode = MODE_NONE;
    autoDetectRoomFromSeed(p);
    return;
  }
});

// ---------- Auto Detect (OpenCV) ----------
function autoDetectRoomFromSeed(seedCanvasPt) {
  try {
    setStatus("Detecting room outline…");

    // Ensure canvas is drawn with the image before reading pixels
    draw();

    // Read canvas into OpenCV Mat
    const src = cv.imread(canvas);

    // Preprocess
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    const blur = new cv.Mat();
    cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);

    const edges = new cv.Mat();
    cv.Canny(blur, edges, 50, 150);

    // Close small gaps in lines
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
    const closed = new cv.Mat();
    cv.morphologyEx(edges, closed, cv.MORPH_CLOSE, kernel);

    // Find contours
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(closed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    // Pick the biggest contour that contains the seed click
    let bestIdx = -1;
    let bestArea = 0;
    const seedPt = new cv.Point(seedCanvasPt.x, seedCanvasPt.y);

    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i);
      const a = cv.contourArea(cnt);
      if (a < 2000) continue; // ignore tiny noise

      const inside = cv.pointPolygonTest(cnt, seedPt, false);
      if (inside >= 0 && a > bestArea) {
        bestArea = a;
        bestIdx = i;
      }
    }

    if (bestIdx === -1) {
      cleanup();
      setStatus("Couldn’t find a closed room outline. Try a clearer image or click again inside the room.");
      return;
    }

    const best = contours.get(bestIdx);

    // Simplify contour to a polygon
    const approx = new cv.Mat();
    const epsilon = 0.01 * cv.arcLength(best, true);
    cv.approxPolyDP(best, approx, epsilon, true);

    const poly = [];
    for (let i = 0; i < approx.data32S.length; i += 2) {
      poly.push({ x: approx.data32S[i], y: approx.data32S[i + 1] });
    }

    if (poly.length < 3) {
      cleanup();
      setStatus("Detected shape was too small/invalid. Try another click or a higher-res image.");
      return;
    }

    // Save + compute area
    resultPoly = poly;
    resultClosed = true;

    const areaPx2 = polygonAreaPixels(resultPoly);
    const areaUnit2 = areaPx2 / (pixelsPerUnit * pixelsPerUnit);

    areaOut.textContent = `${areaUnit2.toFixed(2)} ${areaUnitLabel()}`;
    setStatus("Auto-detect complete. If it grabbed the wrong region, click Auto Detect and try again.");
    draw();

    cleanup();

    function cleanup() {
      src.delete(); gray.delete(); blur.delete(); edges.delete();
      kernel.delete(); closed.delete(); contours.delete(); hierarchy.delete();
      approx.delete();
    }

  } catch (err) {
    console.error(err);
    setStatus("Error during detection. Try refreshing or using a simpler/high-contrast image.");
  }
}

// Initial UI
setStatus("Loading OpenCV…");
draw();
