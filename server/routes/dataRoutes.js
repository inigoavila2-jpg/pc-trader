const { loadStateFromSupabase, loadThemeFromSupabase } = require("../loadState");
const { saveStateToSupabase } = require("../saveState");
const { supabase } = require("../config");

function registerDataRoutes(app) {
  app.get("/data/theme", async (req, res) => {
    try {
      const theme = await loadThemeFromSupabase();
      res.json(theme);
    } catch (err) {
      console.error("GET /data/theme error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/data", async (req, res) => {
    try {
      const state = await loadStateFromSupabase();
      res.json(state);
    } catch (err) {
      console.error("GET /data error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/data", async (req, res) => {
    try {
      if (!supabase) {
        throw new Error("Supabase client not configured.");
      }

      await saveStateToSupabase(req.body);

      console.log("POST /data saved successfully");
      res.json({ ok: true });
    } catch (err) {
      console.error("POST /data failed:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/health", (req, res) => {
    res.json({ ok: true });
  });
}

module.exports = { registerDataRoutes };
