import speech from "@google-cloud/speech";
import dotenv from "dotenv";

dotenv.config();

const client = new speech.SpeechClient({
  projectId: "plaud-own"
});

async function run() {
  const name = "4226915138674289759";
  console.log(`Checking operation status for: ${name}...`);
  try {
    const [operation] = await client.checkLongRunningRecognizeProgress(name);
    console.log("Is completed:", operation.done);
    if (operation.done) {
      console.log("Operation result:", JSON.stringify(operation.response, null, 2).slice(0, 1000));
    } else {
      console.log("Operation is still running. Progress:", operation.metadata ? operation.metadata.progressPercent : "unknown");
    }
  } catch (err) {
    console.error("Failed to check progress:", err.message);
  }
}
run();
