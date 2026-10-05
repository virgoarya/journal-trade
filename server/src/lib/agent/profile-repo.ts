/**
 * profile-repo.ts — Repository untuk mengambil UserProfile & UserMemoryNote
 *
 * Digunakan oleh hermes-prompt untuk menyuntikkan:
 * - Identitas user (preferredName, displayName, legalName)
 * - Gaya trading & aset favorit
 * - Tolerance risiko & persona agent
 * - Array memoryNotes (fakta jangka panjang)
 */

import { prismaAgent } from "./prisma-agent";

export interface UserProfileBrief {
  userId: string;
  preferredName: string;
  displayName: string;
  legalName: string;
  tradingStyles: string[];
  favoriteAssets: string[];
  riskTolerance: string;
  agentPersona: string;
}

export interface MemoryNoteBrief {
  id: string;
  category: string;
  content: string;
  confidence: number;
}

export interface UserProfileWithNotes {
  profile: UserProfileBrief;
  notes: MemoryNoteBrief[];
}

/**
 * Ambil UserProfile beserta memoryNotes untuk user tertentu.
 * Returns null kalau user belum punya profile.
 */
export async function getUserProfileWithNotes(
  userId: string
): Promise<UserProfileWithNotes | null> {
  const profile = await prismaAgent.userProfile.findUnique({
    where: { userId },
    include: {
      memoryNotes: {
        orderBy: { createdAt: "desc" },
        where: {
          // Hanya mengambil notes dengan confidence >= 0.8
          confidence: { gte: 0.8 },
        },
      },
    },
  });

  if (!profile) return null;

  return {
    profile: {
      userId: profile.userId,
      preferredName: profile.preferredName,
      displayName: profile.displayName,
      legalName: profile.legalName,
      tradingStyles: profile.tradingStyles,
      favoriteAssets: profile.favoriteAssets,
      riskTolerance: profile.riskTolerance,
      agentPersona: profile.agentPersona,
    },
    notes: profile.memoryNotes.map((n) => ({
      id: n.id,
      category: n.category,
      content: n.content,
      confidence: n.confidence,
    })),
  };
}

/**
 * Fallback: ambil UserProfile saja tanpa notes (kalau perlu cepat).
 */
export async function getUserProfileBrief(userId: string): Promise<UserProfileBrief | null> {
  const profile = await prismaAgent.userProfile.findUnique({
    where: { userId },
  });

  if (!profile) return null;

  return {
    userId: profile.userId,
    preferredName: profile.preferredName,
    displayName: profile.displayName,
    legalName: profile.legalName,
    tradingStyles: profile.tradingStyles,
    favoriteAssets: profile.favoriteAssets,
    riskTolerance: profile.riskTolerance,
    agentPersona: profile.agentPersona,
  };
}

/**
 * Resolve profile untuk userId dengan dev fallback.
 *
 * - Kalau profile untuk userId ada → pakai itu.
 * - Kalau TIDAK ada DAN NODE_ENV=development → pakai profile pertama yang tersedia
 *   (single-user dev environment, supaya identitas seed "virga" tetap terpakai
 *   walau auth session pakai ObjectId MongoDB / dev bypass id).
 * - Kalau production → return null (biar caller yang menentukan default).
 */
export async function resolveProfileForUser(
  userId: string
): Promise<UserProfileWithNotes | null> {
  const direct = await getUserProfileWithNotes(userId);
  if (direct) return direct;

  if (process.env.NODE_ENV === "development") {
    const fallback = await prismaAgent.userProfile.findFirst({
      include: {
        memoryNotes: {
          orderBy: { createdAt: "desc" },
          where: { confidence: { gte: 0.8 } },
        },
      },
    });
    if (fallback) {
      return {
        profile: {
          userId: fallback.userId,
          preferredName: fallback.preferredName,
          displayName: fallback.displayName,
          legalName: fallback.legalName,
          tradingStyles: fallback.tradingStyles,
          favoriteAssets: fallback.favoriteAssets,
          riskTolerance: fallback.riskTolerance,
          agentPersona: fallback.agentPersona,
        },
        notes: fallback.memoryNotes.map((n) => ({
          id: n.id,
          category: n.category,
          content: n.content,
          confidence: n.confidence,
        })),
      };
    }
  }

  return null;
}
