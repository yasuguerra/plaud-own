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
  const snap = await firestore.collection("sessions").get();
  snap.forEach(doc => {
    const data = doc.data();
    if (data.title && (data.title.includes("Pymes") || data.title.includes("IA para Pymes"))) {
      console.log(`\n=== FOUND SESSION ===`);
      console.log(`ID: ${doc.id}`);
      console.log(`Title: ${data.title}`);
      console.log(`Summary Length: ${data.summary?.length}`);
      console.log(`Transcript Length: ${data.transcript?.length}`);
      console.log(`Transcript Content:\n${data.transcript}`);
      console.log(`Summary Content:\n${data.summary}`);
      console.log(`=====================\n`);
    }
  });
}
run().catch(console.error);
