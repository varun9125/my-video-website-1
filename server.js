const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/videos", express.static(path.join(__dirname, "videos")));

// HOME ROUTE (IMPORTANT)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// WATCH PAGE
app.get("/watch", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "watch.html"));
});

// API – get videos
app.get("/api/videos", (req, res) => {
  const data = fs.readFileSync("videos.json", "utf-8");
  res.json(JSON.parse(data));
});

// START SERVER
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
const multer = require("multer");
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "videos/");
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + ".mp4";
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });
app.post("/api/upload", upload.single("video"), (req, res) => {
  const fileName = req.file.filename;

  const data = JSON.parse(fs.readFileSync("videos.json", "utf-8"));

  const newVideo = {
    id: data.length + 1,
    title: req.body.title || "New Video",
    filename: fileName,
    url: "/videos/" + fileName,
    views: 0,
    likes: 0,
    dislikes: 0,
    comments: []
  };

  data.push(newVideo);
  fs.writeFileSync("videos.json", JSON.stringify(data, null, 2));

  res.json({ success: true });
});
