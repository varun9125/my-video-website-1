require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* 🔥 PUBLIC FOLDER (VERY IMPORTANT) */
app.use(express.static(path.join(__dirname, "public"), {
  maxAge: 0,
  etag: false,
}));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/watch", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "watch.html"));
});

/* VIDEO LIST API */
app.get("/api/videos", (req, res) => {
  const data = JSON.parse(
    fs.readFileSync(path.join(__dirname, "videos.json"), "utf8")
  );
  res.json(data);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Server running on port", PORT);
});
