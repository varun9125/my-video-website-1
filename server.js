const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// 🔐 ADMIN PASSWORD (यहीं change करना)
const ADMIN_PASSWORD = "ravi@1234";

// ✅ uploads folder check
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// ✅ multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// ✅ STATIC FOLDERS (IMPORTANT FIX)
app.use(express.static(path.join(__dirname, "public")));
app.use("/videos", express.static(path.join(__dirname, "uploads")));

// 🔐 ADMIN CHECK MIDDLEWARE
function adminAuth(req, res, next) {
  const password = req.headers["x-admin-password"];
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// 🔐 upload route (ADMIN ONLY)
app.post("/upload", adminAuth, upload.single("video"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  res.json({ success: true });
});

// 📺 videos list (PUBLIC)
app.get("/videos-list", (req, res) => {
  fs.readdir("uploads", (err, files) => {
    if (err) return res.json([]);

    const videos = files.map(file => ({
      name: file,
      url: "/videos/" + file
    }));

    res.json(videos);
  });
});

// ✅ SERVER START (Render compatible)
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
