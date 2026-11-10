// Supabase, upload and environment setup for the Express server.
require("dotenv").config({ path: ".env.local" });
require("dotenv").config();
require("dotenv").config({ path: ".env.development" });

const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");

const PORT = process.env.PORT || 3001;
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  process.env.CORS_ORIGIN ||
  "http://localhost:5173";

const STORAGE_BUCKET = process.env.SUPABASE_BUCKET || "photos";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
});

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

async function ensureStorageBucketExists() {
  if (!supabase || !STORAGE_BUCKET) return;

  const { error } = await supabase.storage.createBucket(
    STORAGE_BUCKET,
    { public: true }
  );

  if (error && !/already exists/i.test(error.message)) {
    console.error("Storage bucket error:", error.message);
  }
}

console.log("Supabase configuration:", {
  configured: Boolean(supabase),
  bucket: STORAGE_BUCKET,
});

if (!supabase) {
  console.warn(
    "Supabase is not configured. Check your Render environment variables."
  );
} else {
  ensureStorageBucketExists().catch((err) => {
    console.error("Storage initialization failed:", err.message);
  });
}

module.exports = { PORT, FRONTEND_URL, STORAGE_BUCKET, upload, supabase, ensureStorageBucketExists };
