import { mcpService, MCPToolInfo } from "./mcp.service";
import { silentLogger } from "../utils/silent-logger";

// ─── Internal Native Tools ───────────────────────────────────────
// Tools data dari service internal project (market-data, geo-risk, nexus).
// Tidak perlu Python MCP server — langsung panggil service yang sudah ada.

export async function registerInternalTools() {
  const tools: MCPToolInfo[] = [
    {
      name: "get_economic_calendar",
      description: "Ambil jadwal event ekonomi mendatang (high/medium/impact, tanggal, mata uang). Berguna untuk analisis event-driven.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Jumlah event yang diambil (default: 10)" },
        },
      },
    },
    {
      name: "get_news",
      description: "Ambil berita makroekonomi terbaru yang relevan dengan pasar. Berguna untuk analisis sentimen dan katalis.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Jumlah berita yang diambil (default: 10)" },
        },
      },
    },
    {
      name: "get_liquidity",
      description: "Ambil data likuiditas ON RRP (Overnight Reverse Repo) terkini — total value, perubahan harian, dan status liquidity drain/inject.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_tga",
      description: "Ambil data Treasury General Account (TGA) terkini — total balance, perubahan, dampak terhadap net liquidity.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_geo_risk",
      description: "Ambil skor geo-risk (CPI, Fed Funds, VIX, PMI, ON RRP) dan top risk driver. Berguna untuk analisis geopolitik dan risk sentiment.",
      inputSchema: { type: "object", properties: {} },
    },
  ];

  // Register via mcpService tanpa perlu client connection
  for (const t of tools) {
    try {
      await mcpService.registerInternalTool(t);
    } catch (err: any) {
      silentLogger.warn(`[InternalTools] Failed to register ${t.name}: ${err.message}`);
    }
  }

  silentLogger.info(`[InternalTools] Registered ${tools.length} internal tools`);
}

// ─── Execute internal tools ──────────────────────────────────────
export async function executeInternalTool(name: string, args: Record<string, any>): Promise<any> {
  try {
    switch (name) {
      case "get_economic_calendar": {
        const { marketDataService } = await import("./market-data.service");
        const calendar = await marketDataService.getEconomicCalendar();
        const limit = args?.limit || 10;
        const events = (calendar || []).slice(0, limit);
        return events.map((e: any) => ({
          date: e.date,
          title: e.title,
          currency: e.currency,
          impact: e.impact,
          previous: e.previous,
          forecast: e.forecast,
          actual: e.actual,
        }));
      }

      case "get_news": {
        const { marketDataService } = await import("./market-data.service");
        const news = await marketDataService.getNews();
        const limit = args?.limit || 10;
        const items = (news || []).slice(0, limit);
        return items.map((n: any) => ({
          headline: n.headline,
          source: n.source,
          timestamp: n.timestamp,
          summary: n.summary || "",
          sentiment: n.sentiment || "",
        }));
      }

      case "get_liquidity": {
        const { marketDataService } = await import("./market-data.service");
        const liq = await marketDataService.getLiquidity();
        return {
          value: liq?.value,
          change: liq?.change,
          displayValue: (liq as any)?.displayValue || "",
          status: liq?.change > 0 ? "Liquidity Drain (menyedot)" : liq?.change < 0 ? "Liquidity Inject (menyuntik)" : "Flat",
        };
      }

      case "get_tga": {
        const { marketDataService } = await import("./market-data.service");
        const tga = await marketDataService.getTGA();
        return {
          value: tga?.value,
          delta: tga?.delta,
          displayValue: tga?.displayValue || "",
          status: tga?.delta > 0 ? "TGA Naik (drain)" : tga?.delta < 0 ? "TGA Turun (inject)" : "Flat",
        };
      }

      case "get_geo_risk": {
        const { geoRiskService } = await import("./geo-risk.service");
        const snapshot = await geoRiskService.getScores();
        return {
          overall: (snapshot as any)?.overall || "N/A",
          topDriver: (snapshot as any)?.topDriver || "N/A",
          eventForecast: (snapshot as any)?.eventForecast?.headline || "N/A",
          scores: snapshot?.scores || {},
        };
      }

      default:
        throw new Error(`Internal tool '${name}' not implemented`);
    }
  } catch (error: any) {
    silentLogger.error(`[InternalTools] Tool ${name} error: ${error.message}`);
    return { error: error.message };
  }
}
