import { Schema, model, models } from "mongoose";

const importIssueSchema = new Schema(
  {
    path: { type: String, required: true },
    message: { type: String, required: true }
  },
  { _id: false }
);

const importEventSchema = new Schema(
  {
    schemaVersion: { type: String, default: null },
    sourceType: { type: String, default: null },
    status: {
      type: String,
      enum: ["accepted", "accepted-with-warnings", "rejected"],
      required: true
    },
    errors: [importIssueSchema],
    warnings: [importIssueSchema],
    importedAt: { type: Date, required: true, default: () => new Date() }
  },
  { timestamps: true }
);

export const ImportEventModel = models.ImportEvent ?? model("ImportEvent", importEventSchema);
