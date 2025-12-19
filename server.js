const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static("public"));
app.use("/videos", express.static("uploads"));
app.use("/thumbs", express.static("thumbs"));

/* ------------------ DATA LOAD ------------------ */
let videos = [];
if (fs.existsSync("videos.json")) {
  videos = JSON.parse(fs.readFileSync("videos.json"));
}

/* ------------------ VIDEO LIST ------------------ */
app.get("/videos-list", (req, res) => {
  res.json(
    videos.map(v => ({
      id: v.id,
      title: v.title,
      thumb: v.thumb
    }))
  );
});

/* ------------------ WATCH VIDEO ------------------ */
app.get("/video/:id", (req, res) => {
  const video = videos.find(v => v.id == req.params.id);
  if (!video) return res.status(404).json({ error: "Video not found" });

  video.views++;
  fs.writeFileSync("videos.json", JSON.stringify(videos, null, 2));

  res.json(video);
});

/* ------------------ LIKE ------------------ */
app.post("/like/:id", (req, res) => {
  const v = videos.find(x => x.id == req.params.id);
  if (!v) return res.sendStatus(404);
  v.likes++;
  fs.writeFileSync("videos.json", JSON.stringify(videos, null, 2));
  res.sendStatus(200);
});

/* ------------------ DISLIKE ------------------ */
app.post("/dislike/:id", (req, res) => {
  const v = videos.find(x => x.id == req.params.id);
  if (!v) return res.sendStatus(404);
  v.dislikes++;
  fs.writeFileSync("videos.json", JSON.stringify(videos, null, 2));
  res.sendStatus(200);
});

/* ------------------ COMMENT ------------------ */
app.post("/comment/:id", (req, res) => {
  const v = videos.find(x => x.id == req.params.id);
  if (!v) return res.sendStatus(404);

  if (!req.body.text) return res.sendStatus(400);

  v.comments.push(req.body.text);
  fs.writeFileSync("videos.json", JSON.stringify(videos, null, 2));
  res.sendStatus(200);
});

/* ------------------ SERVER START ------------------ */
app.listen(PORT, () => {
  console.log("Server running at http://localhost:" + PORT);
});
