import { z } from "zod";

const descriptorSchema = z.object({ code: z.number(), name: z.string() });
const moneySchema = z.object({ value: z.number(), currency: z.string() });
const injurySchema = z.object({ daysRemaining: z.number(), severe: z.boolean() });
const skillsSchema = z.object({
  form: z.number(),
  tacticalDiscipline: z.number(),
  teamwork: z.number(),
  experience: z.number(),
  stamina: z.number(),
  keeper: z.number(),
  playmaking: z.number(),
  passing: z.number(),
  technique: z.number(),
  defending: z.number(),
  striker: z.number(),
  pace: z.number()
});

export const trainingPlayerSchema = z.object({
  id: z.number().int().positive(),
  player: z.object({
    name: z.object({ name: z.string(), surname: z.string(), full: z.string() }),
    formation: descriptorSchema.nullable(),
    number: z.number().nullable(),
    team: z.object({ id: z.number().int().positive() }),
    country: z.object({ code: z.number(), name: z.string() }),
    value: moneySchema,
    previousValue: moneySchema.nullable(),
    wage: moneySchema,
    characteristics: z.object({
      age: z.number(),
      height: z.number(),
      weight: z.number(),
      bmi: z.number()
    }),
    skills: skillsSchema,
    stats: z
      .object({
        cards: z.object({ yellow: z.number().optional(), red: z.number().optional() }).optional()
      })
      .nullish()
      .transform((stats) => stats ?? {}),
    nationalStats: z.unknown(),
    face: z.unknown(),
    youthTeamId: z.number(),
    injury: injurySchema,
    nationalSharing: z.boolean(),
    nationalCallUp: z.boolean(),
    nationalType: z.string()
  }),
  report: z.object({
    week: z.number().int().positive(),
    day: z.object({
      season: z.number(),
      week: z.number(),
      seasonWeek: z.number(),
      day: z.number(),
      date: z.object({ value: z.string(), timestamp: z.number() })
    }),
    skills: skillsSchema,
    skillsChange: skillsSchema.extend({ up: z.number(), down: z.number() }),
    type: descriptorSchema,
    kind: descriptorSchema,
    playerValue: moneySchema,
    games: z.object({
      minutesOfficial: z.number(),
      minutesFriendly: z.number(),
      minutesNational: z.number()
    }),
    intensity: z.number(),
    formation: descriptorSchema.nullable(),
    injury: injurySchema,
    age: z.number()
  })
});
