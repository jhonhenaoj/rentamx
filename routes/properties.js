const express = require("express");
const router  = express.Router();
const db      = require("../services/db");
const { requireAuth } = require("./auth");

// ── GET /api/properties ───────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { type, colonia, beds, search } = req.query;
    let query = "SELECT p.*, u.full_name as owner_name FROM properties p JOIN users u ON p.owner_id = u.id WHERE p.active = true";
    const params = [];
    let i = 1;

    if (type && type !== "Todos") {
      query += ` AND p.type = $${i++}`;
      params.push(type);
    }
    if (colonia && colonia !== "Todas") {
      query += ` AND p.colonia = $${i++}`;
      params.push(colonia);
    }
    if (beds) {
      query += ` AND p.beds = $${i++}`;
      params.push(parseInt(beds));
    }
    if (search) {
      query += ` AND (p.title ILIKE $${i} OR p.location ILIKE $${i})`;
      params.push(`%${search}%`);
      i++;
    }

    query += " ORDER BY p.created_at DESC";
    const result = await db.query(query, params);
    res.json({ success: true, properties: result.rows });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error obteniendo propiedades" });
  }
});

// ── POST /api/properties ──────────────────────────────────────────────────────
router.post("/", requireAuth, async (req, res) => {
  try {
    const { type, title, description, price, deposit, size, beds, baths, parking, colonia, location, tags } = req.body;

    if (!type || !title || !price) {
      return res.status(400).json({ error: "Tipo, título y precio son requeridos" });
    }

    const result = await db.query(
      `INSERT INTO properties 
       (owner_id, type, title, description, price, deposit, size, beds, baths, parking, colonia, location, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [req.userId, type, title, description, price, deposit || price, size, beds || 0, baths || 0, parking || 0, colonia, location, tags || []]
    );

    res.status(201).json({ success: true, property: result.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error creando propiedad" });
  }
});

module.exports = router;
