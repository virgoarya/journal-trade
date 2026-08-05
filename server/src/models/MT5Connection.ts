import mongoose, { Schema, Document } from "mongoose";
import crypto from "node:crypto";
import { env } from "../config/env";

const ENCRYPTION_KEY = ((env as any).ENCRYPTION_KEY || "hunter-trades-default-secret-32ch").padEnd(32, "x").substring(0, 32); // Ensure exactly 32 bytes
const IV_LENGTH = 16;

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(text: string): string {
  const textParts = text.split(":");
  const ivHex = textParts.shift();
  if (!ivHex) return "";
  const iv = Buffer.from(ivHex, "hex");
  const encryptedText = Buffer.from(textParts.join(":"), "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

export interface IMT5Connection extends Document {
  userId: string;
  server?: string;
  login?: number;
  passwordEncrypted?: string;
  apiKeyEncrypted?: string;
  mcpUrl?: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  getPassword(): string;
  setPassword(password: string): void;
  getApiKey(): string;
  setApiKey(key: string): void;
}

const MT5ConnectionSchema = new Schema<IMT5Connection>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    server: { type: String, required: false },
    login: { type: Number, required: false },
    passwordEncrypted: { type: String, required: false },
    apiKeyEncrypted: { type: String, required: false },
    mcpUrl: { type: String, required: false, default: "http://127.0.0.1:22346/mcp" },
    enabled: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    collection: "mt5_connections",
  }
);

MT5ConnectionSchema.methods.getPassword = function(): string {
  if (!this.passwordEncrypted) return "";
  try {
    return decrypt(this.passwordEncrypted);
  } catch {
    return "";
  }
};

MT5ConnectionSchema.methods.setPassword = function(password: string): void {
  if (password) {
    this.passwordEncrypted = encrypt(password);
  }
};

MT5ConnectionSchema.methods.getApiKey = function(): string {
  if (!this.apiKeyEncrypted) return "";
  try {
    return decrypt(this.apiKeyEncrypted);
  } catch {
    return "";
  }
};

MT5ConnectionSchema.methods.setApiKey = function(key: string): void {
  if (key) {
    this.apiKeyEncrypted = encrypt(key);
  }
};

export const MT5Connection =
  mongoose.models.MT5Connection ||
  mongoose.model<IMT5Connection>("MT5Connection", MT5ConnectionSchema);
