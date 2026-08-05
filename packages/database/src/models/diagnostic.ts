import { Schema, model, models } from "mongoose";

const assumptionSchema = new Schema(
  {
    code: { type: String, required: true },
    description: { type: String, required: true },
    traceKind: { type: String, enum: ["assumed"], required: true }
  },
  { _id: false }
);

const findingSchema = new Schema(
  {
    code: { type: String, required: true },
    title: { type: String, required: true },
    severity: { type: String, enum: ["info", "low", "medium", "high"], required: true },
    evidence: [{ type: String }],
    assumptions: [assumptionSchema]
  },
  { _id: true }
);

const diagnosticSchema = new Schema(
  {
    snapshotId: { type: Schema.Types.ObjectId, ref: "Snapshot", required: true, index: true },
    generatedAt: { type: Date, required: true, default: () => new Date() },
    findings: [findingSchema]
  },
  { timestamps: true }
);

export const DiagnosticModel = models.Diagnostic ?? model("Diagnostic", diagnosticSchema);
