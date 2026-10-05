import "dotenv/config";
import mongoose from "mongoose";
import { configureDns } from "../config/dns.js";
async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
  configureDns();
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const result = await mongoose.connection
      .db!.collection("users")
      .updateMany({ role: "STAFF" }, { $set: { role: "RECEPTIONIST" } });
    await mongoose.connection
      .db!.collection("users")
      .updateMany({ phone: null }, { $unset: { phone: "" } });
    console.log(`Migrated ${result.modifiedCount} legacy staff accounts.`);
  } finally {
    await mongoose.disconnect();
  }
}
main().catch(() => {
  console.error("Role migration failed; check MongoDB connectivity.");
  process.exitCode = 1;
});
