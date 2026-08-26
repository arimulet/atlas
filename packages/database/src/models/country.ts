import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";
import { ensureMongooseModels } from "./mongoose-model-registry.js";

ensureMongooseModels();

const countrySchema = new Schema(
  {
    countryId: { type: Number, required: true },
    name: { type: String, required: true, trim: true },
    currencyName: { type: String, required: true, trim: true },
    currencyRate: { type: Number, required: true }
  },
  {
    timestamps: true,
    // Sokker sync does not persist countries. Create this collection only when it is used.
    autoCreate: false,
    autoIndex: false
  }
);

countrySchema.index({ countryId: 1 }, { unique: true });

type CountryDocument = InferSchemaType<typeof countrySchema>;

export const CountryModel =
  (mongoose.models?.Country as Model<CountryDocument> | undefined) ??
  model<CountryDocument>("Country", countrySchema);
