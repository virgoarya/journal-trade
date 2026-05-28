import { env } from "../config/env";
import axios from "axios";

// In-memory cache to prevent hitting rate limits
const cache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_TTL_MS = 60000; // 60 seconds

export const marketDataService = {
  async getNews() {
    const key = process.env.FINNHUB_API_KEY;
    if (!key) {
      throw new Error("FINNHUB_API_KEY is not configured");
    }

    const cacheKey = "news_general";
    if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_TTL_MS) {
      return cache[cacheKey].data;
    }

    try {
      // Fetch general market news
      const response = await axios.get(\`https://finnhub.io/api/v1/news?category=general&token=\${key}\`, {
        timeout: 5000
      });
      
      const data = response.data.slice(0, 10); // Take top 10 news
      
      // Update cache
      cache[cacheKey] = {
        data: data,
        timestamp: Date.now(),
      };
      
      return data;
    } catch (error: any) {
      console.error("Finnhub News API Error:", error.message);
      throw new Error("Failed to fetch live news");
    }
  },

  async getQuotes(symbols: string[]) {
    const key = process.env.FINNHUB_API_KEY;
    if (!key) {
      throw new Error("FINNHUB_API_KEY is not configured");
    }

    const results = [];
    
    // Finnhub free tier allows 60 calls/minute. We need to be careful with loops.
    // We will use Promise.all but be mindful of the rate limit. 
    // Ideally symbols array length < 10.
    
    try {
      const promises = symbols.map(async (symbol) => {
        const cacheKey = \`quote_\${symbol}\`;
        if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_TTL_MS) {
          return { symbol, data: cache[cacheKey].data };
        }

        const response = await axios.get(\`https://finnhub.io/api/v1/quote?symbol=\${symbol}&token=\${key}\`, {
          timeout: 5000
        });
        
        // Update cache
        cache[cacheKey] = {
          data: response.data,
          timestamp: Date.now(),
        };
        
        return { symbol, data: response.data };
      });

      const quoteData = await Promise.all(promises);
      return quoteData;
    } catch (error: any) {
      console.error("Finnhub Quotes API Error:", error.message);
      throw new Error("Failed to fetch live quotes");
    }
  }
};
