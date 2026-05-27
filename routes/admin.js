const express = require("express");
const router = express.Router();
const db = require("../services/db");
const supabase = require("../services/supabase");
const { requireAuth } = require("./auth");
const upload = require("../middleware/upload");

// Middleware: solo admins
function requireAdmin(req, res, next) {
  if (req.userRole !== "admin") {
    return res.status(403).json({ error: "Solo administradores" });
  }
  next();
}

// ── POST /api/admin/verify/upload ─────────────────────────────────────────────
// El usuario sube sus fotos de INE
router.post("/verify/upload",
  requireAuth,
  upload.fields([
    { name: "front",  maxCount: 1 },
    { name: "back",   maxCount: 1 },
    { name: "selfie", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { front, back, selfie } = req.files || {};
      if (!front || !back || !selfie) {
        return res.status(400).json({ error: "Se requieren las 3 fotos" });
      }

      const userId = req.userId;
      const folder = `user_${userId}`;

      // Subir las 3 fotos a Supabase Storage
      const uploads = await Promise.all([
        supabase.storage.from("ine-documents").upload(
          `${folder}/front_${Date.now()}.jpg`,
          front[0].buffer,
          { contentType: front[0].mimetype, upsert: true }
        ),
        supabase.storage.from("ine-documents").upload(
          `${folder}/back_${Date.now()}.jpg`,
          back[0].buffer,
          { contentType: back[0].mimetype, upsert: true }
        ),
        supabase.storage.from("ine-documents").upload(
          `${folder}/selfie_${Date.now()}.jpg`,
          selfie[0].buffer,
          { contentType: selfie[0].mimetype, upsert: true }
        ),
      ]);

      // Verificar que subieron bien
      const errors = uploads.filter(u => u.error);
      if (errors.length > 0) {
        console.error("Error subiendo fotos:", errors);
        return res.status(500).json({ error: "Error subiendo fotos" });
      }

      // Guardar en DB como pendiente
      const existing = await db.query(
        "SELECT id FROM verifications WHERE user_id = $1", [userId]
      );

      if (existing.rows.length > 0) {
        await db.query(
          "UPDATE verifications SET status = 'pending', created_at = NOW() WHERE user_id = $1",
          [userId]
        );
      } else {
        await db.query(
          "INSERT INTO verifications (user_id, status, simulated) VALUES ($1, 'pending', false)",
          [userId]
        );
      }

      res.json({ success: true, message: "Fotos subidas. Revisaremos tu INE en menos de 24 horas." });
    } catch (err) {
      console.error("Error:", err.message);
      res.status(500).json({ error: "Error interno" });
    }
  }
);

// ── GET /api/admin/pending ─────────────────────────────────────────────────────
// Lista usuarios pendientes de verificación (solo admin)
router.get("/pending", requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT v.id, v.user_id, v.status, v.created_at,
             u.full_name, u.email, u.phone
      FROM verifications v
      JOIN users u ON v.user_id = u.id
      WHERE v.status = 'pending'
      ORDER BY v.created_at ASC
    `);

    // Para cada usuario obtener URLs firmadas de sus fotos
    const pending = await Promise.all(result.rows.map(async (row) => {
      const folder = `user_${row.user_id}`;
      const { data: files } = await supabase.storage
        .from("ine-documents")
        .list(folder);

      const urls = {};
      if (files) {
        for (const file of files) {
          const { data } = await supabase.storage
            .from("ine-documents")
            .createSignedUrl(`${folder}/${file.name}`, 3600); // 1 hora
          if (file.name.includes("front")) urls.front = data?.signedUrl;
          if (file.name.includes("back"))  urls.back  = data?.signedUrl;
          if (file.name.includes("selfie"))urls.selfie = data?.signedUrl;
        }
      }

      return { ...row, photos: urls };
    }));

    res.json({ success: true, pending });
  } catch (err) {
    console.error("Error:", err.message);
    res.status(500).json({ error: "Error interno" });
  }
});

// ── POST /api/admin/verify/:userId/approve ────────────────────────────────────
router.post("/verify/:userId/approve", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    await db.query(
      "UPDATE verifications SET status = 'approved' WHERE user_id = $1",
      [userId]
    );
    await db.query(
      "UPDATE users SET verified = true WHERE id = $1",
      [userId]
    );
    res.json({ success: true, message: "Usuario aprobado" });
  } catch (err) {
    res.status(500).json({ error: "Error interno" });
  }
});

// ── POST /api/admin/verify/:userId/reject ─────────────────────────────────────
router.post("/verify/:userId/reject", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    await db.query(
      "UPDATE verifications SET status = 'rejected' WHERE user_id = $1",
      [userId]
    );
    res.json({ success: true, message: "Usuario rechazado" });
  } catch (err) {
    res.status(500).json({ error: "Error interno" });
  }
});

module.exports = router;
