import assert from "node:assert/strict";
import { test } from "node:test";

import { allowedAdvisory, isAllowedVulnerability } from "./audit-policy.js";

test("allows only the specified advisory and findings caused solely by it", () => {
  const vulnerabilities = {
    picomatch: { via: [{ name: "picomatch", url: allowedAdvisory }] },
    moderate: { via: [{ name: "moderate", url: "https://example.com", severity: "moderate" }] },
    parent: { via: ["picomatch", "moderate"] }
  };

  assert.equal(isAllowedVulnerability("picomatch", vulnerabilities), true);
  assert.equal(isAllowedVulnerability("parent", vulnerabilities), true);
});

test("rejects independent, mixed, missing and cyclic causes", () => {
  const vulnerabilities = {
    picomatch: { via: [{ name: "picomatch", url: allowedAdvisory }] },
    other: { via: [{ name: "other", url: "https://example.com/advisory", severity: "high" }] },
    mixed: { via: ["picomatch", "other"] },
    missing: { via: ["unknown"] },
    cycle: { via: ["cycle"] }
  };

  for (const name of ["other", "mixed", "missing", "cycle"]) {
    assert.equal(isAllowedVulnerability(name, vulnerabilities), false);
  }
});
