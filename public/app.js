const canvas = document.getElementById("gridCanvas");
const ctx = canvas.getContext("2d");
const form = document.getElementById("controls");
const statusEl = document.getElementById("status");
const downloadBtn = document.getElementById("download");

const vintageCameras = [
  "Leica M3 (1954)",
  "Rolleiflex 2.8F (1960)",
  "Nikon F (1959)",
  "Canon AE-1 (1976)",
  "Hasselblad 500C/M (1970)",
  "Pentax Spotmatic (1964)",
  "Zeiss Ikon Contessa (1950)",
  "Kodak Retina IIa (1951)",
  "Olympus OM-1 (1972)",
  "Yashica Mat-124G (1970)",
  "Minolta SR-T 101 (1966)",
  "Voigtländer Bessa II (1950)",
  "Argus C3 (1939)",
  "Graflex Speed Graphic (1947)",
  "Polaroid SX-70 (1972)",
];

const orientations = ["front", "back", "left", "right"];

function getGridDimensions(count, w, h) {
  const aspect = w / h;
  let cols = Math.ceil(Math.sqrt(count * aspect));
  let rows = Math.ceil(count / cols);
  return { cols, rows };
}

function applyShelfMaterial(ctx, material, x, y, w, h) {
  if (material.includes("wood") || material.includes("oak") || material.includes("walnut")) {
    const grad = ctx.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, "#5d3f2e");
    grad.addColorStop(1, "#3b261b");
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    for (let i = 0; i < 6; i++) {
      const yy = y + (i + 1) * (h / 7);
      ctx.beginPath();
      ctx.moveTo(x, yy);
      ctx.bezierCurveTo(x + w * 0.3, yy - 5, x + w * 0.6, yy + 6, x + w, yy - 3);
      ctx.stroke();
    }
    return;
  }

  if (material.includes("marble")) {
    ctx.fillStyle = "#f2f2f4";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "rgba(110,110,130,0.18)";
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.moveTo(x + Math.random() * w, y);
      ctx.lineTo(x + Math.random() * w, y + h);
      ctx.stroke();
    }
    return;
  }

  if (material.includes("glass")) {
    ctx.fillStyle = "rgba(200,230,255,0.22)";
    ctx.fillRect(x, y, w, h);
    const glassGrad = ctx.createLinearGradient(x, y, x, y + h);
    glassGrad.addColorStop(0, "rgba(255,255,255,0.35)");
    glassGrad.addColorStop(1, "rgba(255,255,255,0.05)");
    ctx.fillStyle = glassGrad;
    ctx.fillRect(x, y, w, h);
    return;
  }

  ctx.fillStyle = "#b4b9c1";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(60,70,85,0.2)";
  for (let i = 0; i < 10; i++) {
    const yy = y + (i / 9) * h;
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.lineTo(x + w, yy + Math.sin(i) * 2);
    ctx.stroke();
  }
}

function drawShelfGrid(w, h, count, material) {
  canvas.width = w;
  canvas.height = h;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#121317";
  ctx.fillRect(0, 0, w, h);

  const { cols, rows } = getGridDimensions(count, w, h);
  const gutter = Math.max(8, Math.floor(Math.min(w, h) * 0.008));
  const cellW = Math.floor((w - gutter * (cols + 1)) / cols);
  const cellH = Math.floor((h - gutter * (rows + 1)) / rows);

  const cells = [];
  let index = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (index >= count) break;
      const x = gutter + c * (cellW + gutter);
      const y = gutter + r * (cellH + gutter);
      applyShelfMaterial(ctx, material, x, y, cellW, cellH);
      ctx.strokeStyle = "rgba(30,30,35,0.55)";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, cellW, cellH);
      cells.push({ x, y, w: cellW, h: cellH, index });
      index += 1;
    }
  }
  return cells;
}

async function fetchCellCamera(backgroundDataUrl, cameraName, orientation, material, cellW, cellH) {
  const response = await fetch("/api/generate-camera", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      backgroundDataUrl,
      cameraName,
      orientation,
      material,
      cellWidth: cellW,
      cellHeight: cellH,
    }),
  });
  if (!response.ok) throw new Error(`Generation failed: ${response.status}`);
  return response.json();
}

function cropCellBackground(cell) {
  const offscreen = document.createElement("canvas");
  offscreen.width = cell.w;
  offscreen.height = cell.h;
  const octx = offscreen.getContext("2d");
  octx.drawImage(canvas, cell.x, cell.y, cell.w, cell.h, 0, 0, cell.w, cell.h);
  return offscreen.toDataURL("image/png");
}

function drawDataUrlInCell(dataUrl, cell) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      ctx.drawImage(image, cell.x, cell.y, cell.w, cell.h);
      resolve();
    };
    image.onerror = reject;
    image.src = dataUrl;
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  downloadBtn.disabled = true;

  const width = Number(document.getElementById("width").value);
  const height = Number(document.getElementById("height").value);
  const cameraCount = Number(document.getElementById("cameraCount").value);
  const material = document.getElementById("material").value;

  const cells = drawShelfGrid(width, height, cameraCount, material);
  statusEl.textContent = `Generating ${cells.length} cameras...`;

  for (const [i, cell] of cells.entries()) {
    const cameraName = vintageCameras[i % vintageCameras.length];
    const orientation = orientations[i % orientations.length];
    const backgroundDataUrl = cropCellBackground(cell);

    try {
      const { imageDataUrl, mode } = await fetchCellCamera(
        backgroundDataUrl,
        cameraName,
        orientation,
        material,
        cell.w,
        cell.h,
      );
      await drawDataUrlInCell(imageDataUrl, cell);
      statusEl.textContent = `Rendered ${i + 1}/${cells.length} cameras (${mode} mode)`;
    } catch (error) {
      console.error(error);
      statusEl.textContent = `Error while rendering cell ${i + 1}.`;
    }
  }

  statusEl.textContent = `Done. Rendered ${cells.length} cameras.`;
  downloadBtn.disabled = false;
});

downloadBtn.addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = "vintage-camera-grid.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
});
