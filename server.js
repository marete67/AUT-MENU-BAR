require("dotenv").config();
const express    = require("express");
const path       = require("path");
const fs         = require("fs");
const jwt        = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { pool, initDB } = require("./db");
const renderMenu = require("./renderMenu");
const ig         = require("./instagram");

const app = express();
const JWT_SECRET = process.env.JWT_SECRET;

// Carpeta temporal para imágenes que Instagram debe descargar
const TEMP_DIR = path.join(__dirname, "temp");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);
app.use("/temp", express.static(TEMP_DIR));

// Carpeta para páginas de links públicos
const PUBLIC_PAGES_DIR = path.join(__dirname, "public_pages");
if (!fs.existsSync(PUBLIC_PAGES_DIR)) fs.mkdirSync(PUBLIC_PAGES_DIR);
app.use("/public_pages", express.static(PUBLIC_PAGES_DIR));

// ===== NODEMAILER =====
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

async function sendEmailWithPng(to, subject, pngBuffer, templateName) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    html: `<p>Adjunto encontrarás el menú: <strong>${templateName}</strong></p>`,
    attachments: [{ filename: "menu.png", content: pngBuffer, contentType: "image/png" }],
  });
}

app.use(express.json({ limit: "20mb" }));

// ===== CUSTOM DOMAIN MIDDLEWARE =====
// Must run before static so custom domains are caught first
app.use(async (req, res, next) => {
  const host = req.hostname;
  const appHost = (() => { try { return new URL(process.env.APP_BASE_URL || "http://localhost").hostname; } catch { return "localhost"; } })();
  if (host === appHost || host === "localhost" || host === "127.0.0.1") return next();
  try {
    const [rows] = await pool.execute("SELECT * FROM public_links WHERE custom_domain = ?", [host]);
    if (!rows.length) return next();
    return res.setHeader("Content-Type", "text/html; charset=utf-8").send(buildViewerHTML(rows[0]));
  } catch { return next(); }
});

app.use(express.static(path.join(__dirname)));

// Root → login
app.get("/", (_req, res) => res.redirect("/login.html"));

// ===== AUTH MIDDLEWARE =====
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "No autorizado" });
  const token = header.replace("Bearer ", "");
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
}

// ===== LOGIN =====
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Faltan credenciales" });

  const [rows] = await pool.execute(
    "SELECT id, username FROM users WHERE username = ? AND password = ?",
    [username, password]
  );

  if (!rows.length)
    return res.status(401).json({ error: "Usuario o contraseña incorrectos" });

  const token = jwt.sign({ id: rows[0].id, username: rows[0].username }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, username: rows[0].username });
});

// ===== CUENTA =====
app.get("/api/me", auth, async (req, res) => {
  const [rows] = await pool.execute("SELECT id, username, created_at FROM users WHERE id=?", [req.user.id]);
  res.json(rows[0]);
});

app.put("/api/me/password", auth, async (req, res) => {
  const { current, newPassword } = req.body;
  if (!current || !newPassword) return res.status(400).json({ error: "Faltan datos" });
  if (newPassword.length < 6) return res.status(400).json({ error: "Mínimo 6 caracteres" });
  const [rows] = await pool.execute("SELECT id FROM users WHERE id=? AND password=?", [req.user.id, current]);
  if (!rows.length) return res.status(401).json({ error: "Contraseña actual incorrecta" });
  await pool.execute("UPDATE users SET password=? WHERE id=?", [newPassword, req.user.id]);
  res.json({ ok: true });
});

// ===== TEMPLATES =====
app.get("/api/templates", auth, async (req, res) => {
  const [rows] = await pool.execute(
    "SELECT id, name, created_at, updated_at FROM templates WHERE user_id = ? ORDER BY updated_at DESC",
    [req.user.id]
  );
  res.json(rows);
});

