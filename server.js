const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;

const app = express();
const PORT = process.env.PORT || 3000;

/* ================= CONFIG ================= */
const ADMIN_PASSWORD = "12345"; // 🔐 change later
const VIDEOS_JSON = path.join(__dirname, "videos.json");

/* ================= CLOUDINARY ================= */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/* ================= ENSURE JSON ================= */
if (!fs.existsSync(VIDEOS_JSON)) {
  fs.writeFileSync(VIDEOS_JSON, "[]", "utf-8");
}

/* ================= MIDDLEWARE ================= */
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

/* ================= MULTER (MEMORY) ================= */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

/* ================= HELPERS ================= */
function readVideos() {
  try {
    return JSON.parse(fs.readFileSync(VIDEOS_JSON, "utf-8"));
  } catch (e) {
    console.error("Failed to read videos.json:", e);
    return [];
  }
}

function saveVideos(data) {
  try {
    fs.writeFileSync(VIDEOS_JSON, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Failed to save videos.json:", e);
  }
}

/* ================= PAGES ================= */
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);
app.get("/watch", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "watch.html"))
);
app.get("/admin", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "admin.html"))
);

/* ================= APIs ================= */

// get all videos
app.get("/api/videos", (req, res) => {
  const data = readVideos();
  console.log("GET /api/videos →", data.length, "videos");
  res.json(data);
});

// 🔥 UPLOAD → CLOUDINARY (PERMANENT)
app.post("/api/upload", upload.single("video"), (req, res) => {
  console.log("Upload request received");

  if (req.headers["x-admin-password"] !== ADMIN_PASSWORD) {
    console.log("❌ Wrong admin password");
    return res.json({ success: false, error: "Wrong password" });
  }

  if (!req.file) {
    console.log("❌ No video uploaded");
    return res.json({ success: false, error: "No video uploaded" });
  }

  console.log("Uploading file to Cloudinary:", req.file.originalname);

  const stream = cloudinary.uploader.upload_stream(
    {
      resource_type: "video",
      folder: "kamababa"
    },
    (err, result) => {
      if (err) {
        console.error("Cloudinary upload error:", err);
        return res.json({ 
          success: false, 
          error: "Cloud upload failed", 
          details: err.message 
        });
      }

      console.log("Upload successful:", result.secure_url);

      const data = readVideos();
      data.push({
        id: Date.now().toString(),
        title: req.body.title || "Untitled Video",
        url: result.secure_url,
        views: 0,
        likes: 0,
        dislikes: 0,
        comments: []
      });

      saveVideos(data);
      res.json({ success: true });
    }
  );

  try {
    stream.end(req.file.buffer);
  } catch (e) {
    console.error("Failed to send buffer to Cloudinary:", e);
    res.json({ success: false, error: "Upload failed", details: e.message });
  }
});

// view count
app.post("/api/view/:id", (req, res) => {
  const data = readVideos();
  const v = data.find(x => x.id == req.params.id);
  if (!v) return res.sendStatus(404);
  v.views++;
  saveVideos(data);
  res.json({ success: true });
});

// like
app.post("/api/like/:id", (req, res) => {
  const data = readVideos();
  const v = data.find(x => x.id == req.params.id);
  if (!v) return res.sendStatus(404);
  v.likes++;
  saveVideos(data);
  res.json({ success: true });
});

// dislike
app.post("/api/dislike/:id", (req, res) => {
  const data = readVideos();
  const v = data.find(x => x.id == req.params.id);
  if (!v) return res.sendStatus(404);
  v.dislikes++;
  saveVideos(data);
  res.json({ success: true });
});

// comment
app.post("/api/comment/:id", (req, res) => {
  const data = readVideos();
  const v = data.find(x => x.id == req.params.id);
  if (!v) return res.sendStatus(404);
  if (!req.body.text) return res.sendStatus(400);
  v.comments.push(req.body.text);
  saveVideos(data);
  res.json({ success: true });
});

/* ================= START ================= */
app.listen(PORT, () => {
  console.log("✅ Server running on port", PORT);
});
