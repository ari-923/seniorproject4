// ===== Blueprint Flooring Estimator (Drag Rectangle) + Helper Chatbot =====

// -------- Estimator --------
const fileInput = document.getElementById("fileInput");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const statusEl = document.getElementById("status");
const areaOut = document.getElementById("areaOut");

let img = new Image();
let imgLoaded = false;

let isDragging = false;
let dragStart = null; // {x,y}
let dragEnd = null;   // {x,y}
let savedRects = [];  // optional: multiple rectangles

function setStatus(msg) {
  statusEl.textContent = "Status: " + msg;
}

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
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

function rectFromPoints(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const w = Math.abs(a.x - b.x);
  const h = Math.abs(a.y - b.y);
  return { x, y, w, h };
}

function canvasPointFromMouse(e) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  return { x, y };
}

function draw() {
  clearCanvas();

  if (imgLoaded) {
    const fit = getFitRect(img.width, img.height, canvas.width, canvas.height);
    ctx.drawImage(img, fit.x, fit.y, fit.w, fit.h);
  }

  // Saved rectangles
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "green";
  for (const r of savedRects) ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.restore();

  // Current drag rectangle
  if (dragStart && dragEnd) {
    const r = rectFromPoints(dragStart, dragEnd);
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "blue";
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.restore();
  }
}

// Upload
fileInput.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  img = new Image();
  img.onload = () => {
    imgLoaded = true;
    savedRects = [];
    dragStart = null;
    dragEnd = null;
    areaOut.textContent = "—";
    setStatus("Image loaded. Drag a rectangle over the room area.");
    draw();

    chatAddBot(
      "Blueprint loaded ✅\n" +
      "Drag a rectangle over the room, then enter the real width & height (feet).\n" +
      "Ask me: “what is sqft?”, “add 10% waste”, “boxes for 480 sqft at 20 sqft per box”."
    );
  };
  img.src = url;
});

// Drag events
canvas.addEventListener("mousedown", (e) => {
  if (!imgLoaded) return;
  isDragging = true;
  dragStart = canvasPointFromMouse(e);
  dragEnd = dragStart;
  setStatus("Dragging… release to finish.");
  draw();
});

canvas.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  dragEnd = canvasPointFromMouse(e);
  draw();
});

canvas.addEventListener("mouseup", () => {
  if (!isDragging) return;
  isDragging = false;

  if (!dragStart || !dragEnd) return;

  const r = rectFromPoints(dragStart, dragEnd);

  if (r.w < 10 || r.h < 10) {
    setStatus("Rectangle too small. Drag a bigger area.");
    dragStart = null;
    dragEnd = null;
    draw();
    return;
  }

  const realW = prompt("Enter REAL width of this selected area (feet):", "10");
  const realH = prompt("Enter REAL height of this selected area (feet):", "12");

  const wNum = Number(realW);
  const hNum = Number(realH);

  if (!wNum || !hNum || wNum <= 0 || hNum <= 0) {
    setStatus("Invalid dimensions. Selection not saved.");
    dragStart = null;
    dragEnd = null;
    draw();
    return;
  }

  const sqft = wNum * hNum;
  savedRects.push(r);

  areaOut.textContent = `${sqft.toFixed(2)} sq ft (last selection)`;
  setStatus("Saved. Drag another rectangle to add more areas.");

  chatAddBot(
    `Saved selection: ${sqft.toFixed(2)} sq ft.\n` +
    `Want boxes? Ask: “boxes for ${sqft.toFixed(2)} sqft at 20 sqft per box”.\n` +
    `Want waste? Ask: “add 10% waste”.`
  );

  dragStart = null;
  dragEnd = null;
  draw();
});

// -------- Helper Chatbot (Rule-Based FAQ) --------
const chatlog = document.getElementById("chatlog");
const chatInput = document.getElementById("chatInput");
const chatSend = document.getElementById("chatSend");

function chatAddMessage(text, who) {
  const div = document.createElement("div");
  div.className = `msg ${who}`;
  div.textContent = text;
  chatlog.appendChild(div);
  chatlog.scrollTop = chatlog.scrollHeight;
}
function chatAddUser(text) { chatAddMessage(text, "user"); }
function chatAddBot(text)  { chatAddMessage(text, "bot"); }

