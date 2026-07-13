import axios from "axios";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../.env") });

async function listModels() {
  const nineRouterUrl = process.env.NINE_ROUTER_URL || "https://retvnja.abc-tunnel.us/v1";
  const nineRouterApiKey = process.env.NINE_ROUTER_API_KEY || "";

  try {
    const res = await axios.get(
      nineRouterUrl + "/models",
      {
        headers: {
          "Authorization": "Bearer " + nineRouterApiKey
        }
      }
    );
    console.log("SUCCESS! Available models on 9Router:");
    if (res.data && Array.isArray(res.data.data)) {
      res.data.data.forEach((model: any) => {
        console.log(`- ID: ${model.id}, Owned By: ${model.owned_by || 'unknown'}`);
      });
    } else {
      console.log(JSON.stringify(res.data, null, 2));
    }
  } catch (error: any) {
    console.log("FAILED to fetch models from 9Router:", error.response?.status, JSON.stringify(error.response?.data || error.message));
  }
}

listModels();
