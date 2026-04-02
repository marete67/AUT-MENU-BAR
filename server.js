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
        const pngBuffer = await renderMenu(config);
        await sendEmailWithPng(row.email_to, row.subject, pngBuffer, row.template_name);
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
        const config   = JSON.parse(row.render_config);
        const pngBuf   = await renderMenu(config);
        const filename = `${crypto.randomUUID()}.png`;
        const filepath = path.join(TEMP_DIR, filename);
        fs.writeFileSync(filepath, pngBuf);
        const imageUrl = `${process.env.APP_BASE_URL}/temp/${filename}`;
        const { mediaId, postUrl } = await ig.publishStory(row.instagram_id, row.instagram_access_token, imageUrl);
        ig.cleanupTempFile(filepath);
        await pool.execute(
          "UPDATE scheduled_posts SET status='published', ig_media_id=?, ig_post_url=? WHERE id=?",
          [mediaId, postUrl, row.id]
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
