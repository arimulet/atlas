import { XMLParser } from "fast-xml-parser";

export interface JuniorXmlEntry {
  id: number;
  formation: number | null; // 0 = GK, 1 = Field player
}

/**
 * Parses the XML from https://sokker.org/xml/juniors.xml
 * and returns an array of junior IDs with their formation (position type).
 */
export function parseJuniorsXml(xmlData: string): JuniorXmlEntry[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    parseTagValue: true
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsed: any = parser.parse(xmlData);

  const results: JuniorXmlEntry[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function findJuniors(obj: any): void {
    if (!obj || typeof obj !== "object") return;

    if (Array.isArray(obj)) {
      obj.forEach(findJuniors);
      return;
    }

    const rawId = obj.id ?? obj.ID ?? obj.Id ?? obj.playerID ?? obj.playerId ?? obj.playerid;
    const rawFormation = obj.formation ?? obj.Formation ?? obj.FORMATION;

    if (rawId !== undefined && rawFormation !== undefined) {
      const id = Number(rawId);
      const formation = Number(rawFormation);

      if (!isNaN(id) && id > 0 && !isNaN(formation)) {
        results.push({ id, formation });
        return;
      }
    }

    for (const key of Object.keys(obj)) {
      findJuniors(obj[key]);
    }
  }

  findJuniors(parsed);

  if (results.length === 0) {
    console.warn("No juniors found in XML. XML was:");
    console.warn(xmlData);
  }

  return results;
}
