import { projectPlayerMarketValue } from './src/domain/playerMarketValue/future-market-value.js';

try {
  const res = projectPlayerMarketValue({
    player: { playerId: 40312124, age: 18.10, skills: {} },
    developmentPlan: { target: { playerId: 40312124, targetSkills: {} } } as any,
    path: { playerId: 40312124, steps: [], milestones: [], returnOfInvestment: {} as any },
    projection: { playerId: 40312124, generatedAtGameWeek: 100, generatedAtDate: new Date(), assumptions: { expectedIntensity: 100, trainingKind: 'advanced', assumeContinuousTraining: true }, steps: [ { order: 1, estimatedWeeks: 1, estimatedAge: NaN, cumulativeWeeks: 1, estimatedGameWeek: 101, estimatedDate: new Date(), progress: {}, confidence: 'high' } ], milestones: [], completion: null, completionAvailable: false, generatedAt: new Date() },
    currentMarketValue: { calibratedValue: { expected: 1000 } } as any,
    talent: null,
    transfers: []
  });
  console.log("Success:", res);
} catch (e) { console.error("Error:", e); }
