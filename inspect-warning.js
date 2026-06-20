import { exec } from "child_process";

const cmd = 'gcloud logging read "resource.type=\\"cloud_run_revision\\" AND resource.labels.service_name=\\"plaud-corporate-app\\" AND timestamp >= \\"2026-06-10T00:19:07Z\\"" --limit=50 --project=plaud-own --format=json';

console.log("Running command:", cmd);
exec(cmd, (err, stdout, stderr) => {
  if (err) {
    console.error("Error executing command:", err);
    return;
  }
  try {
    const logs = JSON.parse(stdout);
    for (const log of logs) {
      if (log.severity === "WARNING" || log.severity === "ERROR") {
        console.log("WARNING/ERROR LOG:", JSON.stringify(log, null, 2));
        break; // just show one to see what it is
      }
    }
  } catch (e) {
    console.error("Failed to parse logs JSON:", e);
  }
});
