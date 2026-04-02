require("dotenv").config();
const express = require("express");
const path    = require("path");
const jwt     = require("jsonwebtoken");
const { pool, initDB } = require("./db");
const renderMenu = require("./renderMenu");

const app = express();
const JWT_SECRET = process.env.JWT_SECRET;

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
  .then(() => app.listen(PORT, () => console.log(`🟢 Servidor en puerto ${PORT}`)))
  .catch(err => { console.error("❌ Error DB:", err); process.exit(1); });
