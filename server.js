require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

/* ================= BASIC CONFIG ================= */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const BASE_URL =
  process.env.BASE_URL || "https://my-video-website-1-1.onrender.com";

/* ================= MIDDLEWARE ================= */
app.use(cors({ origin: "*", methods: ["GET", "POST"] }));
app.use(express.json({ limit: "3mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public"), {
  maxAge: 0,
  etag: false,
}));

/* ================= CLOUDINARY ================= */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/* ================= DATABASE ================= */
let dbReady = false;

mongoose.set("strictQuery", false);

mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 10000,
  maxPoolSize: 10,
})
.then(() => {
  console.log("✅ MongoDB connected");
  dbReady = true;
})
.catch(err => {
  console.error("❌ MongoDB connection error:", err.message);
  dbReady = false;
});

mongoose.connection.on("error", err => {
  console.error("❌ MongoDB runtime error:", err.message);
  dbReady = false;
});

mongoose.connection.on("disconnected", () => {
  console.error("❌ MongoDB disconnected");
  dbReady = false;
});

/* ================= MODEL ================= */
const videoSchema = new mongoose.Schema({
  title: { type: String, trim: true },
  url: { type: String, required: true },
  thumbnail: { type: String, default: "" },
  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false });

const Video = mongoose.model("Video", videoSchema);

/* ================= UPLOAD SETUP ================= */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

/* ================= ROUTES ================= */

app.get("/", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/watch", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.sendFile(path.join(__dirname, "public", "watch.html"));
});

app.get("/api/videos", async (req, res) => {
  try {
    if (!dbReady) return res.json([]);
    const videos = await Video.find().sort({ createdAt: -1 }).lean();
    res.json(videos);
  } catch {
    res.json([]);
  }
});

app.post("/api/upload", upload.single("video"), async (req, res) => {
  try {
    if (!dbReady) return res.status(503).json({ success:false });
    if (req.body.password !== ADMIN_PASSWORD)
      return res.status(401).json({ success:false });

    const videoUpload = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { resource_type:"video", folder:"kamababa/videos" },
        (err, result)=> err ? reject(err) : resolve(result)
      ).end(req.file.buffer);
    });

    let thumbnailUrl = "";
    if (req.body.thumbnail?.startsWith("data:image")) {
      const thumb = await cloudinary.uploader.upload(req.body.thumbnail,{
        folder:"kamababa/thumbs"
      });
      thumbnailUrl = thumb.secure_url;
    }

    await Video.create({
      title:req.body.title,
      url:videoUpload.secure_url,
      thumbnail:thumbnailUrl
    });

    res.json({ success:true });
  } catch {
    res.json({ success:false });
  }
});

app.post("/api/view/:id", async (req,res)=>{
 if(dbReady) await Video.findByIdAndUpdate(req.params.id,{ $inc:{ views:1 }});
 res.json({ success:true });
});

app.post("/api/like/:id", async (req,res)=>{
 if(dbReady) await Video.findByIdAndUpdate(req.params.id,{ $inc:{ likes:1 }});
 res.json({ success:true });
});

app.get("/sitemap.xml", async (req,res)=>{
 res.setHeader("Content-Type","application/xml");
 let urls=`<url><loc>${BASE_URL}/</loc></url>`;
 if(dbReady){
  const vids=await Video.find({}, "_id").lean();
  vids.forEach(v=>{
   urls+=`<url><loc>${BASE_URL}/watch?id=${v._id}</loc></url>`;
  });
 }
 res.send(`<?xml version="1.0"?>`+
 `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
});

app.listen(PORT,"0.0.0.0",()=>{
 console.log(`🚀 Server running on port ${PORT}`);
});
