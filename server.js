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
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "changeme";
const BASE_URL = "https://my-video-website-1-1.onrender.com";

/* ================= CLOUDINARY ================= */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/* ================= MONGODB ================= */
mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 5000
})
.then(() => console.log("✅ MongoDB connected"))
.catch(err => console.error("❌ MongoDB error", err));

/* ================= MODEL ================= */
const videoSchema = new mongoose.Schema({
  title: String,
  url: String,
  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  dislikes: { type: Number, default: 0 },
  comments: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now }
});

const Video = mongoose.model("Video", videoSchema);

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

/* ================= WATCH PAGE ================= */
app.get("/watch", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "watch.html"));
});

/* ================= ✅ FINAL ADMIN UPLOAD ================= */
app.post("/api/upload", upload.single("video"), async (req, res) => {
  try {
    const { password, title } = req.body;

    // ✅ BODY based admin check (mobile-safe)
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

    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: "video",
          folder: "kamababa",
          timeout: 120000
        },
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        }
      ).end(req.file.buffer);
    });

    if (!result?.secure_url) {
      throw new Error("Cloudinary upload failed");
    }

    await Video.create({
      title: title || "Untitled",
      url: result.secure_url
    });

    res.json({
      success: true,
      url: result.secure_url
    });

  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Upload failed"
    });
  }
});

/* ================= GET VIDEOS ================= */
app.get("/api/videos", async (req, res) => {
  try {
    const videos = await Video.find().sort({ createdAt: -1 });
    res.json(videos);
  } catch {
    res.status(500).json([]);
  }
});

/* ================= SAFE ID CHECK ================= */
const isValidId = id => mongoose.Types.ObjectId.isValid(id);

/* ================= VIEW ================= */
app.post("/api/view/:id", async (req, res) => {
  if (!isValidId(req.params.id)) return res.json({ success: false });
  await Video.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
  res.json({ success: true });
});

/* ================= LIKE ================= */
app.post("/api/like/:id", async (req, res) => {
  if (!isValidId(req.params.id)) return res.json({ success: false });
  await Video.findByIdAndUpdate(req.params.id, { $inc: { likes: 1 } });
  res.json({ success: true });
});

/* ================= DISLIKE ================= */
app.post("/api/dislike/:id", async (req, res) => {
  if (!isValidId(req.params.id)) return res.json({ success: false });
  await Video.findByIdAndUpdate(req.params.id, { $inc: { dislikes: 1 } });
  res.json({ success: true });
});

/* ================= COMMENT ================= */
app.post("/api/comment/:id", async (req, res) => {
  if (!isValidId(req.params.id) || !req.body.text) {
    return res.json({ success: false });
  }
  await Video.findByIdAndUpdate(req.params.id, {
    $push: { comments: req.body.text }
  });
  res.json({ success: true });
});

/* ================= SITEMAP ================= */
app.get("/sitemap.xml", async (req, res) => {
  res.setHeader("Content-Type", "application/xml");

  let urls = `
<url>
  <loc>${BASE_URL}/</loc>
  <changefreq>daily</changefreq>
  <priority>1.0</priority>
</url>`;

  try {
    if (mongoose.connection.readyState === 1) {
      const videos = await Video.find({}, "_id");
      videos.forEach(v => {
        urls += `
<url>
  <loc>${BASE_URL}/watch?id=${v._id}</loc>
  <changefreq>weekly</changefreq>
  <priority>0.8</priority>
</url>`;
      });
    }
  } catch (e) {}

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  res.status(200).send(sitemap);
});

/* ================= START ================= */
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
