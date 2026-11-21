import type { StadiumData } from "./types";

export const DEFAULT_SOKKER_STADIUM: StadiumData = {
  name: "Monumental",
  seats: 64000,
  seatsInProgress: 0,
  weather: 37,
  pitch: {
    length: 95,
    width: 72,
    mow: 4,
    condition: 95,
    grassType: 5,
    maintenance: 0,
    logo: {
      size: 100,
      x: 0,
      y: 0
    }
  },
  stands: [
    {
      location: 1,
      type: 3,
      size: 10000,
      roof: true,
      ticketPrice: { currency: "u$s", value: 9 },
      inConstruction: false,
      constructionDays: 0
    },
    {
      location: 2,
      type: 3,
      size: 10000,
      roof: true,
      ticketPrice: { currency: "u$s", value: 9 },
      inConstruction: false,
      constructionDays: 0
    },
    {
      location: 3,
      type: 3,
      size: 10000,
      roof: true,
      ticketPrice: { currency: "u$s", value: 8 },
      inConstruction: false,
      constructionDays: 0
    },
    {
      location: 4,
      type: 3,
      size: 10000,
      roof: true,
      ticketPrice: { currency: "u$s", value: 8 },
      inConstruction: false,
      constructionDays: 0
    },
    {
      location: 5,
      type: 3,
      size: 6000,
      roof: true,
      ticketPrice: { currency: "u$s", value: 8 },
      inConstruction: false,
      constructionDays: 0
    },
    {
      location: 6,
      type: 3,
      size: 6000,
      roof: true,
      ticketPrice: { currency: "u$s", value: 8 },
      inConstruction: false,
      constructionDays: 0
    },
    {
      location: 7,
      type: 3,
      size: 6000,
      roof: true,
      ticketPrice: { currency: "u$s", value: 8 },
      inConstruction: false,
      constructionDays: 0
    },
    {
      location: 8,
      type: 3,
      size: 6000,
      roof: true,
      ticketPrice: { currency: "u$s", value: 8 },
      inConstruction: false,
      constructionDays: 0
    }
  ]
};
