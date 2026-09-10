import { CountryModel } from "../models/country.js";
import type { PersistedCountry, SaveCountryInput } from "./types.js";

export class MongoCountryRepository {
  private static countryCache = new Map<number, PersistedCountry>();

  async getById(countryId: number): Promise<PersistedCountry | null> {
    const cached = MongoCountryRepository.countryCache.get(countryId);
    if (cached) return cached;

    const country = await CountryModel.findOne({ countryId }).lean();
    if (!country) return null;

    const persisted: PersistedCountry = {
      id: country._id.toString(),
      countryId: country.countryId,
      name: country.name,
      currencyName: country.currencyName,
      currencyRate: country.currencyRate
    };
    MongoCountryRepository.countryCache.set(countryId, persisted);
    return persisted;
  }

  private static allCountriesCache: PersistedCountry[] | null = null;

  async getAll(): Promise<PersistedCountry[]> {
    if (MongoCountryRepository.allCountriesCache) {
      return MongoCountryRepository.allCountriesCache;
    }

    const countries = await CountryModel.find({}).lean();
    const mapped = countries.map((country) => ({
      id: country._id.toString(),
      countryId: country.countryId,
      name: country.name,
      currencyName: country.currencyName,
      currencyRate: country.currencyRate
    }));

    MongoCountryRepository.allCountriesCache = mapped;
    for (const c of mapped) {
      MongoCountryRepository.countryCache.set(c.countryId, c);
    }

    return mapped;
  }

  async save(input: SaveCountryInput): Promise<PersistedCountry> {
    MongoCountryRepository.allCountriesCache = null;

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

    const persisted: PersistedCountry = {
      id: updated._id.toString(),
      countryId: updated.countryId,
      name: updated.name,
      currencyName: updated.currencyName,
      currencyRate: updated.currencyRate
    };
    MongoCountryRepository.countryCache.set(updated.countryId, persisted);
    return persisted;
  }
}
