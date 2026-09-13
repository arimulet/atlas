import type { CSSProperties } from "react";
import { Globe } from "lucide-react";
import ReactCountryFlag from "react-country-flag";
import * as countries from "i18n-iso-countries";
import { COUNTRY_LOCALES } from "./country-locales";

const COUNTRY_LANGUAGES = COUNTRY_LOCALES.map((locale) => locale.locale);

const FLAG_STYLE: CSSProperties = {
  width: "1.5em",
  height: "1.5em",
  borderRadius: "6px",
  objectFit: "cover"
};

COUNTRY_LOCALES.forEach((locale) => countries.registerLocale(locale));

const SOKKER_COUNTRY_OVERRIDES: Readonly<Record<string, string>> = {
  // Albania (Shqipëria is the official native name in Sokker, i18n-iso-countries only contains Shqipëri)
  shqiperia: "AL",
  shqiperi: "AL",

  // United Kingdom constituent nations
  england: "GB-ENG",
  scotland: "GB-SCT",
  cymru: "GB-WLS",
  wales: "GB-WLS",
  "northern ireland": "GB-NIR",

  // Sokker native endonyms and regional spellings
  "al maghrib": "MA",
  "al-jaza'ir": "DZ",
  "al-jazair": "DZ",
  "as-sa'udiyya": "SA",
  "as-saudiyya": "SA",
  "daehan minguk": "KR",
  hayastan: "AM",
  letzebuerg: "LU",
  nippon: "JP",
  "o'zbekiston": "UZ",
  ozbekiston: "UZ",
  pilipinas: "PH",
  "prathet thai": "TH",
  sakartvelo: "GE",
  "u.a.e.": "AE",
  uae: "AE",
  zhongguo: "CN"
};

export interface CountryNameFlagProps {
  countryName: string;
}

function normalizeCountryName(countryName: string): string {
  return countryName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘ʻ`]/g, "'")
    .trim()
    .toLocaleLowerCase();
}

export function findCountryCode(countryName: string): string | undefined {
  const normalizedCountryName = normalizeCountryName(countryName);

  if (!normalizedCountryName) {
    return undefined;
  }

  const override = SOKKER_COUNTRY_OVERRIDES[normalizedCountryName];
  if (override) {
    return override;
  }

  if (
    /^[a-z]{2}$/i.test(normalizedCountryName) ||
    /^[a-z]{2}-[a-z]{3}$/i.test(normalizedCountryName)
  ) {
    return normalizedCountryName.toUpperCase();
  }

  for (const language of COUNTRY_LANGUAGES) {
    const countryNames = countries.getNames(language, { select: "all" });

    for (const [countryCode, names] of Object.entries(countryNames)) {
      if (names.some((name) => normalizeCountryName(name) === normalizedCountryName)) {
        return countryCode;
      }
    }
  }

  return undefined;
}

export function CountryNameFlag({ countryName }: CountryNameFlagProps) {
  const countryCode = findCountryCode(countryName);

  if (!countryCode) {
    return (
      <span aria-label={`Bandera no disponible para ${countryName}`} title={countryName}>
        <Globe size={16} className="inline-block align-middle" />
      </span>
    );
  }

  return (
    <ReactCountryFlag
      svg
      countryCode={countryCode}
      style={FLAG_STYLE}
      alt={`Bandera de ${countryName}`}
      title={countryName}
    />
  );
}
