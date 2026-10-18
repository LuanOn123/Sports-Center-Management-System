import "dotenv/config";
import { prisma } from "../src/config/prisma.js";
import { connectMongo } from "../src/config/mongoose.js";
import { User } from "../src/models/User.js";

async function run() {
  await connectMongo();
  console.log("=== USERS IN MONGO ===");
  const mongoUsers = await User.find({ role: "ADMIN" }).lean();
  console.log("Admin Mongo users:", mongoUsers.map(u => ({ id: u._id, email: u.email, role: u.role, fullName: u.fullName })));

  console.log("=== FACILITIES ===");
  const facilities = await prisma.facility.findMany();
  console.log("Facilities:", facilities.map(f => ({ id: f.id, name: f.name, code: f.code })));

  console.log("=== TERMS IN PRISMA ===");
  const terms = await prisma.term.findMany();
  console.log("Terms count:", terms.length);
  console.log("Terms:", terms);

  process.exit(0);
}

run().catch(console.error);
