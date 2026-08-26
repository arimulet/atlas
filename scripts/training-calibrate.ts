import "dotenv/config";

import { getWeeklyTrainingCalibration } from "@atlas/application";
import { connectMongoDb, disconnectMongoDb } from "@atlas/database";

const mongoUri = process.env.MONGODB_URI;
const clubId = process.env.ATLAS_CALIBRATION_CLUB_ID;
const gameWeekValue = process.env.ATLAS_CALIBRATION_GAME_WEEK;

if (!mongoUri || !clubId) {
  console.error(
    "Training calibration requires MONGODB_URI and ATLAS_CALIBRATION_CLUB_ID. " +
      "The club id is intentionally supplied by the environment so no real club id is hardcoded."
  );
  process.exitCode = 1;
} else {
  try {
    await connectMongoDb(mongoUri);
    const report = await getWeeklyTrainingCalibration(
      clubId,
      gameWeekValue ? Number(gameWeekValue) : undefined
    );

    console.log(`TRAINING CALIBRATION — WEEK ${report.gameWeek}`);
    console.log(`Players analyzed: ${report.players.length}`);
    console.log(`Known skill-ups tested: ${report.skillUpBacktest.samples}`);
    console.log("");
    console.log("Skill-up prediction:");
    console.log(`MAE: ${formatWeeks(report.skillUpBacktest.meanAbsoluteErrorWeeks)}`);
    console.log(
      `Within 1 week: ${formatCount(report.skillUpBacktest.withinOneWeek, report.skillUpBacktest.samples)}`
    );
    console.log("");
    console.log("Recommendations:");
    console.log(`Continue: ${report.recommendations.continue}`);
    console.log(`Switch: ${report.recommendations.switchSkill}`);
    console.log(`Hold: ${report.recommendations.hold}`);
    console.log(`Flapping detected: ${report.recommendations.flappingDetected}`);
    console.log("");
    console.log("Warnings:");
    if (report.warnings.length === 0) {
      console.log("None");
    } else {
      for (const warning of report.warnings) {
        console.log(`${warning.count} ${warning.warning} (${warning.playerIds.join(", ")})`);
      }
    }
    console.log("");
    console.log("Advanced cutoff:");
    for (const entry of report.advancedTraining.cutoff) {
      console.log(
        `#${entry.rank} ${entry.playerId} ${entry.score === null ? "—" : entry.score.toFixed(3)}`
      );
    }
    if (report.advancedTraining.cutoff.length === 0) {
      console.log("No ranking entries around the cutoff.");
    }
  } finally {
    await disconnectMongoDb();
  }
}

function formatWeeks(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(2)} weeks`;
}

function formatCount(count: number, total: number): string {
  return total === 0 ? "—" : `${count}/${total} (${Math.round((count / total) * 100)}%)`;
}
