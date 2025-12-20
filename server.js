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

/* ====== CLOUDINARY CONFIG (ENV VARS) ====== */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/* ================= MIDDLEWARE ================= */
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({ storage: multer.memoryStorage() });

/* ================= INIT videos.json ================= */
if (!fs.existsSync(VIDEOS_JSON)) {
  fs.writeFileSync(VIDEOS_JSON, "[]", "utf-8");
}

/* ================= HELPERS ================= */
const readVideos = () => JSON.parse(fs.readFileSync(VIDEOS_JSON, "utf-8"));
const saveVideos = (data) =>
  fs.writeFileSync(VIDEOS_JSON, JSON.stringify(data, null, 2));

/* ================= UPLOAD API ================= */
app.post("/api/upload", upload.single("video"), async (req, res) => {
  try {
    if (req.headers["x-admin-password"] !== ADMIN_PASSWORD) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: "No video file" });
    }

    const title = req.body.title || "Untitled Video";

    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: "video",
          folder: "kamababa"
        },
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        }
      ).end(req.file.buffer);
    });

    const data = readVideos();

    data.push({
      id: Date.now().toString(),
      title,
      url: result.secure_url,
      views: 0,
      likes: 0,
      dislikes: 0,
      comments: []
    });

    saveVideos(data);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Upload failed" });
  }
});

/* ================= GET VIDEOS ================= */
app.get("/api/videos", (req, res) => {
  res.json(readVideos());
});

/* ================= START ================= */
app.listen(PORT, () => {
  console.log("✅ Server running on port", PORT);
});
