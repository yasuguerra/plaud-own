import { exec } from "child_process";

const filter = 'resource.type="cloud_run_revision" AND resource.labels.service_name="plaud-corporate-app" AND timestamp >= "2026-06-10T00:19:07Z"';
const cmd = `gcloud logging read "${filter}" --limit=150 --project=plaud-own --format=json`;

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
      if (log.severity === "ERROR" || log.severity === "WARNING" || (log.textPayload && (log.textPayload.includes("ERROR") || log.textPayload.includes("PIPELINE") || log.textPayload.includes("FAILED")))) {
        console.log(`[${log.timestamp}] [${log.severity}] ${log.textPayload ? log.textPayload.trim() : JSON.stringify(log.jsonPayload)}`);
      }
    }
  } catch (e) {
    console.error("Failed to parse logs JSON:", e);
  }
});
