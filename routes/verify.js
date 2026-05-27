const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const truora = require("../services/truora");

router.post("/ine",
  upload.fields([
    { name: "front",  maxCount: 1 },
    { name: "back",   maxCount: 1 },
    { name: "selfie", maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      const { front, back, selfie } = req.files || {};
      if (!front || !back || !selfie) {
        return res.status(400).json({
          success: false,
          error: "Se requieren las 3 imágenes: frente, reverso y selfie.",
          missing: { front: !front, back: !back, selfie: !selfie },
        });
      }

      const userId = req.body.userId || `anon_${Date.now()}`;
      console.log(`\n📋 Verificación iniciada — userId: ${userId}`);

      if (truora.isSimulated()) {
        console.log("🔄 Modo simulado activo");
        const result = await truora.simulateVerification();
        return res.json({ success: true, ...result });
      }

      const process = await truora.createVerificationProcess(userId);
      const checkId = process.check_id;

      await truora.uploadDocument({ checkId, imageBuffer: front[0].buffer, mimeType: front[0].mimetype, side: "front" });
      await truora.uploadDocument({ checkId, imageBuffer: back[0].buffer, mimeType: back[0].mimetype, side: "reverse" });
      await truora.uploadSelfie({ checkId, imageBuffer: selfie[0].buffer, mimeType: selfie[0].mimetype });

      const result = await waitForResult(checkId);
      console.log(`✅ Verificación completada — aprobado: ${result.approved}`);

      if (result.approved) {
        return res.json({ success: true, approved: true, checkId: result.checkId, identity: result.identity, faceMatch: result.faceMatch });
      } else {
        return res.status(422).json({ success: false, approved: false, checkId: result.checkId, reasons: result.rejectionReasons });
      }
    } catch (err) {
      next(err);
    }
  }
);

router.get("/status/:checkId", async (req, res, next) => {
  try {
    const result = await truora.getVerificationResult(req.params.checkId);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

async function waitForResult(checkId, maxAttempts = 15) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const result = await truora.getVerificationResult(checkId);
    if (result.status === "completed" || result.status === "error") return result;
    console.log(`   Intento ${i + 1}/${maxAttempts} — status: ${result.status}`);
  }
  throw new Error("Tiempo de espera agotado.");
}

module.exports = router;
