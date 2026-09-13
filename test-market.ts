import { calibratePlayerMarketValue } from './src/domain/playerMarketValue/calibration.js';

try {
  const result = calibratePlayerMarketValue({
    player: {
      playerId: 40312124,
      age: 18.01,
      skills: {}
    },
    developmentProfile: null,
    talent: null
  }, []);
  console.log("Success:", result);
} catch (e) {
  console.error("Error:", e);
}
