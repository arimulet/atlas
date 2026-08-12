import { z } from "zod";

export const sokkerNumber = z.preprocess((val) => {
  if (typeof val === "string") {
    return Number(val.replace(/\s/g, ""));
  }
  return Number(val);
}, z.number());

export const sokkerBoolean = z.preprocess((val) => {
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val !== 0;
  if (typeof val === "string") {
    const normalized = val.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return val;
}, z.boolean());
