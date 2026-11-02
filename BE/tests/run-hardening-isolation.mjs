import { spawn, spawnSync, execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  realpathSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createServer } from "node:net";
import { randomBytes } from "node:crypto";
import mongoose from "mongoose";

// Own disposable infrastructure only. Never use DATABASE_URL/MONGO_URI from the host.
const name = "scms-hardening-" + randomBytes(6).toString("hex");
const schema = name.replaceAll("-", "_");
const folder = mkdtempSync(join(tmpdir(), "scms-hardening-"));
const password = randomBytes(16).toString("hex");
const mongod =
  process.env.SCMS_TEST_MONGOD ||
  "C:/Program Files/MongoDB/Server/8.3/bin/mongod.exe";
let mongoProcess;
let containerStarted = false;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function run(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      env,
      stdio: "inherit",
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Command failed (${code}): ${args[0]}`)),
    );
  });
}
try {
  if (!existsSync(mongod))
    throw new Error("Set SCMS_TEST_MONGOD to the local mongod executable.");
  execFileSync(
    "docker",
    [
      "run",
      "--rm",
      "-d",
      "--name",
      name,
      "--label",
      "scms.test=hardening",
      "-e",
      `POSTGRES_PASSWORD=${password}`,
      "-p",
      "127.0.0.1::5432",
      "postgres:16",
    ],
    { stdio: "pipe" },
  );
  containerStarted = true;
  const port = execFileSync("docker", ["port", name, "5432/tcp"], {
    encoding: "utf8",
  })
    .trim()
    .split(":")
    .at(-1);
  for (let i = 0; i < 60; i++) {
    if (
      spawnSync("docker", ["exec", name, "pg_isready", "-U", "postgres"], {
        stdio: "ignore",
        windowsHide: true,
      }).status === 0
    )
      break;
    if (i === 59) throw new Error("PostgreSQL startup timed out");
    await delay(1000);
  }
  const probe = createServer();
  await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const mongoPort = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  mongoProcess = spawn(
    mongod,
    [
      "--dbpath",
      folder,
      "--port",
      String(mongoPort),
      "--bind_ip",
      "127.0.0.1",
      "--replSet",
      "scms0",
      "--wiredTigerCacheSizeGB",
      "0.25",
      "--logpath",
      join(folder, "mongo.log"),
      "--quiet",
    ],
    { windowsHide: true, stdio: "ignore" },
  );
  const bootstrap = `mongodb://127.0.0.1:${mongoPort}/admin?directConnection=true`;
  for (let i = 0; i < 60; i++) {
    try {
      await mongoose.connect(bootstrap, { serverSelectionTimeoutMS: 1000 });
      break;
    } catch {
      if (i === 59) throw new Error("MongoDB startup timed out");
      await delay(500);
    }
  }
  await mongoose.connection.db
    .admin()
    .command({
      replSetInitiate: {
        _id: "scms0",
        members: [{ _id: 0, host: `127.0.0.1:${mongoPort}` }],
      },
    });
  for (let i = 0; i < 60; i++) {
    if (
      (await mongoose.connection.db.admin().command({ hello: 1 }))
        .isWritablePrimary
    )
      break;
    if (i === 59) throw new Error("MongoDB primary election timed out");
    await delay(500);
  }
  await mongoose.disconnect();
  const url = `postgresql://postgres:${password}@127.0.0.1:${port}/postgres?schema=${schema}&connection_limit=12`;
  const env = {
    ...process.env,
    DATABASE_URL: url,
    DIRECT_DATABASE_URL: url,
    MONGO_URI: `mongodb://127.0.0.1:${mongoPort}/${schema}?directConnection=true&replicaSet=scms0`,
    JWT_ACCESS_SECRET: "isolated-hardening-access",
    JWT_REFRESH_SECRET: "isolated-hardening-refresh",
    NODE_ENV: "test",
    SCMS_QUERY_METRICS: "1",
    CANCELLATION_CUTOFF_MINUTES: "60",
  };
  const baseline = join(folder, "baseline.prisma");
  const source = readFileSync("prisma/schema.prisma", "utf8").replace(
    /^  refund(RequestedAmount|RequestedAt|Reason|Reference).*\r?\n/gm,
    "",
  );
  writeFileSync(baseline, source);
  await run(
    [
      "node_modules/prisma/build/index.js",
      "db",
      "push",
      "--skip-generate",
      "--schema",
      baseline,
    ],
    env,
  );
  const migration =
    `SET search_path TO "${schema}";\n` +
    readFileSync(
      "prisma/migrations/20261029000000_business_rule_hardening/migration.sql",
      "utf8",
    );
  const applied = spawnSync(
    "docker",
    ["exec", "-i", name, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1"],
    { input: migration, encoding: "utf8", windowsHide: true },
  );
  if (applied.status !== 0)
    throw new Error("Hardening migration failed: " + applied.stderr);
  console.log(
    "PASS migration applied to disposable PostgreSQL schema; Mongo replica set ready.",
  );
  await run(
    [
      "node_modules/tsx/dist/cli.mjs",
      "--test",
      "tests/business-rule-hardening.integration.ts",
    ],
    env,
  );
  await run(
    ["node_modules/tsx/dist/cli.mjs", "src/scripts/business-rule-preflight.ts"],
    env,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
  if (mongoProcess) {
    const stopped = new Promise((resolve) =>
      mongoProcess.once("exit", resolve),
    );
    if (mongoProcess.exitCode === null) {
      mongoProcess.kill();
      await stopped;
    }
  }
  if (containerStarted) {
    const label = execFileSync(
      "docker",
      ["inspect", "--format", '{{index .Config.Labels "scms.test"}}', name],
      { encoding: "utf8" },
    ).trim();
    if (label === "hardening" && /^scms-hardening-[a-f0-9]{12}$/.test(name))
      execFileSync("docker", ["rm", "-f", name], { stdio: "ignore" });
  }
  const checked = realpathSync(folder);
  if (!checked.startsWith(resolve(tmpdir()) + sep + "scms-hardening-"))
    throw new Error("Unsafe cleanup path");
  rmSync(checked, { recursive: true, force: true });
  console.log("Removed disposable hardening infrastructure.");
}
