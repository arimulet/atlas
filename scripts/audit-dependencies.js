import { spawnSync } from "node:child_process";
import console from "node:console";
import process from "node:process";

import { allowedAdvisory, isAllowedVulnerability } from "./audit-policy.js";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npm, ["audit", "--json", "--audit-level=high"], {
  encoding: "utf8",
  shell: process.platform === "win32"
});

if (result.error || ![0, 1].includes(result.status)) {
  console.error("npm audit could not run:", result.error ?? result.stderr);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  console.error("npm audit did not return valid JSON:", result.stderr);
  process.exit(1);
}

if (report.error || !report.vulnerabilities || !report.metadata?.vulnerabilities) {
  console.error("npm audit returned an incomplete report.");
  process.exit(1);
}

const vulnerabilities = report.vulnerabilities;
const severityLevels = ["info", "low", "moderate", "high", "critical"];
if (
  typeof vulnerabilities !== "object" ||
  Array.isArray(vulnerabilities) ||
  Object.entries(vulnerabilities).some(
    ([name, vulnerability]) =>
      !vulnerability ||
      vulnerability.name !== name ||
      !severityLevels.includes(vulnerability.severity) ||
      !Array.isArray(vulnerability.via)
  )
) {
  console.error("npm audit returned malformed vulnerability entries.");
  process.exit(1);
}
const isAllowed = (name) => isAllowedVulnerability(name, vulnerabilities);

const blocked = Object.values(vulnerabilities).filter(
  (vulnerability) =>
    ["high", "critical"].includes(vulnerability.severity) && !isAllowed(vulnerability.name)
);

if (blocked.length > 0) {
  console.error("High or critical vulnerabilities require attention:");
  for (const vulnerability of blocked) {
    console.error(`- ${vulnerability.name}: ${vulnerability.severity}`);
  }
  process.exit(1);
}

if (Object.values(vulnerabilities).some((vulnerability) => isAllowed(vulnerability.name))) {
  console.warn(`Temporary exception: ${allowedAdvisory} (see docs/picomatch-audit-exception.md)`);
} else {
  console.log("No high or critical vulnerabilities found.");
}
