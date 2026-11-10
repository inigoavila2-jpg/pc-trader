const express = require("express");
const cors = require("cors");
const path = require("path");
const { FRONTEND_URL } = require("./config");
const { registerDataRoutes } = require("./routes/dataRoutes");
const { registerPhotoRoutes } = require("./routes/photoRoutes");

const app = express();
app.use(express.json({ limit: "5mb" }));
app.use(cors({
  origin: [FRONTEND_URL, "http://localhost:5173", "http://127.0.0.1:5173"],
  credentials: true,
}));

registerDataRoutes(app);
registerPhotoRoutes(app);

const distDir = path.join(__dirname, "..", "dist");
app.use(express.static(distDir));
app.get("*", (req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

module.exports = app;
