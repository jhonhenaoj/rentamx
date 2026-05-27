require("dotenv").config();
const express    = require("express");
const cors       = require("cors");
const db         = require("./services/db");
const verifyRoutes     = require("./routes/verify");
const authRoutes       = require("./routes/auth");
const propertiesRoutes = require("./routes/properties");

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://rentamx-frontend.vercel.app",
    "https://rentamx-frontend.onrender.com",
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

// ── RUTAS ─────────────────────────────────────────────────────────────────────
app.use("/api/auth",       authRoutes);
app.use("/api/verify",     verifyRoutes);
app.use("/api/properties", propertiesRoutes);
app.use("/api/admin", require("./routes/admin"));

// ── HEALTH CHECK ──────────────────────────────────────────────────────────────
app.get("/health", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({ status: "ok", db: "connected", env: process.env.TRUORA_ENV || "sandbox" });
  } catch {
    res.status(500).json({ status: "error", db: "disconnected" });
  }
});

// ── ERROR HANDLER ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(err.status || 500).json({ success: false, error: err.message || "Error interno" });
});

app.listen(PORT, () => {
  console.log(`\n🔑 RentaMX Backend en http://localhost:${PORT}`);
  console.log(`🌍 Truora: ${process.env.TRUORA_ENV || "sandbox"}`);
  console.log(`🔗 Frontend: ${process.env.FRONTEND_URL || "http://localhost:3000"}\n`);
});
