import "dotenv/config";
import emailQueue from "./src/queues/emailQueue.js";

async function run() {
  const failed = await emailQueue.getFailed();
  const active = await emailQueue.getActive();
  const waiting = await emailQueue.getWaiting();
  const delayed = await emailQueue.getDelayed();

  console.log("Failed:", failed.length);
  if (failed.length > 0) {
    console.log("First failed error:", failed[0].failedReason);
    console.log("First failed stack:", failed[0].stacktrace);
  }
  
  console.log("Active:", active.length);
  console.log("Waiting:", waiting.length);
  console.log("Delayed:", delayed.length);
  
  process.exit(0);
}
run();
