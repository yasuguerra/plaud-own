import { exec } from "child_process";

const cmd = 'gcloud logging read "resource.type=\\"cloud_run_revision\\" AND resource.labels.service_name=\\"plaud-corporate-app\\" AND timestamp >= \\"2026-06-10T00:23:50Z\\" AND timestamp <= \\"2026-06-10T00:24:20Z\\"" --limit=200 --project=plaud-own --format=json';

exec(cmd, (err, stdout, stderr) => {
  try {
    const logs = JSON.parse(stdout);
    for (const log of logs.reverse()) {
      if (log.textPayload) {
        console.log(`[${log.timestamp}] [${log.severity}] ${log.textPayload.trim()}`);
      }
    }
  } catch (e) { }
});
