// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { extractYouthAcademySnapshot } from "../src/domParser";
import { YOUTH_ACADEMY_SNAPSHOT_SCHEMA_VERSION } from "../src/types";

describe("domParser - Youth Academy", () => {
  it("should parse a basic youth academy snapshot from a simulated DOM", () => {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <title>Club Name | Sokker</title>
      </head>
      <body>
        <div class="current-date">2026-08-08</div>
        <div>Weekly investment: EUR 20,000</div>
        
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Age</th>
              <th>Weeks in academy</th>
              <th>Weeks remaining</th>
              <th>Estimated level</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr data-atlas-external-id="123">
              <td><a href="/player/123">John Doe</a></td>
              <td>16</td>
              <td>5</td>
              <td>10</td>
              <td>Solid</td>
              <td>in academy</td>
            </tr>
            <tr>
              <td>Jane Doe</td>
              <td>17</td>
              <td>10</td>
              <td>0</td>
              <td>Excellent</td>
              <td>ready for promotion</td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;
    const document = new DOMParser().parseFromString(html, "text/html");
    
    const result = extractYouthAcademySnapshot(document);
    
    expect(result.snapshot.schemaVersion).toBe(YOUTH_ACADEMY_SNAPSHOT_SCHEMA_VERSION);
    expect(result.snapshot.club.name).toBe("Club Name");
    expect(result.snapshot.snapshot.snapshotDate).toBe("2026-08-08");
    expect(result.snapshot.academy.weeklyInvestment).toEqual({ amount: 20000, currency: "EUR" });
    
    expect(result.snapshot.academy.players).toHaveLength(2);
    
    const p1 = result.snapshot.academy.players[0]!;
    expect(p1.name).toBe("John Doe");
    expect(p1.age).toBe(16);
    expect(p1.weeksInAcademy).toBe(5);
    expect(p1.weeksRemaining).toBe(10);
    expect(p1.estimatedLevel).toBe("Solid");
    expect(p1.status).toBe("in_academy");
    expect(p1.externalId).toBe("123");
    
    const p2 = result.snapshot.academy.players[1]!;
    expect(p2.name).toBe("Jane Doe");
    expect(p2.age).toBe(17);
    expect(p2.weeksInAcademy).toBe(10);
    expect(p2.weeksRemaining).toBe(0);
    expect(p2.estimatedLevel).toBe("Excellent");
    expect(p2.status).toBe("ready_for_promotion");
  });
});
