import { z } from "zod";

import { playerSnapshotV0Schema } from "./schemas";


export type PlayerSnapshotV0 = z.infer<typeof playerSnapshotV0Schema>;

export interface ImportIssue {
  path: string;
  message: string;
}

export type PlayerSnapshotValidationResult =
  | {
      status: "accepted";
      data: PlayerSnapshotV0;
      errors: [];
      warnings: [];
    }
  | {
      status: "accepted-with-warnings";
      data: PlayerSnapshotV0;
      errors: [];
      warnings: ImportIssue[];
    }
  | {
      status: "rejected";
      data: null;
      errors: ImportIssue[];
      warnings: [];
    };
