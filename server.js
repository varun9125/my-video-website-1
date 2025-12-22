require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const path = require("path");
const cors = require("cors");
const compression = require("compression");
const morgan = require("morgan");

const app = express();
const PORT = process.env.PORT || 3000;

/* ================= CONFIG ================= */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const BASE_URL = "https://my-video-website-1-1.onrender.com";

/* ================= BASIC OPTIMIZATION ================= */
app.use(compression());              // gzip compression
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("tiny"));
app.disable("x-powered-by");

/* ================= STATIC FILES (FAST) ================= */
app.use(
  express.static(path.join(__dirname, "public"), {
    maxAge: "7d",
    immutable: true
  })
);

/* ================= CLOUDINARY ================= */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/* ================= MONGODB ================= */
let dbReady = false;

mongoose.set("strictQuery", true);

mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 10000,
  maxPoolSize: 10
});

mongoose.connection.once("open", () => {
  console.log("✅ MongoDB connected");
  dbReady = true;
});

mongoose.connection.on("error", err => {
  console.error("❌ MongoDB error", err.message);
  dbReady = false;
});

/* ================= MODEL ================= */
const videoSchema = new mongoose.Schema(
  {
    title: { type: String, index: true },
    url: String,
    createdAt: { type: Date, default: Date.now, index: true }
  },
  { versionKey: false }
);

const Video = mongoose.model("Video", videoSchema);

/* ================= MULTER ================= */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 120 * 1024 * 1024 } // 120MB
});

/* ================= ROUTES ================= */

/* Home */
app.get("/", (_, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* Watch */
app.get("/watch", (_, res) => {
  res.sendFile(path.join(__dirname, "public", "watch.html"));
});

/* ================= ADMIN UPLOAD ================= */
app.post("/api/upload", upload.single("video"), async (req, res) => {
  try {
    if (!dbReady)
      return res.status(503).json({ success: false, error: "DB not ready" });

    if (req.body.password !== ADMIN_PASSWORD)
      return res.status(401).json({ success: false, error: "Wrong password" });

    if (!req.file)
      return res.status(400).json({ success: false, error: "No file" });

    const cloudResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: "video",
          folder: "kamababa",
          eager: [
            { width: 320, height: 180, crop: "fill", format: "jpg" }
          ]
        },
        (err, result) => (err ? reject(err) : resolve(result))
      ).end(req.file.buffer);
    });

    const video = await Video.create({
      title: req.body.title || "Untitled",
      url: cloudResult.secure_url
    });

    res.json({ success: true, id: video._id });
  } catch (e) {
    console.error("UPLOAD ERROR:", e.message);
    res.status(500).json({ success: false, error: "Upload failed" });
  }
});

/* ================= GET VIDEOS (FAST) ================= */
app.get("/api/videos", async (_, res) => {
  if (!dbReady) return res.json([]);

  const videos = await Video.find({})
    .select("_id title url createdAt")
    .sort({ createdAt: -1 })
    .limit(200)          // 🚀 VERY IMPORTANT
    .lean();             // 🚀 30% faster

  res.set("Cache-Control", "public, max-age=60");
  res.json(videos);
});

/* ================= SITEMAP ================= */
app.get("/sitemap.xml", async (_, res) => {
  res.setHeader("Content-Type", "application/xml");

  let urls = `
<url><loc>${BASE_URL}/</loc></url>`;

  if (dbReady) {
    const vids = await Video.find({}, "_id").lean();
    vids.forEach(v => {
      urls += `<url><loc>${BASE_URL}/watch?id=${v._id}</loc></url>`;
    });
  }

  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`);
});

/* ================= HEALTH CHECK ================= */
app.get("/health", (_, res) => {
  res.json({
    status: "ok",
    db: dbReady,
    uptime: process.uptime()
  });
});

/* ================= START ================= */
app.listen(PORT, () => {
  console.log("🚀 Server running on", PORT);
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
