import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");
const port = process.env.PORT || 3000;

function getContentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  return "text/plain; charset=utf-8";
}

function dataUrlToBuffer(dataUrl) {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) throw new Error("Invalid data URL");
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

function fallbackCameraSvg({ cameraName, orientation, width, height, material }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs><linearGradient id="body" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2f2f34"/><stop offset="1" stop-color="#101013"/></linearGradient></defs>
  <ellipse cx="${width / 2}" cy="${height * 0.82}" rx="${width * 0.24}" ry="${height * 0.07}" fill="rgba(0,0,0,0.35)"/>
  <rect x="${width * 0.24}" y="${height * 0.34}" width="${width * 0.52}" height="${height * 0.32}" rx="10" fill="url(#body)" stroke="#8c8c94" stroke-width="2"/>
  <circle cx="${width * 0.5}" cy="${height * 0.5}" r="${Math.min(width, height) * 0.11}" fill="#5f6370" stroke="#c8ccd8" stroke-width="2"/>
  <rect x="${width * 0.35}" y="${height * 0.26}" width="${width * 0.3}" height="${height * 0.08}" rx="4" fill="#1e1e24"/>
  <text x="50%" y="${height * 0.12}" text-anchor="middle" font-size="${Math.max(10, width * 0.055)}" fill="#e8e8ec" font-family="Arial, sans-serif">${cameraName}</text>
  <text x="50%" y="${height * 0.94}" text-anchor="middle" font-size="${Math.max(8, width * 0.045)}" fill="#d4d4dc" font-family="Arial, sans-serif">${orientation.toUpperCase()} VIEW • ${material}</text>
</svg>`;
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function handleGenerateCamera(req, res) {
  try {
    const body = await readJsonBody(req);
    const { backgroundDataUrl, cameraName, orientation, material, cellWidth, cellHeight } = body;

    if (!backgroundDataUrl || !cameraName || !orientation || !material) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing required fields." }));
      return;
    }

    if (!process.env.OPENAI_API_KEY) {
      const svg = fallbackCameraSvg({
        cameraName,
        orientation,
        width: cellWidth,
        height: cellHeight,
        material,
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ imageDataUrl: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`, mode: "fallback" }));
      return;
    }

    const { buffer } = dataUrlToBuffer(backgroundDataUrl);
    const formData = new FormData();
    formData.append("model", "gpt-image-1");
    formData.append("prompt", [
      "Create a historically accurate vintage camera photograph for a collector grid cell.",
      `Camera model: ${cameraName}.`,
      `View orientation: strict orthographic ${orientation} side view (no perspective skew).`,
      "The camera must sit naturally inside the provided shelf cell background with realistic contact shadows and material-consistent reflections.",
      "Do not alter the background structure; place only one camera centered in the cell.",
      "Photorealistic studio quality, high detail, no text, no watermark, no extra objects."
    ].join(" "));
    formData.append("size", `${Math.min(1024, cellWidth)}x${Math.min(1024, cellHeight)}`);
    formData.append("image", new Blob([buffer], { type: "image/png" }), "cell-background.png");

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: formData,
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`OpenAI request failed: ${response.status} ${details}`);
    }

    const payload = await response.json();
    const b64 = payload.data?.[0]?.b64_json;
    if (!b64) throw new Error("Image generation did not return image data.");

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ imageDataUrl: `data:image/png;base64,${b64}`, mode: "openai" }));
  } catch (error) {
    console.error(error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to generate camera image." }));
  }
}

async function handleStatic(req, res) {
  const urlPath = req.url === "/" ? "/index.html" : req.url;
  const safePath = path.normalize(urlPath).replace(/^\/+/, "");
  const filePath = path.join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const content = await fs.readFile(filePath);
    res.writeHead(200, { "Content-Type": getContentType(filePath) });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end("Not Found");
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/generate-camera") {
    await handleGenerateCamera(req, res);
    return;
  }

  if (req.method === "GET") {
    await handleStatic(req, res);
    return;
  }

  res.writeHead(405);
  res.end("Method Not Allowed");
});

server.listen(port, () => {
  console.log(`Vintage camera collector app listening at http://localhost:${port}`);
});
