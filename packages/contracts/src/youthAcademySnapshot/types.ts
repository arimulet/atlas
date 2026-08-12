import { z } from "zod";
import { youthAcademySnapshotV0Schema, youthPlayerStatusSchema } from "./schemas.js";
import type { ImportIssue } from "../playerSnapshot/types.js";

export type YouthAcademySnapshotV0 = z.infer<typeof youthAcademySnapshotV0Schema>;
export type YouthPlayerStatusV0 = z.infer<typeof youthPlayerStatusSchema>;

export type YouthAcademySnapshotValidationResult =
  | {
      status: "accepted";
      data: YouthAcademySnapshotV0;
      errors: [];
      warnings: [];
    }
  | {
      status: "accepted-with-warnings";
      data: YouthAcademySnapshotV0;
      errors: [];
      warnings: ImportIssue[];
    }
  | {
      status: "rejected";
      data: null;
      errors: ImportIssue[];
      warnings: ImportIssue[];
    };
