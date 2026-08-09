import { z } from "zod";

export const sokkerNumber = z.preprocess((val) => {
  if (typeof val === "string") {
    return Number(val.replace(/\s/g, ""));
  }
  return Number(val);
}, z.number());
