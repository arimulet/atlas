import { CountryModel } from "../models/country.js";
import type { PersistedCountry, SaveCountryInput } from "./types.js";

export class MongoCountryRepository {
  async getById(countryId: number): Promise<PersistedCountry | null> {
    const country = await CountryModel.findOne({ countryId }).lean();
    if (!country) return null;

    return {
      id: country._id.toString(),
      countryId: country.countryId,
      name: country.name,
      currencyName: country.currencyName,
      currencyRate: country.currencyRate
    };
  }

  async getAll(): Promise<PersistedCountry[]> {
    const countries = await CountryModel.find({}).lean();
    return countries.map((country) => ({
      id: country._id.toString(),
      countryId: country.countryId,
      name: country.name,
      currencyName: country.currencyName,
      currencyRate: country.currencyRate
    }));
  }

  async save(input: SaveCountryInput): Promise<PersistedCountry> {
    const updated = await CountryModel.findOneAndUpdate(
      { countryId: input.countryId },
      {
        $set: {
          name: input.name,
          currencyName: input.currencyName,
          currencyRate: input.currencyRate
        }
      },
      { upsert: true, new: true, runValidators: true }
    );

    return {
      id: updated._id.toString(),
      countryId: updated.countryId,
      name: updated.name,
      currencyName: updated.currencyName,
      currencyRate: updated.currencyRate
    };
  }
}
