// TEMP (xóa sau khi chạy): khởi tạo single-node replica set rs0 trên 27018 cho Mongo test.
const { MongoClient } = require("mongodb");
(async () => {
  const c = new MongoClient("mongodb://127.0.0.1:27018/?directConnection=true&serverSelectionTimeoutMS=5000");
  await c.connect();
  const st = await c.db("admin").command({ replSetGetStatus: 1 }).catch(() => null);
  if (st) console.log("REPLSET ready set=" + st.set + " myState=" + st.myState);
  else {
    const r = await c.db("admin").command({
      replSetInitiate: { _id: "rs0", members: [{ _id: 0, host: "127.0.0.1:27018" }] },
    });
    console.log("INITIATED ok=" + r.ok);
  }
  await c.close();
})().catch((e) => { console.error("ERR " + e.message); process.exit(1); });
