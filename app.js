// ===== Blueprint Flooring Estimator (Rectangle Drag) + FAQ Chatbot =====

// --------- Estimator (your original idea) ----------
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
let savedRects = [];  // optional multi-selection

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
  for (const r of savedRects) {
    ctx.strokeRect(r.x, r.y, r.w, r.h);
  }
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
    setStatus("Image loaded. Drag a rectangle over the flooring area.");
    areaOut.textContent = "—";
    draw();

    // Chat bot greeting
    chatAddBot("Blueprint loaded! Drag a rectangle over the room, then enter the real width and height when prompted.\nYou can ask me: “what is sqft?”, “how many boxes do I need?”, “what waste factor should I use?”");
  };
  img.src = url;
});

// Drag events
canvas.addEventListener("mousedown", (e) => {
  if (!imgLoaded) return;
  isDragging = true;
  dragStart = canvasPointFromMouse(e);
  dragEnd = dragStart;
  setStatus("Dragging... release to finish.");
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

  // Ask user for real-world dimensions
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

  chatAddBot(`Saved selection: ${sqft.toFixed(2)} sq ft.\nIf you want boxes estimate, ask: “boxes for ${sqft.toFixed(2)} sqft at 20 sqft per box”.`);

  dragStart = null;
  dragEnd = null;
  draw();
});

// --------- FAQ Chatbot (Rule-Based) ----------
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

// Quick parsing helpers for “boxes” questions
function parseNumberNear(text, keyword) {
  // grabs first number that appears after the keyword
  const idx = text.indexOf(keyword);
  if (idx === -1) return null;
  const after = text.slice(idx + keyword.length);
  const match = after.match(/(-?\d+(\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function parseSqft(text) {
  // tries to find “X sqft” or “X sq ft” or just first number
  const m = text.match(/(\d+(\.\d+)?)\s*(sq\s*ft|sqft)/i);
  if (m) return Number(m[1]);
  const any = text.match(/(\d+(\.\d+)?)/);
  return any ? Number(any[1]) : null;
}

function handleChat(userTextRaw) {
  const userText = normalize(userTextRaw);

  // Greetings
  if (/(^hi$|^hello$|^hey$|good morning|good afternoon|good evening)/.test(userText)) {
    return "Hi! Ask me how to use the estimator, what sqft means, waste factor, or boxes needed.";
  }

  // How to use
  if (userText.includes("how do i use") || userText.includes("how to use") || userText.includes("instructions")) {
    return (
      "How to use:\n" +
      "1) Upload a blueprint image.\n" +
      "2) Drag a rectangle over the room area.\n" +
      "3) Enter the real width + height (feet) when prompted.\n" +
      "4) The app shows the square footage.\n\n" +
      "Tip: For irregular rooms, you can drag multiple rectangles and add them up."
    );
  }

  // What is sqft
  if (userText.includes("what is sqft") || userText.includes("what is sq ft") || userText.includes("square feet")) {
    return (
      "Square footage (sq ft) is area: width × height measured in feet.\n" +
      "Example: 10 ft × 12 ft = 120 sq ft."
    );
  }

  // Waste factor
  if (userText.includes("waste") || userText.includes("extra") || userText.includes("overage")) {
    return (
      "Waste factor is extra flooring to cover cuts, mistakes, and odd angles.\n" +
      "Common rule:\n" +
      "- 10% extra for simple rooms\n" +
      "- 15% extra for complicated layouts\n" +
      "- Up to 20% for diagonal patterns"
    );
  }

  // Boxes needed: “boxes for 500 sqft at 20 sqft per box”
  if (userText.includes("box") || userText.includes("boxes")) {
    const sqft = parseSqft(userTextRaw);
    // try multiple ways to interpret coverage
    let coverage = null;

    // “per box”
    const perBox = userTextRaw.match(/(\d+(\.\d+)?)\s*(sq\s*ft|sqft)\s*(per|\/)\s*box/i);
    if (perBox) coverage = Number(perBox[1]);

    // “at 20 sqft”
    if (!coverage) {
      const at = userTextRaw.match(/at\s+(\d+(\.\d+)?)/i);
      if (at) coverage = Number(at[1]);
    }

    if (!sqft) {
      return "Tell me the total sqft and the coverage per box.\nExample: “boxes for 480 sqft at 20 sqft per box”.";
    }
    if (!coverage || coverage <= 0) {
      return `I see ${sqft} sqft. What’s the coverage per box?\nExample: “${sqft} sqft at 20 sqft per box”.`;
    }

    const boxes = Math.ceil(sqft / coverage);
    return `Estimated boxes needed: ceil(${sqft} / ${coverage}) = ${boxes} box(es).\nWant waste factor included? Say: “add 10% waste”.`;
  }

  // Add waste factor to last computed area (if user asks)
  if (userText.includes("add") && userText.includes("%") && userText.includes("waste")) {
    const percMatch = userText.match(/(\d+)\s*%/);
    const p = percMatch ? Number(percMatch[1]) : null;

    const lastAreaText = areaOut.textContent || "";
    const lastAreaMatch = lastAreaText.match(/(\d+(\.\d+)?)/);
    const lastSqft = lastAreaMatch ? Number(lastAreaMatch[1]) : null;

    if (!p || p <= 0) return "Tell me the waste percent like: “add 10% waste”.";
    if (!lastSqft) return "I don’t see a saved sqft yet. Drag a rectangle first so we have an area.";

    const newTotal = lastSqft * (1 + p / 100);
    return `With ${p}% waste: ${lastSqft.toFixed(2)} × (1 + ${p}/100) = ${newTotal.toFixed(2)} sq ft.`;
  }

  // Default fallback
  return (
    "I can help with:\n" +
    "- How to use the estimator\n" +
    "- What sq ft means\n" +
    "- Waste factor recommendations\n" +
    "- Estimating boxes needed\n\n" +
    "Try asking: “how do I use this?” or “boxes for 480 sqft at 20 sqft per box”."
  );
}

function sendChat() {
  const text = chatInput.value.trim();
  if (!text) return;
  chatAddUser(text);
  chatInput.value = "";
  const reply = handleChat(text);
  chatAddBot(reply);
}

chatSend.addEventListener("click", sendChat);
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendChat();
});

// Initial greeting
chatAddBot(
  "Hi! I’m the helper chatbot for this flooring estimator.\n" +
  "Ask me how to use it, what sqft means, waste factor, or boxes needed."
);
