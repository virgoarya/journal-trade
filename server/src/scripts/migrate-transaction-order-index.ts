import "dotenv/config";
import mongoose from "mongoose";

const INDEX_NAME = "order_id_1";
const COLLECTION = "transactions";

function requireAtlasUri(): string {
  const uri = process.env.DATABASE_URL;
  if (!uri) throw new Error("DATABASE_URL is required");
  if (!uri.startsWith("mongodb+srv://") && process.env.ALLOW_LOCAL_MONGO !== "1") {
    throw new Error(
      "Refusing non-Atlas DATABASE_URL. Set ALLOW_LOCAL_MONGO=1 only for explicit local verification."
    );
  }
  return uri;
}

async function main(): Promise<void> {
  const uri = requireAtlasUri();
  const databaseName = process.env.DATABASE_NAME || "journal_trade_dev";
  await mongoose.connect(uri, { dbName: databaseName, autoIndex: false });

  try {
    const collection = mongoose.connection.db!.collection(COLLECTION);
    const existing = await collection.indexes();
    const orderIndexes = existing.filter((index) => index.name === INDEX_NAME);

    if (orderIndexes.length > 0) {
      const current = orderIndexes[0];
      const expectedPartial = { order_id: { $exists: true, $type: "string" } };
      const matches =
        current.unique === true &&
        JSON.stringify(current.partialFilterExpression) === JSON.stringify(expectedPartial);
      if (!matches) {
        throw new Error(`Existing ${INDEX_NAME} has an incompatible definition; manual review required`);
      }
      console.log(JSON.stringify({ action: "already-present", index: current }, null, 2));
      return;
    }

    const duplicateGroups = await collection
      .aggregate([
        { $match: { order_id: { $exists: true, $type: "string" } } },
        { $group: { _id: "$order_id", count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
        { $limit: 10 },
      ])
      .toArray();
    if (duplicateGroups.length > 0) {
      throw new Error(
        `Duplicate order_id values exist; refusing migration: ${JSON.stringify(duplicateGroups)}`
      );
    }

    const name = await collection.createIndex(
      { order_id: 1 },
      {
        name: INDEX_NAME,
        unique: true,
        partialFilterExpression: { order_id: { $exists: true, $type: "string" } },
      }
    );
    const indexes = await collection.indexes();
    const created = indexes.find((index) => index.name === name);
    if (!created || created.unique !== true) {
      throw new Error("Index creation could not be verified");
    }
    console.log(JSON.stringify({ action: "created", index: created }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
