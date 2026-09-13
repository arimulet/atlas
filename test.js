const fs = require('fs');
let code = fs.readFileSync('D:/1-Projects/ATLAS/atlas/src/domain/sokker/calendar.ts', 'utf8');

code = code.replace(/export function addSokkerWeeks[\s\S]*?return newYears \+ \(newWeeks \/ 100\);\n\}/, export function addSokkerWeeks(ageYYWW: number, weeksToAdd: number): number {
  if (weeksToAdd === 0) return ageYYWW;
  const years = Math.floor(ageYYWW);
  const baseWeeks = Math.round((ageYYWW - years) * 100);
  const totalWeeksSinceBirth = years * 13 + baseWeeks;
  const newTotal = totalWeeksSinceBirth + weeksToAdd;
  
  let newYears = Math.floor(newTotal / 13);
  let newWeeks = newTotal % 13;
  
  if (Math.abs(newWeeks) < 1e-9 && newYears > 0) {
    newYears -= 1;
    newWeeks = 13;
  }
  
  return newYears + newWeeks / 100;
});

fs.writeFileSync('D:/1-Projects/ATLAS/atlas/src/domain/sokker/calendar.ts', code);
