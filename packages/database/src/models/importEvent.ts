import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

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
    clubId: { type: Schema.Types.ObjectId, ref: "Club", default: null },
    snapshotId: { type: Schema.Types.ObjectId, ref: "Snapshot", default: null },
    importedAt: { type: Date, required: true, default: () => new Date() }
  },
  { timestamps: true, suppressReservedKeysWarning: true }
);

type ImportEventDocument = InferSchemaType<typeof importEventSchema>;

export const ImportEventModel =
  (mongoose.models.ImportEvent as Model<ImportEventDocument> | undefined) ??
  model<ImportEventDocument>("ImportEvent", importEventSchema);
