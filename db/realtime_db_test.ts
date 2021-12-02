//sessionStorage.setItem("firebase:logging_enabled", "true");
//localStorage.setItem("firebase:logging_enabled", "true");

import { FirebaseRealtimeDatabase } from "./realtime_db.ts";

const db = new FirebaseRealtimeDatabase(
  JSON.parse(Deno.env.get("FIREBASE_CONFIG")!),
);

//console.log("result: ", await db.createToken("matsumoto"));
/*console.log(
  "result: ",
  await db.testToken("matsumoto", "df850670-9736-438f-998d-7f8a65302a11"),
);*/

function writeData() {
  const writer = db.getWriter(
    "matsumoto",
    "df850670-9736-438f-998d-7f8a65302a11",
  );

  console.time("aaa");

  const ps: Promise<void>[] = [];
  let i = 0;
  const id = setInterval(() => {
    if (i++ < 10) {
      ps.push(writer!.write({ time: Date.now(), hey: "aaaaaa" }));
    } else {
      clearInterval(id);
      Promise.all(ps).then(() => console.timeEnd("aaa"));
    }
  }, 20); //20ms間隔ならいけそう（20166ms）
  //1534ms
}
/*
writeData();
*/
async function getData() {
  const res = await db.getDataByLimit("matsumoto", {
    fromTime: 1638437108096,
    //limit: 2,
  });
  console.log(res.length, res);
}

async function deleteData() {
  console.log(await db.deleteDataByTime(Date.now()));
}
deleteData();

console.log("fin");
