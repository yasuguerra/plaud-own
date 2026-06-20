import { exec } from "child_process";

const filter = 'resource.type="cloud_run_revision" AND resource.labels.service_name="plaud-corporate-app" AND textPayload:"sess_mq7blp0x"';
const cmd = `gcloud logging read "${filter}" --limit=100 --project=plaud-own --format=json`;

console.log("Running command:", cmd);
exec(cmd, (err, stdout, stderr) => {
  if (err) {
    console.error("Error executing command:", err);
    return;
  }
  try {
    const logs = JSON.parse(stdout);
    console.log(`Found ${logs.length} log entries.`);
    for (const log of logs.reverse()) {
      if (log.textPayload) {
        console.log(`[${log.timestamp}] ${log.textPayload.trim()}`);
      }
    }
  } catch (e) {
    console.error("Failed to parse logs JSON:", e);
  }
});
