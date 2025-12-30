require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

/* ================= BASIC ================= */
app.use(cors({ origin: "*", methods: ["GET", "POST"] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ================= STATIC ================= */
// public (html, css, js)
app.use(express.static(path.join(__dirname, "public"), {
  maxAge: 0,
  etag: false,
}));

// 🔥 VERY IMPORTANT — videos folder serve
app.use("/videos", express.static(path.join(__dirname, "videos")));

/* ================= ROUTES ================= */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/watch", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "watch.html"));
});

/* ================= API ================= */
// VIDEO LIST (JSON)
app.get("/api/videos", (req, res) => {
  const data = JSON.parse(
    fs.readFileSync(path.join(__dirname, "videos.json"), "utf8")
  );
  res.json(data);
});

/* ================= START ================= */
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Server running on port", PORT);
});
