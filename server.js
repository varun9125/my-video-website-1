require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const path = require("path");
const cors = require("cors");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

/* ================= BASIC CONFIG ================= */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

/* ================= MIDDLEWARE ================= */
app.use(cors({ origin: "*", methods: ["GET", "POST"] }));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

/* ================= STATIC FILES ================= */
app.use(express.static(path.join(__dirname, "public"), {
  maxAge: 0,
  etag: false,
}));

/* ================= SITEMAP (FINAL FIX) ================= */
app.get("/sitemap.xml", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "sitemap.xml"));
});

/* ================= CLOUDINARY ================= */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/* ================= DATABASE ================= */
let dbReady = false;

mongoose.set("strictQuery", false);
mongoose
  .connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 10,
  })
  .then(() => {
    console.log("✅ MongoDB connected");
    dbReady = true;
  })
  .catch(() => {
    console.log("❌ MongoDB connection failed");
    dbReady = false;
  });

/* ================= MODEL ================= */
const videoSchema = new mongoose.Schema(
  {
    title: String,
    url: String,
    thumbnail: String,
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

const Video = mongoose.model("Video", videoSchema);

/* ================= MULTER ================= */
const upload = multer({
  dest: "/tmp",
  limits: { fileSize: 500 * 1024 * 1024 },
});

/* ================= ROUTES ================= */

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/watch", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "watch.html"));
});

/* API: GET VIDEOS */
app.get("/api/videos", async (req, res) => {
  if (!dbReady) return res.json([]);
  const videos = await Video.find().sort({ createdAt: -1 }).lean();
  res.json(videos);
});

/* API: UPLOAD */
app.post("/api/upload", upload.single("video"), async (req, res) => {
  try {
    if (!dbReady)
      return res.status(503).json({ success: false });

    if (req.body.password !== ADMIN_PASSWORD)
      return res.status(401).json({ success: false });

    if (!req.file)
      return res.status(400).json({ success: false });

    const videoUpload = await cloudinary.uploader.upload(req.file.path, {
      resource_type: "video",
      folder: "kamababa/videos",
      chunk_size: 10 * 1024 * 1024,
    });

    fs.unlink(req.file.path, () => {});

    let thumbnailUrl = "";
    if (req.body.thumbnail?.startsWith("data:image")) {
      const thumb = await cloudinary.uploader.upload(req.body.thumbnail, {
        folder: "kamababa/thumbs",
      });
      thumbnailUrl = thumb.secure_url;
    }

    await Video.create({
      title: req.body.title || "Untitled",
      url: videoUpload.secure_url,
      thumbnail: thumbnailUrl,
    });

    res.json({ success: true });
  } catch (e) {
    console.error("UPLOAD ERROR:", e.message);
    res.status(500).json({ success: false });
  }
});

/* API: VIEW */
app.post("/api/view/:id", async (req, res) => {
  if (dbReady)
    await Video.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
  res.json({ success: true });
});

/* API: LIKE */
app.post("/api/like/:id", async (req, res) => {
  if (dbReady)
    await Video.findByIdAndUpdate(req.params.id, { $inc: { likes: 1 } });
  res.json({ success: true });
});

/* ================= START ================= */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
