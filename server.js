const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "12345";
const VIDEOS_JSON = path.join(__dirname, "videos.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

if (!fs.existsSync(VIDEOS_JSON)) {
  fs.writeFileSync(VIDEOS_JSON, "[]");
}

function readVideos(){
  return JSON.parse(fs.readFileSync(VIDEOS_JSON));
}

function saveVideos(d){
  fs.writeFileSync(VIDEOS_JSON, JSON.stringify(d,null,2));
}

app.post("/api/save",(req,res)=>{
  if(req.headers["x-admin-password"] !== ADMIN_PASSWORD){
    return res.status(401).json({error:"Unauthorized"});
  }

  const { title, url } = req.body;
  if(!url) return res.status(400).json({error:"Missing URL"});

  const data = readVideos();
  data.push({
    id: Date.now().toString(),
    title,
    url,
    views:0,
    likes:0,
    dislikes:0,
    comments:[]
  });

  saveVideos(data);
  res.json({ success:true });
});

app.get("/api/videos",(req,res)=>{
  res.json(readVideos());
});

app.listen(PORT,()=>{
  console.log("Server running on",PORT);
});
