import { describe, expect, it } from "vitest";
import {
  formatAge,
  formatBooleanCheck,
  formatDate,
  formatDateTime,
  formatDiagnosticNumber,
  formatEta,
  formatMoney,
  formatNumber,
  formatPercentage,
  formatSignedWeeks,
  formatTalent,
  formatTrainingPriority,
  formatWeeks
} from "./formatters";

describe("formatters", () => {
  describe("formatMoney", () => {
    it("returns dash for null total", () => {
      expect(formatMoney(null)).toBe("—");
    });

    it("formats with country details converted amount", () => {
      const total = { amount: 1000, currency: "USD", isComplete: true };
      const country = { currencyName: "ARS", currencyRate: 0.5 };
      expect(formatMoney(total, country)).toBe("ARS 2,000");
    });

    it("formats mixed currency when incomplete", () => {
      const total = { amount: 500, currency: null, isComplete: false };
      expect(formatMoney(total)).toBe("mixed 500 (incomplete)");
    });
  });

  describe("formatNumber", () => {
    it("handles null and undefined", () => {
      expect(formatNumber(null)).toBe("—");
      expect(formatNumber(undefined)).toBe("—");
    });

    it("formats valid numbers", () => {
      expect(formatNumber(1234567)).toBe("1,234,567");
    });
  });

  describe("formatPercentage", () => {
    it("handles null and undefined", () => {
      expect(formatPercentage(null)).toBe("—");
      expect(formatPercentage(undefined)).toBe("—");
    });

    it("formats percentage with 1 decimal", () => {
      expect(formatPercentage(45.67)).toBe("45.7%");
    });
  });

  describe("formatTalent", () => {
    it("formats talent or returns dash", () => {
      expect(formatTalent(null)).toBe("—");
      expect(formatTalent(4.5)).toBe("4.5");
    });
  });

  describe("formatAge", () => {
    it("returns dash for null or undefined", () => {
      expect(formatAge(null)).toBe("—");
      expect(formatAge(undefined)).toBe("—");
    });

    it("formats age with tilde", () => {
      expect(formatAge(19.4)).toBe("~19.4");
    });
  });

  describe("formatWeeks and formatEta", () => {
    it("returns dash for null", () => {
      expect(formatWeeks(null)).toBe("—");
      expect(formatEta(null)).toBe("—");
    });

    it("formats <1w for values between 0 and 1", () => {
      expect(formatWeeks(0.4)).toBe("<1w");
    });

    it("formats ~Nw for standard values", () => {
      expect(formatWeeks(2.45)).toBe("~2.5w");
      expect(formatEta(5)).toBe("~5w");
    });
  });

  describe("formatSignedWeeks", () => {
    it("returns dash for null or undefined", () => {
      expect(formatSignedWeeks(null)).toBe("—");
      expect(formatSignedWeeks(undefined)).toBe("—");
    });

    it("formats positive signed weeks", () => {
      expect(formatSignedWeeks(2.3)).toBe("+2.3w");
      expect(formatSignedWeeks(0)).toBe("+0w");
    });

    it("formats negative signed weeks", () => {
      expect(formatSignedWeeks(-1.5)).toBe("-1.5w");
    });
  });

  describe("formatDate and formatDateTime", () => {
    it("handles null and undefined safely", () => {
      expect(formatDate(null)).toBe("—");
      expect(formatDate(undefined)).toBe("—");
      expect(formatDateTime(null)).toBe("—");
      expect(formatDateTime(undefined)).toBe("—");
    });

    it("handles invalid date strings safely", () => {
      expect(formatDate("invalid-date")).toBe("—");
      expect(formatDateTime("invalid-date")).toBe("—");
    });

    it("formats valid dates", () => {
      const date = new Date(2026, 7, 15, 12, 30);
      expect(formatDate(date)).toContain("2026");
      expect(formatDateTime(date)).toContain("2026");
    });
  });

  describe("formatBooleanCheck", () => {
    it("returns checkmark for true and dash for false/null", () => {
      expect(formatBooleanCheck(true)).toBe("✓");
      expect(formatBooleanCheck(false)).toBe("—");
      expect(formatBooleanCheck(null)).toBe("—");
    });
  });

  describe("formatDiagnosticNumber", () => {
    it("formats numbers using es-AR locale", () => {
      expect(formatDiagnosticNumber(1234)).toBe("1.234");
    });

    it("handles null and undefined", () => {
      expect(formatDiagnosticNumber(null)).toBe("dato no disponible");
      expect(formatDiagnosticNumber(undefined)).toBe("dato no disponible");
    });

    it("handles strings and booleans", () => {
      expect(formatDiagnosticNumber("test")).toBe("test");
    });
  });

  describe("formatTrainingPriority", () => {
    it("maps training priority IDs to text labels", () => {
      expect(formatTrainingPriority(1)).toBe("Condicion");
      expect(formatTrainingPriority(6)).toBe("Defensa");
      expect(formatTrainingPriority(99)).toBe("99");
    });
  });
});
