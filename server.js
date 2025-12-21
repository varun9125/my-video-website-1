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

/* ================= MONGODB (FIXED) ================= */
let isDbReady = false;

mongoose.connect(process.env.MONGO_URI, {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 30000, // ⬅️ VERY IMPORTANT
  socketTimeoutMS: 45000
})
.then(() => {
  isDbReady = true;
  console.log("✅ MongoDB connected");
})
.catch(err => {
  console.error("❌ MongoDB error", err);
});

mongoose.connection.on("disconnected", () => {
  isDbReady = false;
  console.error("❌ MongoDB disconnected");
});

/* ================= MODEL ================= */
const videoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  url: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Video = mongoose.model("Video", videoSchema);

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 } // 200MB
});

/* ================= WATCH PAGE ================= */
app.get("/watch", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "watch.html"));
});

/* ================= 🔐 ADMIN UPLOAD (FINAL FIX) ================= */
app.post("/api/upload", upload.single("video"), async (req, res) => {
  try {
    if (!isDbReady) {
      return res.status(503).json({
        success: false,
        error: "Database not ready. Try again in 10 seconds."
      });
    }

    const { password, title } = req.body;

    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ success: false, error: "Wrong password" });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: "No video file" });
    }

    // ⬅️ Upload to Cloudinary FIRST
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: "video",
          folder: "kamababa",
          timeout: 180000
        },
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        }
      ).end(req.file.buffer);
    });

    if (!uploadResult?.secure_url) {
      throw new Error("Cloudinary upload failed");
    }

    // ⬅️ HARD DB INSERT (no buffering)
    const video = new Video({
      title: title || "Untitled",
      url: uploadResult.secure_url
    });

    await video.save({ timeout: 30000 });

    res.json({
      success: true,
      video
    });

  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/* ================= GET VIDEOS ================= */
app.get("/api/videos", async (req, res) => {
  try {
    if (!isDbReady) return res.json([]);
    const videos = await Video.find().sort({ createdAt: -1 });
    res.json(videos);
  } catch {
    res.json([]);
  }
});

/* ================= SITEMAP ================= */
app.get("/sitemap.xml", async (req, res) => {
  res.setHeader("Content-Type", "application/xml");

  let urls = `
<url>
  <loc>${BASE_URL}/</loc>
  <priority>1.0</priority>
</url>`;

  if (isDbReady) {
    const videos = await Video.find({}, "_id");
    videos.forEach(v => {
      urls += `
<url>
  <loc>${BASE_URL}/watch?id=${v._id}</loc>
  <priority>0.8</priority>
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
  console.log("🚀 Server running on", PORT);
});
