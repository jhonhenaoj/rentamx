const { Pool } = require("pg");

const pool = new Pool({
  host:     "localhost",
  port:     5432,
  database: "rentamx",
  user:     "rentamx_user",
  password: "rentamx2025",
});

pool.connect((err) => {
  if (err) {
    console.error("❌ Error conectando a PostgreSQL:", err.message);
  } else {
    console.log("✅ Conectado a PostgreSQL — base de datos rentamx");
  }
});

module.exports = pool;
