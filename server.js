require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

/* ================= BASIC CONFIG ================= */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const BASE_URL =
  process.env.BASE_URL || "https://my-video-website-1-1.onrender.com";

/* ================= MIDDLEWARE ================= */
app.use(cors({ origin: "*", methods: ["GET", "POST"] }));
app.use(express.json({ limit: "2mb" })); // only small JSON
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public"), {
  maxAge: 0,
  etag: false,
}));

/* ================= DATABASE ================= */
let dbReady = false;

mongoose.set("strictQuery", false);
mongoose.connect(process.env.MONGO_URI)
.then(() => {
  console.log("✅ MongoDB connected");
  dbReady = true;
})
.catch(err => {
  console.error("❌ MongoDB error:", err.message);
  dbReady = false;
});

/* ================= MODEL ================= */
const Video = mongoose.model("Video", new mongoose.Schema({
  title: String,
  url: { type: String, required: true },
  thumbnail: String,
  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
}));

/* ================= ROUTES ================= */

/* 🔐 SAVE VIDEO (URL ONLY – SAFE) */
app.post("/api/save-video", async (req, res) => {
  try {
    if (!dbReady)
      return res.json({ success:false, error:"DB not ready" });

    const { password, title, url, thumbnail } = req.body;

    if (password !== ADMIN_PASSWORD)
      return res.json({ success:false, error:"Wrong password" });

    if (!url)
      return res.json({ success:false, error:"Missing video URL" });

    const video = await Video.create({
      title: title || "Untitled",
      url,
      thumbnail: thumbnail || ""
    });

    res.json({ success:true, id: video._id });

  } catch (e) {
    console.error("SAVE ERROR:", e.message);
    res.json({ success:false, error:"Server error" });
  }
});

/* 🎬 GET VIDEOS (FAST + SMOOTH) */
app.get("/api/videos", async (req, res) => {
  try {
    if (!dbReady) return res.json([]);

    const videos = await Video.find()
      .sort({ createdAt: -1 })
      .lean();

    res.json(videos);
  } catch (e) {
    console.error("VIDEOS ERROR:", e.message);
    res.json([]);
  }
});

/* 👁 VIEW */
app.post("/api/view/:id", async (req, res) => {
  try {
    if (dbReady)
      await Video.findByIdAndUpdate(req.params.id, { $inc:{ views:1 } });
  } catch {}
  res.json({ success:true });
});

/* 👍 LIKE */
app.post("/api/like/:id", async (req, res) => {
  try {
    if (dbReady)
      await Video.findByIdAndUpdate(req.params.id, { $inc:{ likes:1 } });
  } catch {}
  res.json({ success:true });
});

/* 🗺️ SITEMAP */
app.get("/sitemap.xml", async (req, res) => {
  res.setHeader("Content-Type","application/xml");
  let urls = `<url><loc>${BASE_URL}/</loc></url>`;

  if (dbReady) {
    const vids = await Video.find({}, "_id").lean();
    vids.forEach(v=>{
      urls += `<url><loc>${BASE_URL}/watch?id=${v._id}</loc></url>`;
    });
  }

  res.send(
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    urls +
    `</urlset>`
  );
});

/* ================= START ================= */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
