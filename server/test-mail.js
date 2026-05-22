import "dotenv/config";
import emailQueue from "./src/queues/emailQueue.js";

async function run() {
  console.log("Adding job to emailQueue...");
  try {
    const job = await emailQueue.add("send_password_reset", {
      to: "test@example.com",
      resetUrl: "http://localhost:5173/reset"
    });
    console.log("Job added with ID:", job.id);
  } catch (err) {
    console.error("Failed to add job:", err);
  }
  process.exit(0);
}

run();
