const express  = require("express");
const router   = express.Router();
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
const db       = require("../services/db");

const JWT_SECRET = process.env.JWT_SECRET || "rentamx_secret_2025";

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  try {
    const { email, password, full_name, phone, role } = req.body;

    if (!email || !password || !full_name) {
      return res.status(400).json({ error: "Email, contraseña y nombre son requeridos" });
    }

    // Verificar si ya existe
    const exists = await db.query("SELECT id FROM users WHERE email = $1", [email]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: "Este email ya está registrado" });
    }

    // Hashear contraseña
    const hash = await bcrypt.hash(password, 10);

    // Insertar usuario
    const result = await db.query(
      `INSERT INTO users (email, password_hash, full_name, phone, role)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, email, full_name, role`,
      [email, hash, full_name, phone || null, role || "tenant"]
    );

    const user = result.rows[0];

    // Generar token
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({ success: true, token, user });
  } catch (err) {
    console.error("Error en registro:", err.message);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email y contraseña requeridos" });
    }

    // Buscar usuario
    const result = await db.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Email o contraseña incorrectos" });
    }

    const user = result.rows[0];

    // Verificar contraseña
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Email o contraseña incorrectos" });
    }

    // Generar token
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });

    res.json({
      success: true,
      token,
      user: {
        id:        user.id,
        email:     user.email,
        full_name: user.full_name,
        role:      user.role,
        verified:  user.verified,
      },
    });
  } catch (err) {
    console.error("Error en login:", err.message);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get("/me", requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, email, full_name, phone, role, verified, created_at FROM users WHERE id = $1",
      [req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Error interno" });
  }
});

// ── MIDDLEWARE: verificar JWT ─────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token requerido" });
  }
  try {
    const decoded = jwt.verify(header.split(" ")[1], JWT_SECRET);
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido o expirado" });
  }
}

module.exports = router;
module.exports.requireAuth = requireAuth;
