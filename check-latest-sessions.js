import { Firestore } from "@google-cloud/firestore";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();
if (fs.existsSync(".env")) {
  try {
    const envConfig = dotenv.parse(fs.readFileSync(".env"));
    for (const k in envConfig) {
      process.env[k] = envConfig[k];
    }
  } catch (e) {
    console.warn("Failed to manually parse .env", e);
  }
}

const firestore = new Firestore({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || "plaud-own",
});

async function run() {
  const snap = await firestore.collection("sessions").orderBy("createdAt", "desc").limit(3).get();
  console.log(`\n=== LATEST SESSIONS ===`);
  snap.forEach(doc => {
    const data = doc.data();
    console.log(`ID: ${doc.id}`);
    console.log(`Title: ${data.title}`);
    console.log(`Status: ${data.status}`);
    console.log(`Created At: ${data.createdAt}`);
    console.log(`Error: ${data.error || "None"}`);
    console.log(`======================`);
  });
}
run().catch(console.error);
