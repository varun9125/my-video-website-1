const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;

// ===== CONFIG =====
const ADMIN_PASSWORD = "12345"; // 🔐 change if you want
const VIDEOS_JSON = path.join(__dirname, "videos.json");
const VIDEOS_DIR = path.join(__dirname, "videos");

// ===== ENSURE FILES/FOLDERS =====
if (!fs.existsSync(VIDEOS_DIR)) fs.mkdirSync(VIDEOS_DIR);
if (!fs.existsSync(VIDEOS_JSON)) fs.writeFileSync(VIDEOS_JSON, "[]");

// ===== MIDDLEWARE =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/videos", express.static(VIDEOS_DIR));

// ===== MULTER =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, VIDEOS_DIR),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// ===== PAGES =====
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

app.get("/watch", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "watch.html"))
);

app.get("/admin", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "admin.html"))
);

// ===== APIs =====
app.get("/api/videos", (req, res) => {
  const data = JSON.parse(fs.readFileSync(VIDEOS_JSON));
  res.json(data);
});

// upload
app.post("/api/upload", upload.single("video"), (req, res) => {
  if (req.headers["x-admin-password"] !== ADMIN_PASSWORD)
    return res.json({ success: false, error: "Wrong password" });

  const data = JSON.parse(fs.readFileSync(VIDEOS_JSON));

  data.push({
    id: Date.now(),
    title: req.body.title || "Untitled Video",
    url: "/videos/" + req.file.filename,
    views: 0,
    likes: 0,
    dislikes: 0,
    comments: []
  });

  fs.writeFileSync(VIDEOS_JSON, JSON.stringify(data, null, 2));
  res.json({ success: true });
});

// views
app.post("/api/view/:id", (req, res) => {
  const data = JSON.parse(fs.readFileSync(VIDEOS_JSON));
  const v = data.find(x => x.id == req.params.id);
  if (!v) return res.sendStatus(404);
  v.views++;
  fs.writeFileSync(VIDEOS_JSON, JSON.stringify(data, null, 2));
  res.json({ success: true });
});

// like
app.post("/api/like/:id", (req, res) => {
  const data = JSON.parse(fs.readFileSync(VIDEOS_JSON));
  const v = data.find(x => x.id == req.params.id);
  if (!v) return res.sendStatus(404);
  v.likes++;
  fs.writeFileSync(VIDEOS_JSON, JSON.stringify(data, null, 2));
  res.json({ success: true });
});

// dislike
app.post("/api/dislike/:id", (req, res) => {
  const data = JSON.parse(fs.readFileSync(VIDEOS_JSON));
  const v = data.find(x => x.id == req.params.id);
  if (!v) return res.sendStatus(404);
  v.dislikes++;
  fs.writeFileSync(VIDEOS_JSON, JSON.stringify(data, null, 2));
  res.json({ success: true });
});

// comment
app.post("/api/comment/:id", (req, res) => {
  const data = JSON.parse(fs.readFileSync(VIDEOS_JSON));
  const v = data.find(x => x.id == req.params.id);
  if (!v) return res.sendStatus(404);
  if (!req.body.text) return res.sendStatus(400);
  v.comments.push(req.body.text);
  fs.writeFileSync(VIDEOS_JSON, JSON.stringify(data, null, 2));
  res.json({ success: true });
});

// ===== START =====
app.listen(PORT, () => console.log("Server running on", PORT));
