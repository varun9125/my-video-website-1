require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

/* ================= BASIC CONFIG ================= */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const BASE_URL = process.env.BASE_URL || "https://my-video-website-1-1.onrender.com";

/* ================= SECURITY CHECK ================= */
if (!ADMIN_PASSWORD) {
  console.error("❌ ADMIN_PASSWORD missing in .env");
  process.exit(1);
}

/* ================= CLOUDINARY ================= */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/* ================= MONGODB ================= */
let dbReady = false;

mongoose.connect(process.env.MONGO_URI, {
  autoIndex: true,
  serverSelectionTimeoutMS: 15000
});

mongoose.connection.on("connected", () => {
  console.log("✅ MongoDB connected");
  dbReady = true;
});

mongoose.connection.on("error", err => {
  console.error("❌ MongoDB error:", err.message);
  dbReady = false;
});

mongoose.connection.on("disconnected", () => {
  console.error("⚠️ MongoDB disconnected");
  dbReady = false;
});

/* ================= MODEL ================= */
const videoSchema = new mongoose.Schema({
  title: { type: String, trim: true },
  url: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

videoSchema.index({ createdAt: -1 });

const Video = mongoose.model("Video", videoSchema);

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

/* ================= FILE UPLOAD ================= */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("video/")) {
      return cb(new Error("Only video files allowed"));
    }
    cb(null, true);
  }
});

/* ================= ROUTES ================= */

/* HOME */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* WATCH PAGE */
app.get("/watch", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "watch.html"));
});

/* ================= ADMIN UPLOAD ================= */
app.post("/api/upload", upload.single("video"), async (req, res) => {
  try {
    if (!dbReady) {
      return res.status(503).json({
        success: false,
        error: "Database warming up. Try again in few seconds."
      });
    }

    const password =
      req.headers["x-admin-password"] || req.body.password;

    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized admin"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No video file uploaded"
      });
    }

    const title = (req.body.title || "Untitled").trim();

    /* UPLOAD TO CLOUDINARY */
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: "video",
          folder: "kamababa",
          chunk_size: 6 * 1024 * 1024
        },
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        }
      ).end(req.file.buffer);
    });

    /* SAVE TO DB */
    const video = await Video.create({
      title,
      url: uploadResult.secure_url
    });

    res.json({
      success: true,
      id: video._id
    });

  } catch (err) {
    console.error("UPLOAD ERROR:", err.message);
    res.status(500).json({
      success: false,
      error: "Upload failed"
    });
  }
});

/* ================= GET VIDEOS ================= */
app.get("/api/videos", async (req, res) => {
  try {
    if (!dbReady) return res.json([]);
    const videos = await Video.find().sort({ createdAt: -1 }).lean();
    res.json(videos);
  } catch (err) {
    res.json([]);
  }
});

/* ================= SITEMAP ================= */
app.get("/sitemap.xml", async (req, res) => {
  res.setHeader("Content-Type", "application/xml");

  let urls = `
<url>
  <loc>${BASE_URL}/</loc>
</url>`;

  if (dbReady) {
    const videos = await Video.find({}, "_id").lean();
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

/* ================= 404 SAFE ================= */
app.use((req, res) => {
  res.status(404).send("404 - Page not found");
});

/* ================= START ================= */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
