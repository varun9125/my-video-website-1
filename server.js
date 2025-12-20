const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;

/* ================= CONFIG ================= */
const ADMIN_PASSWORD = "12345"; // 🔐 change later
const DATA_DIR = __dirname;
const VIDEOS_JSON = path.join(DATA_DIR, "videos.json");
const VIDEOS_DIR = path.join(DATA_DIR, "videos");

/* ================= SAFE INIT ================= */
if (!fs.existsSync(VIDEOS_DIR)) {
  fs.mkdirSync(VIDEOS_DIR, { recursive: true });
}

if (!fs.existsSync(VIDEOS_JSON)) {
  fs.writeFileSync(VIDEOS_JSON, "[]", "utf-8");
}

/* ================= MIDDLEWARE ================= */
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/videos", express.static(VIDEOS_DIR));

/* basic security */
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  next();
});

/* ================= MULTER ================= */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, VIDEOS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

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

/* ================= APIs ================= */

/* get videos */
app.get("/api/videos", (req, res) => {
  res.json(readVideos());
});

/* upload */
app.post("/api/upload", upload.single("video"), (req, res) => {
  if (req.headers["x-admin-password"] !== ADMIN_PASSWORD) {
    return res.json({ success: false, error: "Wrong password" });
  }

  if (!req.file) {
    return res.json({ success: false, error: "No video uploaded" });
  }

  const data = readVideos();

  data.push({
    id: Date.now().toString(),
    title: req.body.title || "Untitled Video",
    url: "/videos/" + req.file.filename,
    views: 0,
    likes: 0,
    dislikes: 0,
    comments: []
  });

  saveVideos(data);
  res.json({ success: true });
});

/* view count */
app.post("/api/view/:id", (req, res) => {
  const data = readVideos();
  const v = data.find(x => x.id == req.params.id);
  if (!v) return res.sendStatus(404);

  v.views += 1;
  saveVideos(data);
  res.json({ success: true });
});

/* like */
app.post("/api/like/:id", (req, res) => {
  const data = readVideos();
  const v = data.find(x => x.id == req.params.id);
  if (!v) return res.sendStatus(404);

  v.likes += 1;
  saveVideos(data);
  res.json({ success: true });
});

/* dislike */
app.post("/api/dislike/:id", (req, res) => {
  const data = readVideos();
  const v = data.find(x => x.id == req.params.id);
  if (!v) return res.sendStatus(404);

  v.dislikes += 1;
  saveVideos(data);
  res.json({ success: true });
});

/* comment */
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
