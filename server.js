const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

/* ========= CONFIG ========= */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ravi@123";
const VIDEOS_JSON = path.join(__dirname, "videos.json");

/* ========= MIDDLEWARE ========= */
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

/* ========= INIT videos.json ========= */
if (!fs.existsSync(VIDEOS_JSON)) {
  fs.writeFileSync(VIDEOS_JSON, "[]", "utf-8");
}

/* ========= HELPERS ========= */
function readVideos() {
  try {
    return JSON.parse(fs.readFileSync(VIDEOS_JSON, "utf-8"));
  } catch (e) {
    console.error("❌ Failed to read videos.json", e);
    return [];
  }
}

function saveVideos(data) {
  try {
    fs.writeFileSync(VIDEOS_JSON, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("❌ Failed to save videos.json", e);
  }
}

/* =====================================================
   API: SAVE CLOUDINARY VIDEO (ADMIN ONLY)
   ===================================================== */
app.post("/api/save", (req, res) => {
  if (req.headers["x-admin-password"] !== ADMIN_PASSWORD) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized"
    });
  }

  const { title, url } = req.body;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: "Missing video URL"
    });
  }

  const videos = readVideos();

  videos.push({
    id: Date.now().toString(),
    title: title || "Untitled Video",
    url: url,          // 🔥 Cloudinary secure_url
    views: 0,
    likes: 0,
    dislikes: 0,
    comments: []
  });

  saveVideos(videos);

  res.json({ success: true });
});

/* ========= API: GET VIDEOS ========= */
app.get("/api/videos", (req, res) => {
  res.json(readVideos());
});

/* ========= START SERVER ========= */
app.listen(PORT, () => {
  console.log("✅ Server running on port", PORT);
});
