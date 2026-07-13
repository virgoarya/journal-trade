import axios from "axios";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../.env") });

async function debugGemini() {
  const nineRouterUrl = process.env.NINE_ROUTER_URL || "https://retvnja.abc-tunnel.us/v1";
  const nineRouterApiKey = process.env.NINE_ROUTER_API_KEY || "";

  try {
    const res = await axios.post(
      nineRouterUrl + "/chat/completions",
      {
        model: "gc/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "Respond with the single word: OK" }
        ],
        max_tokens: 10,
        temperature: 0.1
      },
      {
        headers: {
          "Authorization": "Bearer " + nineRouterApiKey,
          "Content-Type": "application/json"
        }
      }
    );
    console.log("RAW RESPONSE:");
    console.log(JSON.stringify(res.data, null, 2));
  } catch (error: any) {
    console.log("FAILED:", error.response?.status, JSON.stringify(error.response?.data || error.message));
  }
}

debugGemini();