app.get("/api/templates/:id", auth, async (req, res) => {
  const [rows] = await pool.execute(
    "SELECT * FROM templates WHERE id = ? AND user_id = ?",
    [req.params.id, req.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: "No encontrado" });
  rows[0].config = JSON.parse(rows[0].config);
  res.json(rows[0]);
});

app.post("/api/templates", auth, async (req, res) => {
  const { name, config } = req.body;
  if (!name || !config) return res.status(400).json({ error: "Faltan datos" });
  const [result] = await pool.execute(
    "INSERT INTO templates (user_id, name, config) VALUES (?, ?, ?)",
    [req.user.id, name, JSON.stringify(config)]
  );
  res.json({ id: result.insertId, name });
});

app.put("/api/templates/:id", auth, async (req, res) => {
  const { name, config } = req.body;
  await pool.execute(
    "UPDATE templates SET name = ?, config = ?, updated_at = NOW() WHERE id = ? AND user_id = ?",
    [name, JSON.stringify(config), req.params.id, req.user.id]
  );
  res.json({ ok: true });
});

app.delete("/api/templates/:id", auth, async (req, res) => {
  await pool.execute(
    "DELETE FROM templates WHERE id = ? AND user_id = ?",
    [req.params.id, req.user.id]
  );
  res.json({ ok: true });
});

// ===== RENDER =====
app.post("/api/render", auth, async (req, res) => {
  try {
    if (!req.body.fondo_png && !req.body.fondo_b64)
      return res.status(400).json({ error: "Falta fondo_png o fondo_b64" });
    if (!Array.isArray(req.body.blocks) || !req.body.blocks.length)
      return res.status(400).json({ error: "Falta blocks[]" });

    const pngBuffer = await renderMenu(req.body);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", `inline; filename="${req.body.file_name || "menu.png"}"`);
    res.status(200).send(pngBuffer);
  } catch (err) {
    console.error("❌ RENDER ERROR:", err);
    res.status(500).json({ error: err.message || err.toString() });
  }
});

// ===== ENVÍO INMEDIATO =====
app.post("/api/send-email", auth, async (req, res) => {
  const { render_config, email_to, subject, template_name } = req.body;
  if (!render_config || !email_to) return res.status(400).json({ error: "Faltan datos" });
  try {
    const pngBuffer = await renderMenu(render_config);
    await sendEmailWithPng(email_to, subject || "Menú", pngBuffer, template_name || "");
    res.json({ ok: true });
  } catch (err) {
    console.error("❌ SEND EMAIL ERROR:", err);
    res.status(500).json({ error: err.message || err.toString() });
  }
});

// ===== PROGRAMAR ENVÍO =====
app.post("/api/schedule-email", auth, async (req, res) => {
  const { render_config, email_to, subject, send_at, template_name } = req.body;
  if (!render_config || !email_to || !send_at) return res.status(400).json({ error: "Faltan datos" });
  const [result] = await pool.execute(
    "INSERT INTO scheduled_emails (user_id, template_name, email_to, subject, send_at, render_config) VALUES (?, ?, ?, ?, ?, ?)",
    [req.user.id, template_name || "", email_to, subject || "Menú", new Date(send_at), JSON.stringify(render_config)]
  );
  res.json({ ok: true, id: result.insertId });
});

// ===== LISTAR PROGRAMADOS =====
app.get("/api/scheduled-emails", auth, async (req, res) => {
  const [rows] = await pool.execute(
    "SELECT id, template_name, email_to, subject, send_at, status FROM scheduled_emails WHERE user_id = ? AND status = 'pending' ORDER BY send_at ASC",
    [req.user.id]
  );
  res.json(rows);
});

// ===== CANCELAR PROGRAMADO =====
app.delete("/api/scheduled-emails/:id", auth, async (req, res) => {
  await pool.execute(
    "DELETE FROM scheduled_emails WHERE id = ? AND user_id = ? AND status = 'pending'",
    [req.params.id, req.user.id]
  );
  res.json({ ok: true });
});

