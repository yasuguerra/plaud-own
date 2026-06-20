import { exec } from "child_process";

const cmd = 'gcloud logging read "resource.type=\\"cloud_run_revision\\" AND resource.labels.service_name=\\"plaud-corporate-app\\" AND timestamp >= \\"2026-06-10T00:23:00Z\\"" --limit=200 --project=plaud-own --format=json';

console.log("Running command:", cmd);
exec(cmd, (err, stdout, stderr) => {
  if (err) {
    console.error("Error executing command:", err);
    return;
  }
  try {
    const logs = JSON.parse(stdout);
    for (const log of logs.reverse()) {
      if (log.severity === "ERROR" || (log.textPayload && log.textPayload.includes("PIPELINE"))) {
        console.log(`[${log.timestamp}] [${log.severity}] ${log.textPayload || JSON.stringify(log.jsonPayload)}`);
      }
    }
  } catch (e) {
    console.error("Failed to parse logs JSON:", e);
  }
});
