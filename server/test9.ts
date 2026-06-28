import { env } from "./src/config/env";
import axios from "axios";

const prompt = "Ceritakan tentang pasar saham secara singkat (50 kata).";

axios.post(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`,
  {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 150 }
  }
).then(res => {
  console.log("CANDIDATES:");
  console.log(JSON.stringify(res.data.candidates, null, 2));
}).catch(console.error);