// ===== SCHEDULER (cada 60s) =====
async function checkAndSendScheduled() {
  try {
    const [pending] = await pool.execute(
      "SELECT * FROM scheduled_emails WHERE status = 'pending' AND send_at <= NOW()"
    );
    for (const row of pending) {
      try {
        const config = JSON.parse(row.render_config);
        if (Array.isArray(config)) {
          const attachments = [];
          for (let i = 0; i < config.length; i++) {
            const buf = await renderMenu({ ...config[i], output_format: "jpg" });
            attachments.push({ filename: `menu-${String(i + 1).padStart(2, "0")}.jpg`, content: buf, contentType: "image/jpeg" });
          }
          await transporter.sendMail({ from: process.env.SMTP_FROM, to: row.email_to, subject: row.subject, html: `<p>Adjunto encontrarás el menú: <strong>${row.template_name}</strong></p>`, attachments });
        } else {
          const pngBuffer = await renderMenu(config);
          await sendEmailWithPng(row.email_to, row.subject, pngBuffer, row.template_name);
        }
        await pool.execute("UPDATE scheduled_emails SET status = 'sent' WHERE id = ?", [row.id]);
        console.log(`✉ Email programado enviado → ${row.email_to} (id=${row.id})`);
      } catch (err) {
        await pool.execute("UPDATE scheduled_emails SET status = 'failed', error_msg = ? WHERE id = ?", [err.message, row.id]);
        console.error(`❌ Error enviando email programado id=${row.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error("❌ Error en scheduler:", err.message);
  }
}

// ===== INSTAGRAM =====

// Estado de conexión del usuario actual
app.get("/api/instagram/status", auth, async (req, res) => {
  const [rows] = await pool.execute(
    "SELECT instagram_id, instagram_username, instagram_token_expires_at FROM users WHERE id = ?",
    [req.user.id]
  );
  const u = rows[0];
  if (!u.instagram_id) return res.json({ connected: false });
  res.json({ connected: true, username: u.instagram_username, expiresAt: u.instagram_token_expires_at });
});

// Redirigir al diálogo OAuth de Meta
app.get("/api/instagram/connect", auth, (req, res) => {
  const state = jwt.sign({ userId: req.user.id }, JWT_SECRET, { expiresIn: "10m" });
  res.redirect(ig.buildOAuthURL(state));
});

// Callback OAuth (sin auth — redirección del navegador desde Meta)
app.get("/api/instagram/callback", async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect("/templates.html?ig_error=" + encodeURIComponent(error));

  let userId;
  try {
    const payload = jwt.verify(state, JWT_SECRET);
    userId = payload.userId;
  } catch {
    return res.status(400).send("Estado OAuth inválido o expirado. Vuelve a intentarlo.");
  }

  try {
    const { accessToken, expiresAt }  = await ig.exchangeCodeForLongLivedToken(code);
    const { igId, igUsername }         = await ig.getInstagramBusinessAccountId(accessToken);
    await pool.execute(
      "UPDATE users SET instagram_id=?, instagram_access_token=?, instagram_token_expires_at=?, instagram_username=? WHERE id=?",
      [igId, accessToken, expiresAt, igUsername, userId]
    );
    res.redirect("/templates.html?ig_connected=1&ig_username=" + encodeURIComponent(igUsername));
  } catch (err) {
    console.error("❌ IG OAuth callback:", err.message);
    res.redirect("/templates.html?ig_error=" + encodeURIComponent(err.message));
  }
});

// Publicar inmediatamente en Stories
app.post("/api/instagram/publish", auth, async (req, res) => {
  const { render_config } = req.body;
  if (!render_config) return res.status(400).json({ error: "Falta render_config" });

  const [rows] = await pool.execute(
    "SELECT instagram_id, instagram_access_token FROM users WHERE id=?",
    [req.user.id]
  );
  const u = rows[0];
  if (!u.instagram_id) return res.status(400).json({ error: "Instagram no conectado" });

  try {
    const pngBuffer = await renderMenu(render_config);
    const filename  = `${crypto.randomUUID()}.png`;
    const filepath  = path.join(TEMP_DIR, filename);
    fs.writeFileSync(filepath, pngBuffer);
    const imageUrl  = `${process.env.APP_BASE_URL}/temp/${filename}`;

    const { mediaId, postUrl } = await ig.publishStory(u.instagram_id, u.instagram_access_token, imageUrl);
    ig.cleanupTempFile(filepath);

    res.json({ ok: true, mediaId, postUrl });
  } catch (err) {
    console.error("❌ IG publish:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Programar publicación
app.post("/api/instagram/schedule", auth, async (req, res) => {
  const { render_config, scheduled_at, template_name } = req.body;
  if (!render_config || !scheduled_at) return res.status(400).json({ error: "Faltan datos" });

  const [rows] = await pool.execute("SELECT instagram_id FROM users WHERE id=?", [req.user.id]);
  if (!rows[0].instagram_id) return res.status(400).json({ error: "Instagram no conectado" });

  const [result] = await pool.execute(
    "INSERT INTO scheduled_posts (user_id, template_name, scheduled_at, render_config) VALUES (?, ?, ?, ?)",
    [req.user.id, template_name || "", new Date(scheduled_at), JSON.stringify(render_config)]
  );
  res.json({ ok: true, id: result.insertId });
});

// Listar publicaciones programadas pendientes
app.get("/api/instagram/scheduled", auth, async (req, res) => {
  const [rows] = await pool.execute(
    "SELECT id, template_name, scheduled_at, status FROM scheduled_posts WHERE user_id=? AND status='pending' ORDER BY scheduled_at ASC",
    [req.user.id]
  );
  res.json(rows);
});

// Cancelar publicación programada
app.delete("/api/instagram/scheduled/:id", auth, async (req, res) => {
  await pool.execute(
    "DELETE FROM scheduled_posts WHERE id=? AND user_id=? AND status='pending'",
    [req.params.id, req.user.id]
  );
  res.json({ ok: true });
});

// Desconectar Instagram
app.delete("/api/instagram/disconnect", auth, async (req, res) => {
  await pool.execute(
    "UPDATE users SET instagram_id=NULL, instagram_access_token=NULL, instagram_token_expires_at=NULL, instagram_username=NULL WHERE id=?",
    [req.user.id]
  );
  res.json({ ok: true });
});

// ===== SCHEDULER INSTAGRAM =====
async function checkAndPublishScheduled() {
  try {
    const [pending] = await pool.execute(
      `SELECT sp.*, u.instagram_id, u.instagram_access_token
       FROM scheduled_posts sp
       JOIN users u ON u.id = sp.user_id
       WHERE sp.status = 'pending' AND sp.scheduled_at <= NOW()`
    );
    for (const row of pending) {
      try {
        const config = JSON.parse(row.render_config);
        const pages  = Array.isArray(config) ? config : [config];
        let lastMediaId, lastPostUrl;
        for (const page of pages) {
          const pngBuf   = await renderMenu(page);
          const filename = `${crypto.randomUUID()}.png`;
          const filepath = path.join(TEMP_DIR, filename);
          fs.writeFileSync(filepath, pngBuf);
          const imageUrl = `${process.env.APP_BASE_URL}/temp/${filename}`;
          const { mediaId, postUrl } = await ig.publishStory(row.instagram_id, row.instagram_access_token, imageUrl);
          ig.cleanupTempFile(filepath);
          lastMediaId = mediaId; lastPostUrl = postUrl;
        }
        await pool.execute(
          "UPDATE scheduled_posts SET status='published', ig_media_id=?, ig_post_url=? WHERE id=?",
          [lastMediaId, lastPostUrl, row.id]
        );
        console.log(`📸 Post IG publicado → ${row.ig_username || row.user_id} (id=${row.id})`);
      } catch (err) {
        await pool.execute(
          "UPDATE scheduled_posts SET status='failed', error_msg=? WHERE id=?",
          [err.message, row.id]
        );
        console.error(`❌ Error publicando post IG id=${row.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error("❌ Error en scheduler IG:", err.message);
  }
}

// ===== EXPORT (PDF / JPG ZIP) =====
const EXPORT_DIMS = { story: { w: 1080, h: 1920 }, folio: { w: 2480, h: 3508 } };

app.post("/api/export", auth, async (req, res) => {
  const { pages, format } = req.body;
  if (!Array.isArray(pages) || !pages.length) return res.status(400).json({ error: "Faltan páginas" });

  try {
    if (format === "pdf") {
      const PDFDocument = require("pdfkit");
      const doc = new PDFDocument({ autoFirstPage: false, compress: true });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="menu.pdf"`);
      doc.pipe(res);
      for (const page of pages) {
        const pngBuf = await renderMenu(page);
        const dim = EXPORT_DIMS[page.formato] || EXPORT_DIMS.story;
        doc.addPage({ size: [dim.w, dim.h], margin: 0 });
        doc.image(pngBuf, 0, 0, { width: dim.w, height: dim.h });
      }
      doc.end();
    } else {
      const archiver = require("archiver");
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="menus.zip"`);
      const archive = archiver("zip", { zlib: { level: 6 } });
      archive.pipe(res);
      for (let i = 0; i < pages.length; i++) {
        const jpgBuf = await renderMenu({ ...pages[i], output_format: "jpg" });
        archive.append(jpgBuf, { name: `menu-${String(i + 1).padStart(2, "0")}.jpg` });
      }
      await archive.finalize();
    }
  } catch (err) {
    console.error("❌ EXPORT ERROR:", err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// ===== DISTRIBUTE: EMAIL =====
app.post("/api/distribute/email", auth, async (req, res) => {
  const { pages, email_to, subject, template_name } = req.body;
  if (!Array.isArray(pages) || !pages.length || !email_to)
    return res.status(400).json({ error: "Faltan datos" });
  try {
    const attachments = [];
    for (let i = 0; i < pages.length; i++) {
      const buf = await renderMenu({ ...pages[i], output_format: "jpg" });
      attachments.push({ filename: `menu-${String(i + 1).padStart(2, "0")}.jpg`, content: buf, contentType: "image/jpeg" });
    }
    await transporter.sendMail({
      from: process.env.SMTP_FROM, to: email_to,
      subject: subject || "Menú",
      html: `<p>Adjunto encontrarás el menú: <strong>${template_name || ""}</strong></p>`,
      attachments,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("❌ DISTRIBUTE EMAIL:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/distribute/email/schedule", auth, async (req, res) => {
  const { pages, email_to, subject, send_at, template_name } = req.body;
  if (!Array.isArray(pages) || !pages.length || !email_to || !send_at)
    return res.status(400).json({ error: "Faltan datos" });
  const [result] = await pool.execute(
    "INSERT INTO scheduled_emails (user_id, template_name, email_to, subject, send_at, render_config) VALUES (?,?,?,?,?,?)",
    [req.user.id, template_name || "", email_to, subject || "Menú", new Date(send_at), JSON.stringify(pages)]
  );
  res.json({ ok: true, id: result.insertId });
});

// ===== DISTRIBUTE: INSTAGRAM =====
app.post("/api/distribute/ig", auth, async (req, res) => {
  const { pages } = req.body;
  if (!Array.isArray(pages) || !pages.length) return res.status(400).json({ error: "Faltan páginas" });
  const [rows] = await pool.execute("SELECT instagram_id, instagram_access_token FROM users WHERE id=?", [req.user.id]);
  const u = rows[0];
  if (!u.instagram_id) return res.status(400).json({ error: "Instagram no conectado" });
  try {
    let lastPostUrl;
    for (const page of pages) {
      const pngBuf   = await renderMenu(page);
      const filename = `${crypto.randomUUID()}.png`;
      const filepath = path.join(TEMP_DIR, filename);
      fs.writeFileSync(filepath, pngBuf);
      const imageUrl = `${process.env.APP_BASE_URL}/temp/${filename}`;
      const result   = await ig.publishStory(u.instagram_id, u.instagram_access_token, imageUrl);
      ig.cleanupTempFile(filepath);
      lastPostUrl = result.postUrl;
    }
    res.json({ ok: true, postUrl: lastPostUrl });
  } catch (err) {
    console.error("❌ DISTRIBUTE IG:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/distribute/ig/schedule", auth, async (req, res) => {
  const { pages, scheduled_at, template_name } = req.body;
  if (!Array.isArray(pages) || !pages.length || !scheduled_at) return res.status(400).json({ error: "Faltan datos" });
  const [rows] = await pool.execute("SELECT instagram_id FROM users WHERE id=?", [req.user.id]);
  if (!rows[0].instagram_id) return res.status(400).json({ error: "Instagram no conectado" });
  const [result] = await pool.execute(
    "INSERT INTO scheduled_posts (user_id, template_name, scheduled_at, render_config) VALUES (?,?,?,?)",
    [req.user.id, template_name || "", new Date(scheduled_at), JSON.stringify(pages)]
  );
  res.json({ ok: true, id: result.insertId });
});

// ===== PUBLIC LINKS =====
app.get("/api/links", auth, async (req, res) => {
  const [rows] = await pool.execute(
    "SELECT id, name, slug, page_count, last_published_at FROM public_links WHERE user_id=? ORDER BY created_at ASC",
    [req.user.id]
  );
  res.json(rows);
});

app.post("/api/links", auth, async (req, res) => {
  const [count] = await pool.execute("SELECT COUNT(*) as c FROM public_links WHERE user_id=?", [req.user.id]);
  if (count[0].c >= 3) return res.status(400).json({ error: "Máximo 3 links públicos" });
  const name = (req.body.name || "Mi Menú").slice(0, 80);
  const slug = require("crypto").randomBytes(5).toString("hex"); // 10 chars
  await pool.execute("INSERT INTO public_links (user_id, name, slug) VALUES (?,?,?)", [req.user.id, name, slug]);
  res.json({ ok: true, slug, name });
});

app.put("/api/links/:id", auth, async (req, res) => {
  const fields = [];
  const vals   = [];
  if (req.body.name !== undefined)          { fields.push("name=?");          vals.push(String(req.body.name).slice(0, 80)); }
  if (req.body.custom_domain !== undefined) { fields.push("custom_domain=?"); vals.push(req.body.custom_domain ? String(req.body.custom_domain).toLowerCase().trim() : null); }
  if (!fields.length) return res.json({ ok: true });
  vals.push(req.params.id, req.user.id);
  await pool.execute(`UPDATE public_links SET ${fields.join(",")} WHERE id=? AND user_id=?`, vals);
  res.json({ ok: true });
});

app.delete("/api/links/:id", auth, async (req, res) => {
  const [rows] = await pool.execute("SELECT slug FROM public_links WHERE id=? AND user_id=?", [req.params.id, req.user.id]);
  if (rows.length) {
    const dir = path.join(PUBLIC_PAGES_DIR, rows[0].slug);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
  }
  await pool.execute("DELETE FROM public_links WHERE id=? AND user_id=?", [req.params.id, req.user.id]);
  res.json({ ok: true });
});

app.post("/api/links/:id/publish", auth, async (req, res) => {
  const { pages } = req.body;
  if (!Array.isArray(pages) || !pages.length) return res.status(400).json({ error: "Faltan páginas" });
  const [rows] = await pool.execute("SELECT * FROM public_links WHERE id=? AND user_id=?", [req.params.id, req.user.id]);
  if (!rows.length) return res.status(404).json({ error: "Link no encontrado" });
  const link = rows[0];
  const dir  = path.join(PUBLIC_PAGES_DIR, link.slug);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  // Borrar páginas anteriores
  fs.readdirSync(dir).forEach(f => fs.unlinkSync(path.join(dir, f)));
  try {
    for (let i = 0; i < pages.length; i++) {
      const buf = await renderMenu({ ...pages[i], output_format: "jpg" });
      fs.writeFileSync(path.join(dir, `page-${i + 1}.jpg`), buf);
    }
    await pool.execute("UPDATE public_links SET page_count=?, last_published_at=NOW() WHERE id=?", [pages.length, link.id]);
    res.json({ ok: true, url: `${process.env.APP_BASE_URL}/p/${link.slug}` });
  } catch (err) {
    console.error("❌ LINK PUBLISH:", err);
    res.status(500).json({ error: err.message });
  }
});

// ===== PUBLIC VIEWER /p/:slug =====
app.get("/p/:slug", async (req, res) => {
  const [rows] = await pool.execute("SELECT * FROM public_links WHERE slug=?", [req.params.slug]);
  if (!rows.length) return res.status(404).send(buildViewerHTML(null));
  return res.setHeader("Content-Type", "text/html; charset=utf-8").send(buildViewerHTML(rows[0]));
});

function buildViewerHTML(link) {
  if (!link || !link.page_count) {
    const name = link?.name || "";
    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name || "No encontrado"}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#060d24;color:#6b7a99;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:8px}.logo{font-family:Manrope,sans-serif;font-size:14px;font-weight:700;color:#e8edf8}.logo span{color:#9effc8}</style></head><body><div class="logo"><span>[</span> MENU BAR <span>]</span></div><p>${name ? `${name} · sin contenido publicado` : "Menú no encontrado"}</p></body></html>`;
  }
  const images  = Array.from({ length: link.page_count }, (_, i) => `/public_pages/${link.slug}/page-${i + 1}.jpg`);
  const updated = link.last_published_at
    ? new Date(link.last_published_at).toLocaleString("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${link.name}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#060d24;color:#e8edf8;font-family:'Inter',sans-serif;min-height:100vh}
.top{padding:14px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.06)}
.logo{font-family:'Manrope',sans-serif;font-size:14px;font-weight:700}
.logo span{color:#9effc8}
.pub-name{font-size:12px;color:#6b7a99;font-family:'Manrope',sans-serif}
.gallery{display:flex;flex-direction:column;align-items:center;gap:20px;padding:28px 16px}
.gallery img{max-width:420px;width:100%;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,0.6)}
.footer{text-align:center;font-size:11px;color:#3d4f6e;padding:0 0 32px}
</style>
</head>
<body>
<div class="top">
  <div class="logo"><span>[</span> MENU BAR <span>]</span></div>
  <div class="pub-name">${link.name}</div>
</div>
<div class="gallery">
  ${images.map(src => `<img src="${src}" loading="lazy" alt="Menú">`).join("\n  ")}
</div>
<p class="footer">${updated ? `Actualizado ${updated}` : ""}</p>
</body>
</html>`;
}

// Mantener ruta legacy /render-menu por compatibilidad
app.post("/render-menu", async (req, res) => {
  try {
    const pngBuffer = await renderMenu(req.body);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", `inline; filename="menu.png"`);
    res.status(200).send(pngBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== START =====
const PORT = process.env.PORT || 3001;
initDB()
  .then(() => {
    app.listen(PORT, () => console.log(`🟢 Servidor en puerto ${PORT}`));
    checkAndSendScheduled();
    setInterval(checkAndSendScheduled, 60 * 1000);
    checkAndPublishScheduled();
    setInterval(checkAndPublishScheduled, 60 * 1000);
  })
  .catch(err => { console.error("❌ Error DB:", err); process.exit(1); });
