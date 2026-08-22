import type { CSSProperties } from "react";
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

export interface CountryNameFlagProps {
  countryName: string;
}

function normalizeCountryName(countryName: string): string {
  return countryName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase();
}

export function findCountryCode(countryName: string): string | undefined {
  const normalizedCountryName = normalizeCountryName(countryName);

  if (!normalizedCountryName) {
    return undefined;
  }

  if (/^[a-z]{2}$/i.test(normalizedCountryName)) {
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
        🌐
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
