import { describe, it, expect } from "vitest";
import { DEFAULT_SOKKER_STADIUM } from "../mockData";
import { STAND_LOCATION_INFO, STAND_TYPE_LABELS } from "../types";

describe("Stadium Domain & Default Sokker Data", () => {
  it("loads the Monumental stadium with correct aggregate metrics", () => {
    expect(DEFAULT_SOKKER_STADIUM.name).toBe("Monumental");
    expect(DEFAULT_SOKKER_STADIUM.stands).toHaveLength(8);

    const totalSeats = DEFAULT_SOKKER_STADIUM.stands.reduce((acc, s) => acc + s.size, 0);
    expect(totalSeats).toBe(64000);
    expect(DEFAULT_SOKKER_STADIUM.seats).toBe(64000);
  });

  it("has 4 side stands and 4 corner stands with expected capacities", () => {
    const sideStands = DEFAULT_SOKKER_STADIUM.stands.filter((s) => s.location >= 1 && s.location <= 4);
    const cornerStands = DEFAULT_SOKKER_STADIUM.stands.filter((s) => s.location >= 5 && s.location <= 8);

    expect(sideStands).toHaveLength(4);
    expect(cornerStands).toHaveLength(4);

    sideStands.forEach((s) => {
      expect(s.size).toBe(10000);
      expect(s.roof).toBe(true);
      expect(STAND_LOCATION_INFO[s.location].isCorner).toBe(false);
    });

    cornerStands.forEach((s) => {
      expect(s.size).toBe(6000);
      expect(s.roof).toBe(true);
      expect(STAND_LOCATION_INFO[s.location].isCorner).toBe(true);
    });
  });

  it("contains pitch dimensions from team 6038", () => {
    expect(DEFAULT_SOKKER_STADIUM.pitch.length).toBe(95);
    expect(DEFAULT_SOKKER_STADIUM.pitch.width).toBe(72);
    expect(DEFAULT_SOKKER_STADIUM.pitch.condition).toBe(95);
    expect(DEFAULT_SOKKER_STADIUM.pitch.mow).toBe(4);
    expect(DEFAULT_SOKKER_STADIUM.weather).toBe(37);
  });

  it("maps all 8 locations and stand types correctly", () => {
    for (let loc = 1; loc <= 8; loc++) {
      expect(STAND_LOCATION_INFO[loc as keyof typeof STAND_LOCATION_INFO]).toBeDefined();
      expect(STAND_LOCATION_INFO[loc as keyof typeof STAND_LOCATION_INFO].code).toBeTruthy();
    }

    expect(STAND_TYPE_LABELS[1]).toContain("Populares");
    expect(STAND_TYPE_LABELS[2]).toContain("Gradas");
    expect(STAND_TYPE_LABELS[3]).toContain("Butacas");
  });

  it("updates stand properties and recalculates total capacity dynamically", () => {
    const stands = DEFAULT_SOKKER_STADIUM.stands.map((s) => ({ ...s }));
    const targetStand = stands.find((s) => s.location === 1);
    expect(targetStand).toBeDefined();

    // Modify North stand: add 2000 seats, change to Terraces, remove roof
    if (targetStand) {
      targetStand.size += 2000;
      targetStand.type = 1;
      targetStand.roof = false;
    }

    const updatedTotal = stands.reduce((acc, s) => acc + s.size, 0);
    expect(updatedTotal).toBe(66000);
    expect(targetStand?.size).toBe(12000);
    expect(targetStand?.type).toBe(1);
    expect(targetStand?.roof).toBe(false);
  });
});
