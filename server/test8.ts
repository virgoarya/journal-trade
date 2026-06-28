import { env } from "./src/config/env";
env.GROQ_API_KEY = ""; // Force Gemini fallback

import { macroAiService } from "./src/services/macro-ai.service";

macroAiService.analyzeRegime(
  [{ ticker: "SPY", name: "SPDR", change: 1.5 }], 
  "Goldilocks", 
  "Draining", 
  {}
).then(res => console.log("LENGTH:", res?.length, "TEXT:", res))
 .catch(console.error);
