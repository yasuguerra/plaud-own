import { exec } from "child_process";

const cmd = 'gcloud logging read "resource.type=\\"cloud_run_revision\\" AND resource.labels.service_name=\\"plaud-corporate-app\\" AND textPayload:\\"sess_mq79kruv\\"" --limit=500 --project=plaud-own --format=json';

exec(cmd, (err, stdout, stderr) => {
  try {
    const logs = JSON.parse(stdout);
    for (const log of logs.reverse()) {
      if (log.textPayload && (log.textPayload.includes("FINAL") || log.textPayload.includes("COMPLETED") || log.textPayload.includes("FAILED"))) {
        console.log(`[${log.timestamp}] ${log.textPayload.trim()}`);
      }
    }
  } catch (e) {}
});
