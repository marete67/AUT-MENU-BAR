console.log("👉 RENDER MENU NUEVO CARGADO", __filename);

const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const path = require("path");
const https = require("https");
const fs   = require("fs");

// ===== FONT CACHE =====
const FONT_CACHE_DIR = path.join(__dirname, "fonts", "cache");
if (!fs.existsSync(FONT_CACHE_DIR)) fs.mkdirSync(FONT_CACHE_DIR, { recursive: true });

const _fontCache = {};

// GET with redirect following, returns string body
function httpsText(url, headers = {}, redirects = 5) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    https.get({ hostname: u.hostname, path: u.pathname + u.search, headers }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        return resolve(httpsText(res.headers.location, headers, redirects - 1));
      }
      let d = ""; res.on("data", c => d += c); res.on("end", () => resolve(d));
    }).on("error", reject);
  });
}

// Binary download with redirect following
function httpsDownload(url, dest, redirects = 5) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    https.get({ hostname: u.hostname, path: u.pathname + u.search }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        return resolve(httpsDownload(res.headers.location, dest, redirects - 1));
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
      file.on("error", err => { fs.unlink(dest, () => {}); reject(err); });
    }).on("error", err => { fs.unlink(dest, () => {}); reject(err); });
  });
}

async function resolveFont(family) {
  family = (family || "Open Sans").trim();
  if (_fontCache[family]) return family;

  const fileName = family.replace(/\s+/g, "_");
  const ttfPath  = path.join(FONT_CACHE_DIR, fileName + ".ttf");

  // Validate cached file: must start with TTF/OTF magic bytes
  if (fs.existsSync(ttfPath)) {
    const buf = Buffer.alloc(4);
    const fd  = fs.openSync(ttfPath, "r");
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    const sig   = buf.toString("hex");
    const valid = sig === "00010000" || sig === "74727565" || sig === "4f54544f";
    if (!valid) {
      fs.unlinkSync(ttfPath);
      console.log(`⚠ Cache inválido para "${family}", re-descargando...`);
    }
  }

  if (!fs.existsSync(ttfPath)) {
    // UA antiguo → Google Fonts devuelve URLs TTF
    const cssUrl = "https://fonts.googleapis.com/css?family=" + encodeURIComponent(family) + "&subset=latin";
    const css = await httpsText(cssUrl, {
      "User-Agent": "Mozilla/5.0 (Windows NT 5.1; rv:11.0) Gecko Firefox/11.0"
    });

    const match = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/i);
    if (!match) throw new Error(`Fuente no encontrada: ${family}\nCSS:\n${css.slice(0, 400)}`);

    await httpsDownload(match[1], ttfPath);
    console.log(`✅ Fuente descargada: ${family}`);
  }

  GlobalFonts.registerFromPath(ttfPath, family);
  _fontCache[family] = true;
  console.log(`🔤 Font registrada: "${family}"`);
  return family;
}

// ===== FUNCIONES DE TEXTO =====
function measureTextWithLetterSpacing(ctx, text, letterSpacing) {
  let width = 0;
  for (const char of text) width += ctx.measureText(char).width + letterSpacing;
  return width - letterSpacing;
}

function drawTextWithLetterSpacing(ctx, text, x, y, letterSpacing) {
  let currentX = x;
  for (const char of text) {
    ctx.fillText(char, currentX, y);
    currentX += ctx.measureText(char).width + letterSpacing;
  }
}

function drawAlignedLine(ctx, text, blockX, blockW, y, letterSpacing, align) {
  const textWidth = measureTextWithLetterSpacing(ctx, text, letterSpacing);
  const scaleX = textWidth > blockW ? blockW / textWidth : 1;

  ctx.save();
  if (align === "left") {
    ctx.translate(blockX, y);
    ctx.scale(scaleX, 1);
    drawTextWithLetterSpacing(ctx, text, 0, 0, letterSpacing);
  } else if (align === "center") {
    ctx.translate(blockX + blockW / 2, y);
    ctx.scale(scaleX, 1);
    drawTextWithLetterSpacing(ctx, text, -textWidth / 2, 0, letterSpacing);
  } else {
    // right
    ctx.translate(blockX + blockW, y);
    ctx.scale(scaleX, 1);
    drawTextWithLetterSpacing(ctx, text, -textWidth, 0, letterSpacing);
  }
  ctx.restore();
}

function drawBlock(ctx, lines, blockX, blockW, startY, fontSize, letterSpacing, align, lineHeightFactor) {
  let y = startY;
  for (const line of lines) {
    drawAlignedLine(ctx, line, blockX, blockW, y, letterSpacing, align);
    y += fontSize * lineHeightFactor;
  }
}

// ===== FUNCIÓN PRINCIPAL =====
async function renderMenu(data) {
  if (!data.fondo_png && !data.fondo_b64) throw new Error("fondo_png o fondo_b64 requerido");

  // Precargar todas las fuentes únicas ANTES de crear el canvas
  const families = [...new Set(data.blocks.map(b => b.font_family || data.font_family || 'Open Sans'))];
  for (const fam of families) await resolveFont(fam);

  const FORMATOS = {
    story: { width: 1080, height: 1920 },
    folio: { width: 2480, height: 3508 },
  };
  const fmt = FORMATOS[data.formato] ?? FORMATOS.story;

  const WIDTH              = data.width              ?? fmt.width;
  const HEIGHT             = data.height             ?? fmt.height;
  const LETTER_SPACING     = data.letter_spacing     ?? 1.4;
  const LINE_HEIGHT_FACTOR = data.line_height_factor ?? 1.4;

  const blocks = data.blocks;
  if (!blocks || !Array.isArray(blocks)) throw new Error("blocks[] requerido");

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");
  ctx.textBaseline = "top"; // el editor posiciona bloques por su borde superior, no por la baseline

  // Fondo — comportamiento "cover": escala manteniendo proporción y recorta igual que el editor
  const fondoSrc = data.fondo_b64
    ? Buffer.from(data.fondo_b64, "base64")
    : path.join(__dirname, "assets", data.fondo_png);
  const img = await loadImage(fondoSrc);
  const scale = Math.max(WIDTH / img.width, HEIGHT / img.height);
  const scaledW = img.width * scale;
  const scaledH = img.height * scale;
  const offsetX = (WIDTH - scaledW) / 2;
  const offsetY = (HEIGHT - scaledH) / 2;
  ctx.drawImage(img, offsetX, offsetY, scaledW, scaledH);

  // Texto — fuente y color por bloque
  for (const block of blocks) {
    const raw = block.content ?? "";
    const lines = Array.isArray(raw)
      ? raw.filter(l => l && l.trim())
      : String(raw).split("\n").filter(l => l && l.trim());
    if (!lines.length) continue;

    const fontSize = Number(block.font_size) || 30;
    const family   = block.font_family || data.font_family || "Open Sans";
    ctx.font      = `${fontSize}px "${family}"`;
    ctx.fillStyle = block.text_color || data.text_color || "#000";

    drawBlock(
      ctx, lines,
      Number(block.x) || 0,
      Number(block.w) || 100,
      Number(block.y) || 100,
      fontSize, LETTER_SPACING,
      block.align || "right",
      LINE_HEIGHT_FACTOR
    );
  }

  console.log("🔥 RENDER EN MEMORIA");
  const outFmt = data.output_format === "jpg" || data.output_format === "jpeg" ? "image/jpeg" : "image/png";
  return canvas.toBuffer(outFmt);
}

module.exports = renderMenu;