function normalize(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^\w\s.%]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSqft(raw) {
  const m = raw.match(/(\d+(\.\d+)?)\s*(sq\s*ft|sqft)/i);
  if (m) return Number(m[1]);
  const any = raw.match(/(\d+(\.\d+)?)/);
  return any ? Number(any[1]) : null;
}

function handleChat(rawText) {
  const t = normalize(rawText);

  // greetings
  if (/^(hi|hello|hey)$/.test(t) || t.includes("good morning") || t.includes("good afternoon") || t.includes("good evening")) {
    return "Hi! Ask me how to use the estimator, what sqft means, waste factor, or boxes needed.";
  }

  // how to use
  if (t.includes("how do i use") || t.includes("how to use") || t.includes("instructions") || t.includes("help")) {
    return (
      "How to use:\n" +
      "1) Upload a blueprint image.\n" +
      "2) Drag a rectangle over the room area.\n" +
      "3) Enter the real width and height (feet) when prompted.\n" +
      "4) The app shows the square footage.\n\n" +
      "Tip: For irregular rooms, do multiple rectangles and add them up."
    );
  }

  // sqft definition
  if (t.includes("what is sqft") || t.includes("what is sq ft") || t.includes("square feet")) {
    return (
      "Square footage (sq ft) is area.\n" +
      "Formula: width × height (in feet).\n" +
      "Example: 10 ft × 12 ft = 120 sq ft."
    );
  }

  // waste factor
  if (t.includes("waste") || t.includes("overage") || t.includes("extra")) {
    return (
      "Waste factor = extra flooring for cuts/mistakes.\n" +
      "Common rule:\n" +
      "- 10% extra: simple rooms\n" +
      "- 15% extra: complex layouts\n" +
      "- up to 20%: diagonal patterns"
    );
  }

  // add X% waste using last shown area
  if (t.includes("add") && t.includes("%") && t.includes("waste")) {
    const percMatch = t.match(/(\d+)\s*%/);
    const p = percMatch ? Number(percMatch[1]) : null;

    const lastAreaText = areaOut.textContent || "";
    const lastAreaMatch = lastAreaText.match(/(\d+(\.\d+)?)/);
    const lastSqft = lastAreaMatch ? Number(lastAreaMatch[1]) : null;

    if (!p || p <= 0) return "Tell me the waste percent like: “add 10% waste”.";
    if (!lastSqft) return "I don’t see a saved sqft yet. Drag a rectangle first so we have an area.";

    const total = lastSqft * (1 + p / 100);
    return `With ${p}% waste: ${lastSqft.toFixed(2)} × (1 + ${p}/100) = ${total.toFixed(2)} sq ft.`;
  }

  // boxes estimate
  if (t.includes("box") || t.includes("boxes")) {
    const sqft = parseSqft(rawText);
    const coverageMatch = rawText.match(/(\d+(\.\d+)?)\s*(sq\s*ft|sqft)\s*(per|\/)\s*box/i);
    const atMatch = rawText.match(/at\s+(\d+(\.\d+)?)/i);

    const coverage = coverageMatch ? Number(coverageMatch[1]) : (atMatch ? Number(atMatch[1]) : null);

    if (!sqft) return "Tell me total sqft and coverage per box.\nExample: “boxes for 480 sqft at 20 sqft per box”.";
    if (!coverage || coverage <= 0) return `I see ${sqft} sqft. What’s the coverage per box?\nExample: “${sqft} sqft at 20 sqft per box”.`;

    const boxes = Math.ceil(sqft / coverage);
    return `Estimated boxes: ceil(${sqft} / ${coverage}) = ${boxes} box(es).`;
  }

  // fallback
  return (
    "I can help with:\n" +
    "- using the estimator\n" +
    "- what sq ft means\n" +
    "- waste factor\n" +
    "- boxes needed\n\n" +
    "Try: “how do I use this?” or “boxes for 480 sqft at 20 sqft per box”."
  );
}

function sendChat() {
  const text = chatInput.value.trim();
  if (!text) return;
  chatAddUser(text);
  chatInput.value = "";
  chatAddBot(handleChat(text));
}

chatSend.addEventListener("click", sendChat);
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendChat();
});

// initial message
chatAddBot(
  "Hi! I’m the helper chat for this flooring estimator.\n" +
  "Ask: “how do I use this?”, “what is sqft?”, “add 10% waste”, “boxes for 480 sqft at 20 sqft per box”."
);

// initial draw
draw();
