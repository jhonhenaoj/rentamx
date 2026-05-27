const axios = require("axios");
const FormData = require("form-data");

const BASE_URL = "https://api.truora.com/v1";
const API_KEY = process.env.TRUORA_API_KEY;

if (!API_KEY || API_KEY === "your_truora_api_key_here") {
  console.warn("⚠️  TRUORA_API_KEY no configurada — modo SIMULADO activo");
}

function headers(extra = {}) {
  return { "Truora-API-Key": API_KEY, ...extra };
}

async function createVerificationProcess(userId) {
  const response = await axios.post(`${BASE_URL}/checks`, {
    type: "document-validation",
    national_id_type: "INE",
    user_authorized: true,
    metadata: JSON.stringify({ userId, platform: "rentamx" }),
  }, { headers: headers({ "Content-Type": "application/json" }) });
  return response.data;
}

async function uploadDocument({ checkId, imageBuffer, mimeType, side }) {
  const form = new FormData();
  form.append("document_side", side);
  form.append("image", imageBuffer, { filename: `ine-${side}.jpg`, contentType: mimeType || "image/jpeg" });
  const response = await axios.post(`${BASE_URL}/checks/${checkId}/documents`, form, {
    headers: { ...headers(), ...form.getHeaders() },
  });
  return response.data;
}

async function uploadSelfie({ checkId, imageBuffer, mimeType }) {
  const form = new FormData();
  form.append("image", imageBuffer, { filename: "selfie.jpg", contentType: mimeType || "image/jpeg" });
  const response = await axios.post(`${BASE_URL}/checks/${checkId}/face`, form, {
    headers: { ...headers(), ...form.getHeaders() },
  });
  return response.data;
}

async function getVerificationResult(checkId) {
  const response = await axios.get(`${BASE_URL}/checks/${checkId}`, { headers: headers() });
  const data = response.data;
  return {
    checkId,
    status: data.check?.status,
    approved: data.check?.status === "completed" && data.check?.validation_status !== "rejected",
    identity: {
      fullName:      data.check?.person?.full_name || null,
      curp:          data.check?.person?.national_id || null,
      birthDate:     data.check?.person?.birth_date || null,
      expiryDate:    data.check?.document?.expiry_date || null,
      documentValid: data.check?.document?.is_valid || false,
    },
    faceMatch: {
      matched:    data.check?.face?.status === "success",
      confidence: data.check?.face?.similarity_score || null,
      liveness:   data.check?.face?.liveness_status === "alive",
    },
    rejectionReasons: data.check?.rejection_reasons || [],
  };
}

function simulateVerification() {
  return new Promise(resolve => {
    setTimeout(() => resolve({
      checkId: `sim_${Date.now()}`,
      status: "completed",
      approved: true,
      identity: {
        fullName: "USUARIO DE PRUEBA",
        curp: "PUET900101HNLRSS00",
        birthDate: "1990-01-01",
        expiryDate: "2030-12-31",
        documentValid: true,
      },
      faceMatch: { matched: true, confidence: 94.5, liveness: true },
      rejectionReasons: [],
      simulated: true,
    }), 4500);
  });
}

module.exports = {
  createVerificationProcess,
  uploadDocument,
  uploadSelfie,
  getVerificationResult,
  simulateVerification,
  isSimulated: () => !API_KEY || API_KEY === "your_truora_api_key_here",
};
