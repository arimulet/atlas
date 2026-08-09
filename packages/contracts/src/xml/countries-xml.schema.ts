import { z } from "zod";

export const sokkerCountryXmlSchema = z.object({
  country: z.object({
    countryID: z.coerce.number(),
    name: z.string(),
    currencyName: z.string(),
    currencyRate: z.coerce.number()
  }).passthrough()
});

export const sokkerCountriesXmlSchema = z.object({
  countries: z.object({
    country: z.array(sokkerCountryXmlSchema.shape.country).or(sokkerCountryXmlSchema.shape.country)
  }).passthrough()
});

export type SokkerCountryXml = z.infer<typeof sokkerCountryXmlSchema>;
export type SokkerCountriesXml = z.infer<typeof sokkerCountriesXmlSchema>;
