import { env } from "./src/config/env";
import axios from "axios";

async function test(modelName: string) {
  try {
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: "Ceritakan tentang pasar saham secara rinci dan panjang." }] }],
        generationConfig: { maxOutputTokens: 800, max_output_tokens: 800 }
      }
    );
    console.log(modelName, "FINISH REASON:", res.data.candidates[0].finishReason);
    console.log(modelName, "LENGTH:", res.data.candidates[0].content.parts[0].text.length);
  } catch (e: any) {
    console.error(modelName, "FAILED:", e.response?.status);
  }
}

async function run() {
  await test("gemini-1.5-flash");
  await test("gemini-2.5-flash");
}
run();
