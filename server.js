const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

/* ================= CONFIG ================= */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

/* ================= CLOUDINARY ================= */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/* ================= MONGODB ================= */
mongoose.connect(process.env.MONGO_URI)
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
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
const upload = multer({ storage: multer.memoryStorage() });

/* ================= UPLOAD ================= */
app.post("/api/upload", upload.single("video"), async (req, res) => {
  try {
    if (req.headers["x-admin-password"] !== ADMIN_PASSWORD) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file" });
    }

    const title = req.body.title || "Untitled";

    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { resource_type: "video", folder: "kamababa" },
        (err, result) => err ? reject(err) : resolve(result)
      ).end(req.file.buffer);
    });

    await Video.create({
      title,
      url: result.secure_url
    });

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

/* ================= GET VIDEOS ================= */
app.get("/api/videos", async (req, res) => {
  const videos = await Video.find().sort({ createdAt: -1 });
  res.json(videos);
});

/* ================= VIEW ================= */
app.post("/api/view/:id", async (req, res) => {
  await Video.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
  res.json({ success: true });
});

/* ================= LIKE ================= */
app.post("/api/like/:id", async (req, res) => {
  await Video.findByIdAndUpdate(req.params.id, { $inc: { likes: 1 } });
  res.json({ success: true });
});

/* ================= DISLIKE ================= */
app.post("/api/dislike/:id", async (req, res) => {
  await Video.findByIdAndUpdate(req.params.id, { $inc: { dislikes: 1 } });
  res.json({ success: true });
});

/* ================= COMMENT ================= */
app.post("/api/comment/:id", async (req, res) => {
  if (!req.body.text) return res.json({ success: false });

  await Video.findByIdAndUpdate(req.params.id, {
    $push: { comments: req.body.text }
  });

  res.json({ success: true });
});

/* ================= START ================= */
app.listen(PORT, () => {
  console.log("🚀 Server running on", PORT);
});
