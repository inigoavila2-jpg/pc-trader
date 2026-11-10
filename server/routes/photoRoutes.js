const { upload, supabase, STORAGE_BUCKET, ensureStorageBucketExists } = require("../config");

function registerPhotoRoutes(app) {
  app.post("/photo", upload.single("photo"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      if (!supabase) {
        return res.status(500).json({ error: "Supabase is not configured" });
      }

      await ensureStorageBucketExists();

      const safeName = (req.file.originalname || "photo.jpg")
        .replace(/[^a-zA-Z0-9._-]/g, "-");

      const fileName = `${Date.now()}-${safeName}`;

      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype || "application/octet-stream",
          upsert: true,
        });

      if (error) {
        throw new Error(error.message);
      }

      const { data } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(fileName);

      res.json({
        url: data.publicUrl,
        recordId: fileName,
      });
    } catch (err) {
      console.error("Photo upload failed:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/photo/:recordId", async (req, res) => {
    try {
      if (!supabase) {
        return res.status(500).json({ error: "Supabase is not configured" });
      }

      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([req.params.recordId]);

      if (error) {
        throw new Error(error.message);
      }

      res.json({ ok: true });
    } catch (err) {
      console.error("Photo deletion failed:", err.message);
      res.status(500).json({ ok: false, error: err.message });
    }
  });
}

module.exports = { registerPhotoRoutes };
