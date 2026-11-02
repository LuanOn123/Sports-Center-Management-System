import { spawn, execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const suffix = randomBytes(6).toString("hex");
const pg = `scms-qa-pg-${suffix}`, mongo = `scms-qa-mongo-${suffix}`;
const password = randomBytes(18).toString("hex");
const owned = [];
const docker = (...args) => execFileSync("docker", args, { encoding: "utf8", windowsHide: true }).trim();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function run(args, env) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { env, stdio: "inherit", windowsHide: true });
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolve() : reject(new Error(`${args.join(" ")} failed (${code})`)));
  });
}
try {
  docker("run", "--rm", "-d", "--name", pg, "--label", `scms.qa=${suffix}`,
    "-e", `POSTGRES_PASSWORD=${password}`, "-p", "127.0.0.1::5432", "postgres:16");
  owned.push(pg);
  docker("run", "--rm", "-d", "--name", mongo, "--label", `scms.qa=${suffix}`,
    "-p", "127.0.0.1::27017", "mongo:8", "--replSet", "qa0", "--bind_ip_all");
  owned.push(mongo);
  for (let attempt = 0; ; attempt++) {
    try { docker("exec", pg, "pg_isready", "-U", "postgres"); break; }
    catch { if (attempt > 60) throw new Error("PostgreSQL startup timeout"); await pause(1000); }
  }
  for (let attempt = 0; ; attempt++) {
    try {
      docker("exec", mongo, "mongosh", "--quiet", "--eval",
        'rs.initiate({_id:"qa0",members:[{_id:0,host:"localhost:27017"}]})');
      break;
    } catch { if (attempt > 60) throw new Error("Mongo startup timeout"); await pause(1000); }
  }
  for (let attempt = 0; ; attempt++) {
    if (docker("exec", mongo, "mongosh", "--quiet", "--eval", "db.hello().isWritablePrimary") === "true") break;
    if (attempt > 60) throw new Error("Mongo primary election timeout");
    await pause(1000);
  }
  const pgPort = docker("port", pg, "5432/tcp").split(":").at(-1);
  const mongoPort = docker("port", mongo, "27017/tcp").split(":").at(-1);
  const base = { ...process.env, NODE_ENV: "test", DOTENV_CONFIG_PATH: "tests/nonexistent-qa.env",
    JWT_ACCESS_SECRET: randomBytes(32).toString("hex"), JWT_REFRESH_SECRET: randomBytes(32).toString("hex"),
    SEPAY_MOCK_MODE: "true", CANCELLATION_CUTOFF_MINUTES: "60" };
  const cli = "node_modules/tsx/dist/cli.mjs";
  async function environment(name) {
    const schema = `scms_verify_${suffix}_${name}`;
    const url = `postgresql://postgres:${password}@127.0.0.1:${pgPort}/postgres?schema=${schema}&connection_limit=12`;
    const env = { ...base, DATABASE_URL: url, DIRECT_DATABASE_URL: url,
      MONGO_URI: `mongodb://127.0.0.1:${mongoPort}/${schema}?directConnection=true&replicaSet=qa0` };
    await run(["node_modules/prisma/build/index.js", "migrate", "deploy"], env);
    return env;
  }
  let fullEnvironment;
  for (const [name, seed] of [["basic", "prisma/seed.ts"], ["full", "src/scripts/seed-full.ts"]]) {
    const env = await environment(name);
    if (name === "full") fullEnvironment = env;
    await run([cli, seed], env);
    await run([cli, seed], env);
    console.log(`PASS migrate + ${name} seed + repeat seed on isolated databases`);
  }
  const suites = ["qa-regressions.integration.ts", "cross-facility-booking.integration.ts",
    "cross-facility-cancel.integration.ts", "cross-facility-my-schedule.integration.ts",
    "business-gaps.integration.ts", "membership-reports.integration.ts",
    "subscription-matrix.integration.ts", "final-member-facility.integration.ts"];
  if (process.argv.includes("--legacy-e2e")) suites.push("enrollment-quota.e2e.ts", "attendance-manual-code.e2e.ts",
    "course-enrollment.e2e.ts", "sepay-payment.e2e.ts", "chat-attachments.e2e.ts", "subscription-lifecycle.e2e.ts");
  for (let i = 0; i < suites.length; i++) {
    const env = await environment(`suite${i}`);
    await run([cli, "--test", `tests/${suites[i]}`], env);
  }
  if (process.argv.includes("--live")) await run([cli, "tests/strict-business-flows.live.cjs"], {
    ...fullEnvironment, VIETQR_BANK_ID: "MB", VIETQR_ACCOUNT_NO: "0000000000", VIETQR_ACCOUNT_NAME: "LOCAL AUDIT",
    SEPAY_API_TOKEN: "", MAIL_DRIVER: "console", TRUST_PROXY_HOPS: "0",
  });
  console.log("PASS all QA isolation checks");
} catch (error) {
  console.error(error.message); process.exitCode = 1;
} finally {
  for (const name of owned.reverse()) {
    if (docker("inspect", "--format", '{{index .Config.Labels "scms.qa"}}', name) === suffix)
      docker("rm", "-f", name);
  }
}
