const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/videos", express.static(path.join(__dirname, "videos")));

// HOME ROUTE (IMPORTANT)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// WATCH PAGE
app.get("/watch", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "watch.html"));
});

// API – get videos
app.get("/api/videos", (req, res) => {
  const data = fs.readFileSync("videos.json", "utf-8");
  res.json(JSON.parse(data));
});

// START SERVER
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
