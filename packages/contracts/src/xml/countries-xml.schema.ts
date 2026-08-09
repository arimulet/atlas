import { z } from "zod";
import { sokkerNumber } from "./utils.js";

export const sokkerCountryXmlSchema = z.object({
  country: z.object({
    countryID: sokkerNumber,
    name: z.string(),
    currencyName: z.string(),
    currencyRate: sokkerNumber
  }).passthrough()
});

export const sokkerCountriesXmlSchema = z.object({
  countries: z.object({
    country: z.array(sokkerCountryXmlSchema.shape.country).or(sokkerCountryXmlSchema.shape.country)
  }).passthrough()
});

export type SokkerCountryXml = z.infer<typeof sokkerCountryXmlSchema>;
export type SokkerCountriesXml = z.infer<typeof sokkerCountriesXmlSchema>;
