"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const DATABASE_URL = process.env.DATABASE_URL;
async function clear() {
    try {
        await mongoose_1.default.connect(DATABASE_URL);
        const db = mongoose_1.default.connection;
        console.log("Connected. Clearing AI Backtest Skills...");
        const res1 = await db.collection("ai_backtest_skills").deleteMany({});
        console.log(`Deleted ${res1.deletedCount} ai_backtest_skills.`);
        console.log("Clearing AI Reviews...");
        const res2 = await db.collection("ai_reviews").deleteMany({});
        console.log(`Deleted ${res2.deletedCount} ai_reviews.`);
        await mongoose_1.default.disconnect();
        process.exit(0);
    }
    catch (error) {
        console.error(error);
        process.exit(1);
    }
}
clear();
