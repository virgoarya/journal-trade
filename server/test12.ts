import { env } from "./src/config/env";
import axios from "axios";

const prompt = "Ceritakan tentang pasar saham secara rinci dan panjang.";

axios.post(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`,
  {
    contents: [{ parts: [{ text: prompt }] }]
  }
).then(res => {
  console.log("LENGTH:", res.data.candidates[0].content.parts[0].text.length);
  console.log("REASON:", res.data.candidates[0].finishReason);
}).catch(console.error);
