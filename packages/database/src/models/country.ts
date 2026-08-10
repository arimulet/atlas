import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

const countrySchema = new Schema(
  {
    countryId: { type: Number, required: true },
    name: { type: String, required: true, trim: true },
    currencyName: { type: String, required: true, trim: true },
    currencyRate: { type: Number, required: true }
  },
  { timestamps: true }
);

countrySchema.index(
  { countryId: 1 },
  { unique: true }
);

type CountryDocument = InferSchemaType<typeof countrySchema>;

export const CountryModel =
  (mongoose.models.Country as Model<CountryDocument> | undefined) ??
  model<CountryDocument>("Country", countrySchema);
