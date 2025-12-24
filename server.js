require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const path = require("path");
const fs = require("fs");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

/* ================= BASIC CONFIG ================= */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const BASE_URL =
  process.env.BASE_URL || "https://my-video-website-1-1.onrender.com";

/* ================= MIDDLEWARE ================= */
app.use(cors({ origin: "*", methods: ["GET", "POST"] }));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use(express.static(path.join(__dirname, "public"), {
  maxAge: 0,
  etag: false,
}));

/* ================= CLOUDINARY ================= */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/* ================= DATABASE ================= */
let dbReady = false;

mongoose.connect(process.env.MONGO_URI)
.then(() => {
  console.log("✅ MongoDB connected");
  dbReady = true;
})
.catch(err => {
  console.error("❌ MongoDB error:", err.message);
});

/* ================= MODEL ================= */
const Video = mongoose.model("Video", new mongoose.Schema({
  title: String,
  url: String,
  thumbnail: String,
  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
}));

/* ================= MULTER (DISK SAFE) ================= */
const upload = multer({
  storage: multer.diskStorage({
    destination: "tmp/",
    filename: (_, file, cb) =>
      cb(null, Date.now() + path.extname(file.originalname)),
  }),
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB
});

/* ================= ROUTES ================= */

app.post("/api/upload", upload.single("video"), async (req, res) => {
  try {
    if (!dbReady)
      return res.status(503).json({ error: "DB not ready" });

    if (req.body.password !== ADMIN_PASSWORD)
      return res.status(401).json({ error: "Wrong password" });

    if (!req.file)
      return res.status(400).json({ error: "No file" });

    /* ⬆️ Upload to Cloudinary */
    const result = await cloudinary.uploader.upload(req.file.path, {
      resource_type: "video",
      folder: "kamababa/videos",
    });

    fs.unlinkSync(req.file.path); // temp delete

    const video = await Video.create({
      title: req.body.title || "Untitled",
      url: result.secure_url,
      thumbnail: req.body.thumbnail || "",
    });

    res.json({ success: true, id: video._id });

  } catch (e) {
    console.error("UPLOAD ERROR:", e.message);
    res.status(500).json({ error: "Upload failed" });
  }
});

/* ================= START ================= */
app.listen(PORT, () => {
  console.log(`🚀 Server running on ${PORT}`);
});
