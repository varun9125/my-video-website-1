require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

/* ================= BASIC CONFIG ================= */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

/* ================= MIDDLEWARE ================= */
app.use(cors({ origin: "*", methods: ["GET", "POST"] }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use(express.static(path.join(__dirname, "public"), {
  maxAge: 0,
  etag: false,
}));

/* ================= DATABASE ================= */
let dbReady = false;

mongoose.connect(process.env.MONGO_URI)
.then(() => {
  console.log("✅ MongoDB connected");
  dbReady = true;
})
.catch(err => {
  console.error("❌ MongoDB connection error:", err.message);
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

/* ================= ROUTES ================= */

/* 🔐 SAVE VIDEO (ADMIN PANEL) */
app.post("/api/save-video", async (req, res) => {
  try {
    const { password, title, url } = req.body;

    if (!password || !url) {
      return res.json({ success: false, error: "Missing data" });
    }

    if (password !== ADMIN_PASSWORD) {
      return res.json({ success: false, error: "Wrong password" });
    }

    if (!dbReady) {
      return res.json({ success: false, error: "Database not ready" });
    }

    const video = await Video.create({
      title: title || "Untitled",
      url,
      thumbnail: ""
    });

    res.json({ success: true, id: video._id });

  } catch (err) {
    console.error("SAVE VIDEO ERROR:", err.message);
    res.json({ success: false, error: "Server error" });
  }
});

/* 🎬 GET VIDEOS (PAGINATION – FAST) */
app.get("/api/videos", async (req, res) => {
  try {
    if (!dbReady) {
      return res.json({ videos: [], hasMore: false });
    }

    const page = parseInt(req.query.page || "1");
    const limit = 12;
    const skip = (page - 1) * limit;

    const videos = await Video.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Video.countDocuments();

    res.json({
      videos,
      hasMore: skip + videos.length < total
    });

  } catch (err) {
    console.error("GET VIDEOS ERROR:", err.message);
    res.json({ videos: [], hasMore: false });
  }
});

/* ================= START SERVER ================= */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
