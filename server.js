const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;

// ===== CONFIG =====
const ADMIN_PASSWORD = "12345"; // 🔐 apna password yahan rakho

// ===== MIDDLEWARE =====
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/videos", express.static(path.join(__dirname, "videos")));

// ===== MULTER SETUP =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "videos/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + ".mp4");
  }
});
const upload = multer({ storage });

// ===== ROUTES =====
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/watch", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "watch.html"));
});

app.get("/api/videos", (req, res) => {
  const data = fs.readFileSync("videos.json", "utf-8");
  res.json(JSON.parse(data));
});

// ===== ADMIN UPLOAD =====
app.post("/api/upload", upload.single("video"), (req, res) => {
  const pass = req.headers["x-admin-password"];

  if (pass !== ADMIN_PASSWORD) {
    return res.json({ success: false, error: "Wrong password" });
  }

  const data = JSON.parse(fs.readFileSync("videos.json", "utf-8"));

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
  fs.writeFileSync("videos.json", JSON.stringify(data, null, 2));

  res.json({ success: true });
});

// ===== START =====
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
