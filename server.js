const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;

const app = express();
const PORT = process.env.PORT || 3000;

/* ================= CONFIG ================= */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ravi@123";
const VIDEOS_JSON = path.join(__dirname, "videos.json");

/* ================= CLOUDINARY ================= */
if (
  !process.env.CLOUDINARY_CLOUD_NAME ||
  !process.env.CLOUDINARY_API_KEY ||
  !process.env.CLOUDINARY_API_SECRET
) {
  console.error("❌ Cloudinary env variables missing");
  process.exit(1);
}

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
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

/* ================= MULTER ================= */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB (safe)
});

/* ================= HELPERS ================= */
function readVideos() {
  try {
    return JSON.parse(fs.readFileSync(VIDEOS_JSON, "utf-8"));
  } catch {
    return [];
  }
}

function saveVideos(data) {
  fs.writeFileSync(VIDEOS_JSON, JSON.stringify(data, null, 2));
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

// get videos
app.get("/api/videos", (req, res) => {
  res.json(readVideos());
});

// 🔥 UPLOAD TO CLOUDINARY
app.post("/api/upload", upload.single("video"), (req, res) => {
  if (req.headers["x-admin-password"] !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, error: "No file" });
  }

  const uploadStream = cloudinary.uploader.upload_stream(
    {
      resource_type: "video",
      folder: "kamababa"
    },
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({
          success: false,
          error: "Cloudinary upload failed"
        });
      }

      const data = readVideos();
      data.push({
        id: Date.now().toString(),
        title: req.body.title || "Untitled",
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

  uploadStream.end(req.file.buffer);
});

/* ================= INTERACTIONS ================= */
app.post("/api/view/:id", (req, res) => {
  const d = readVideos();
  const v = d.find(x => x.id === req.params.id);
  if (!v) return res.sendStatus(404);
  v.views++;
  saveVideos(d);
  res.json({ success: true });
});

app.post("/api/like/:id", (req, res) => {
  const d = readVideos();
  const v = d.find(x => x.id === req.params.id);
  if (!v) return res.sendStatus(404);
  v.likes++;
  saveVideos(d);
  res.json({ success: true });
});

app.post("/api/dislike/:id", (req, res) => {
  const d = readVideos();
  const v = d.find(x => x.id === req.params.id);
  if (!v) return res.sendStatus(404);
  v.dislikes++;
  saveVideos(d);
  res.json({ success: true });
});

app.post("/api/comment/:id", (req, res) => {
  const d = readVideos();
  const v = d.find(x => x.id === req.params.id);
  if (!v || !req.body.text) return res.sendStatus(400);
  v.comments.push(req.body.text);
  saveVideos(d);
  res.json({ success: true });
});

/* ================= START ================= */
app.listen(PORT, () => {
  console.log("✅ Server running on port", PORT);
});
