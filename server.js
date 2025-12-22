require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

/* ================= CONFIG ================= */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const BASE_URL = process.env.BASE_URL || "https://my-video-website-1-1.onrender.com";

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* ================= CLOUDINARY ================= */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/* ================= DATABASE ================= */
let dbReady = false;

mongoose
  .connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000
  })
  .then(() => {
    console.log("✅ MongoDB connected");
    dbReady = true;
  })
  .catch(err => {
    console.error("❌ MongoDB failed", err.message);
    dbReady = false;
  });

/* ================= MODEL ================= */
const videoSchema = new mongoose.Schema({
  title: String,
  url: String,
  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const Video = mongoose.model("Video", videoSchema);

/* ================= UPLOAD ================= */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }
});

/* ================= ROUTES ================= */

// HOME
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// WATCH
app.get("/watch", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "watch.html"));
});

// GET VIDEOS
app.get("/api/videos", async (req, res) => {
  if (!dbReady) return res.json([]);
  const videos = await Video.find().sort({ createdAt: -1 });
  res.json(videos);
});

// UPLOAD VIDEO
app.post("/api/upload", upload.single("video"), async (req, res) => {
  try {
    if (!dbReady) {
      return res.status(503).json({ success: false, error: "DB not ready" });
    }

    if (req.body.password !== ADMIN_PASSWORD) {
      return res.status(401).json({ success: false, error: "Wrong password" });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file" });
    }

    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { resource_type: "video", folder: "kamababa" },
        (err, result) => (err ? reject(err) : resolve(result))
      ).end(req.file.buffer);
    });

    const video = await Video.create({
      title: req.body.title || "Untitled",
      url: uploadResult.secure_url
    });

    res.json({ success: true, id: video._id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false });
  }
});

// VIEW
app.post("/api/view/:id", async (req, res) => {
  if (dbReady) await Video.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
  res.json({ success: true });
});

// LIKE
app.post("/api/like/:id", async (req, res) => {
  if (dbReady) await Video.findByIdAndUpdate(req.params.id, { $inc: { likes: 1 } });
  res.json({ success: true });
});

// SITEMAP
app.get("/sitemap.xml", async (req, res) => {
  res.setHeader("Content-Type", "application/xml");

  let urls = `<url><loc>${BASE_URL}/</loc></url>`;

  if (dbReady) {
    const videos = await Video.find({}, "_id");
    videos.forEach(v => {
      urls += `<url><loc>${BASE_URL}/watch?id=${v._id}</loc></url>`;
    });
  }

  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`);
});

/* ================= START ================= */
app.listen(PORT, () => {
  console.log("🚀 Server running on", PORT);
});

