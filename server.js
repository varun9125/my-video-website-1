const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;

// ===== CONFIG =====
const ADMIN_PASSWORD = "12345"; // 🔐 Apna password yahan rakho
const VIDEOS_JSON = path.join(__dirname, "videos.json");
const VIDEOS_DIR = path.join(__dirname, "videos");

// ===== MIDDLEWARE =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/videos", express.static(VIDEOS_DIR));

// ===== MULTER SETUP =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, VIDEOS_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// ===== ROUTES =====

// Home page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Watch page
app.get("/watch", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "watch.html"));
});

// Get all videos
app.get("/api/videos", (req, res) => {
  if (!fs.existsSync(VIDEOS_JSON)) fs.writeFileSync(VIDEOS_JSON, "[]");
  const data = JSON.parse(fs.readFileSync(VIDEOS_JSON, "utf-8"));
  res.json(data);
});

// ===== ADMIN UPLOAD =====
app.post("/api/upload", upload.single("video"), (req, res) => {
  const pass = req.headers["x-admin-password"];
  if (pass !== ADMIN_PASSWORD) return res.json({ success: false, error: "Wrong password" });

  if (!req.file) return res.json({ success: false, error: "No video uploaded" });

  if (!fs.existsSync(VIDEOS_JSON)) fs.writeFileSync(VIDEOS_JSON, "[]");
  const data = JSON.parse(fs.readFileSync(VIDEOS_JSON, "utf-8"));

  const newVideo = {
    id: data.length + 1,
    title: req.body.title || "New Video",
    filename: req.file.filename,
    url: "/videos/" + req.file.filename,
    views: 0,
    likes: 0,
    dislikes: 0,
    comments: []
  };

  data.push(newVideo);
  fs.writeFileSync(VIDEOS_JSON, JSON.stringify(data, null, 2));

  res.json({ success: true });
});

// ===== LIKE / DISLIKE / COMMENT =====
app.post("/api/like/:id", (req, res) => {
  const data = JSON.parse(fs.readFileSync(VIDEOS_JSON, "utf-8"));
  const video = data.find(v => v.id == req.params.id);
  if (!video) return res.status(404).json({ error: "Video not found" });
  video.likes += 1;
  fs.writeFileSync(VIDEOS_JSON, JSON.stringify(data, null, 2));
  res.json({ success: true });
});

app.post("/api/dislike/:id", (req, res) => {
  const data = JSON.parse(fs.readFileSync(VIDEOS_JSON, "utf-8"));
  const video = data.find(v => v.id == req.params.id);
  if (!video) return res.status(404).json({ error: "Video not found" });
  video.dislikes += 1;
  fs.writeFileSync(VIDEOS_JSON, JSON.stringify(data, null, 2));
  res.json({ success: true });
});

app.post("/api/comment/:id", (req, res) => {
  const data = JSON.parse(fs.readFileSync(VIDEOS_JSON, "utf-8"));
  const video = data.find(v => v.id == req.params.id);
  if (!video) return res.status(404).json({ error: "Video not found" });
  const text = req.body.text;
  if (!text) return res.status(400).json({ error: "Comment cannot be empty" });
  video.comments.push(text);
  fs.writeFileSync(VIDEOS_JSON, JSON.stringify(data, null, 2));
  res.json({ success: true });
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
