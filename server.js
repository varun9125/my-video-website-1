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
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const BASE_URL = "https://my-video-website-1-1.onrender.com";

/* ================= CLOUDINARY ================= */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/* ================= MONGODB ================= */
let dbReady = false;

mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 15000
});

mongoose.connection.on("connected", () => {
  console.log("✅ MongoDB connected");
  dbReady = true;
});

mongoose.connection.on("error", err => {
  console.error("❌ MongoDB error", err);
  dbReady = false;
});

mongoose.connection.on("disconnected", () => {
  console.error("❌ MongoDB disconnected");
  dbReady = false;
});

/* ================= MODEL ================= */
const videoSchema = new mongoose.Schema({
  title: String,
  url: String,
  createdAt: { type: Date, default: Date.now }
});

const Video = mongoose.model("Video", videoSchema);

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }
});

/* ================= WATCH PAGE ================= */
app.get("/watch", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "watch.html"));
});

/* ================= ADMIN UPLOAD (FIXED) ================= */
app.post("/api/upload", upload.single("video"), async (req, res) => {
  try {
    if (!dbReady) {
      return res.status(503).json({
        success: false,
        error: "Database is not ready. Try again in 10 seconds."
      });
    }

    const { password, title } = req.body;

    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({
        success: false,
        error: "Wrong admin password"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No video selected"
      });
    }

    // ⬆️ Upload to Cloudinary
    const cloudResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { resource_type: "video", folder: "kamababa" },
        (err, result) => err ? reject(err) : resolve(result)
      ).end(req.file.buffer);
    });

    // ⬆️ Save to Mongo
    const video = await Video.create({
      title: title || "Untitled",
      url: cloudResult.secure_url
    });

    res.json({
      success: true,
      id: video._id
    });

  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({
      success: false,
      error: "Upload failed"
    });
  }
});

/* ================= GET VIDEOS ================= */
app.get("/api/videos", async (req, res) => {
  if (!dbReady) return res.json([]);

  const videos = await Video.find().sort({ createdAt: -1 });
  res.json(videos);
});

/* ================= SITEMAP ================= */
app.get("/sitemap.xml", async (req, res) => {
  res.setHeader("Content-Type", "application/xml");

  let urls = `
<url>
  <loc>${BASE_URL}/</loc>
</url>`;

  if (dbReady) {
    const videos = await Video.find({}, "_id");
    videos.forEach(v => {
      urls += `
<url>
  <loc>${BASE_URL}/watch?id=${v._id}</loc>
</url>`;
    });
  }

  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`);
});

/* ================= START ================= */
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
