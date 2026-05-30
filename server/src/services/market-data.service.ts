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
      const response = await axios.get(`https://finnhub.io/api/v1/news?category=general&token=${key}`, {
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

    try {
      const promises = symbols.map(async (symbol) => {
        const cacheKey = `quote_${symbol}`;
        if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_TTL_MS) {
          return { symbol, data: cache[cacheKey].data };
        }

        try {
          // Finnhub free tier may reject Forex/Crypto. We catch individual errors.
          const response = await axios.get(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${key}`, {
            timeout: 5000
          });
          
          // Update cache
          cache[cacheKey] = {
            data: response.data,
            timestamp: Date.now(),
          };
          
          return { symbol, data: response.data };
        } catch (symbolError) {
          console.warn(`Finnhub Quotes API Error for ${symbol}:`, (symbolError as any).message);
          // Return a mock/empty data for this symbol so the rest can succeed
          return { symbol, data: { dp: null, c: null } };
        }
      });

      const quoteData = await Promise.all(promises);
      return quoteData;
    } catch (error: any) {
      console.error("Finnhub Quotes API Error:", error.message);
      throw new Error("Failed to fetch live quotes");
    }
  },

   async getLiquidity() {
     const key = env.FRED_API_KEY;
     if (!key) {
       // If no FRED API key is configured, return dummy data for development
       const cacheKey = "liquidity_onrrp";
       // Cache for 1 hour to avoid generating dummy data too frequently
       if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < 3600000) {
         return cache[cacheKey].data;
       }

       const dummyData = {
         value: 2000, // Represents $2.0 trillion (since panel divides by 1000 to show trillions)
         change: 0,
         status: "UNKNOWN" as const,
         date: new Date().toISOString().split('T')[0]
       };

       // Update cache
       cache[cacheKey] = {
         data: dummyData,
         timestamp: Date.now(),
       };
       
       return dummyData;
     }

     const cacheKey = "liquidity_onrrp";
     // Cache for 1 hour since FRED updates daily
     if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < 3600000) {
       return cache[cacheKey].data;
     }

     try {
       // Get the last 2 observations to calculate the change
       const response = await axios.get(`https://api.stlouisfed.org/fred/series/observations?series_id=RRPONTSYD&api_key=${key}&file_type=json&sort_order=desc&limit=2`, {
         timeout: 5000
       });
       
       const observations = response.data.observations;
       if (!observations || observations.length < 2) {
         throw new Error("Insufficient data from FRED");
       }

const current = parseFloat(observations[0].value);
        const previous = parseFloat(observations[1].value);
        const change = current - previous;
        // If ON RRP value increases, money is flowing TO Fed overnight (DRAINING market liquidity)
        // If ON RRP value decreases, money is flowing FROM Fed overnight (INJECTING market liquidity)
        const status = change > 0 ? "DRAINING" : "INJECTING";
       
       const data = {
         value: current,
         change: change,
         status: status,
         date: observations[0].date
       };

       // Update cache
       cache[cacheKey] = {
         data: data,
         timestamp: Date.now(),
       };
       
       return data;
     } catch (error: any) {
       console.error("FRED API Error:", error.message);
       throw new Error("Failed to fetch ON RRP liquidity data");
     }
   }
};
