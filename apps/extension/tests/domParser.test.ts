// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import extensionFixture from "../../../packages/test-fixtures/fixtures/player-snapshot/extension-sokker-dom-export.json" with {
  type: "json"
};
import { validatePlayerSnapshotV0 } from "@atlas/contracts";
import { extractPlayerSnapshot } from "../src/domParser";

const exportedAt = new Date("2026-08-05T20:30:00.000Z");

describe("Sokker DOM export parser", () => {
  it("maps a visible squad table to atlas.player-snapshot.v0", () => {
    const document = createDocument(`
      <html lang="es-AR">
        <head><title>River Plate Forever | Sokker</title></head>
        <body>
          <h1 class="club-name">River Plate Forever</h1>
          <p>Temporada 78 Semana 4</p>
          <table>
            <thead>
              <tr>
                <th>Jugador</th>
                <th>Edad</th>
                <th>Salario</th>
                <th>Valor estimado</th>
                <th>Forma</th>
                <th>Posicion</th>
                <th>Estado</th>
                <th>Condicion</th>
                <th>Rapidez</th>
                <th>Tecnica</th>
                <th>Pases</th>
                <th>Porteria</th>
                <th>Defensa</th>
                <th>Creacion</th>
                <th>Anotacion</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><a href="/player/PID/101">Tomas Alvarez</a></td>
                <td>22</td>
                <td>ARS 12.000</td>
                <td>ARS 450.000</td>
                <td>10</td>
                <td>midfielder</td>
                <td>Disponible</td>
                <td>8</td>
                <td>10</td>
                <td>9</td>
                <td>8</td>
                <td>1</td>
                <td>5</td>
                <td>9</td>
                <td>4</td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `);

    const result = extractPlayerSnapshot(document, {
      exportedAt,
      pageUrl: "https://sokker.org/team/100/players",
      locale: "es-AR"
    });

    expect(result.snapshot).toEqual(extensionFixture);
    expect(result.warnings).toEqual([]);
  });

  it("maps explicit player cards and leaves unread skills nullable", () => {
    const document = createDocument(`
      <html lang="en">
        <body>
          <h1 data-atlas-club-name>North Stand FC</h1>
          <article data-atlas-player data-atlas-external-id="202" data-atlas-name="Mark Bell"
            data-atlas-age="19" data-atlas-wage="EUR 4,500" data-atlas-value="EUR 220,000"
            data-atlas-position="striker" data-atlas-form="7">
            <span data-atlas-skill="pace">very good</span>
            <span data-atlas-skill="striker">excellent</span>
          </article>
        </body>
      </html>
    `);

    const result = extractPlayerSnapshot(document, { exportedAt });

    expect(result.snapshot.players[0]).toMatchObject({
      externalId: "202",
      name: "Mark Bell",
      age: 19,
      wage: { amount: 4500, currency: "EUR" },
      estimatedValue: { amount: 220000, currency: "EUR" },
      observedPosition: "striker",
      skills: expect.objectContaining({
        pace: 9,
        striker: 10,
        technique: null
      })
    });
    expect(result.warnings.map((warning) => warning.path)).toContain("players.0.skills.technique");
  });

  it("reads accessible table labels and compact money units from Sokker-like rows", () => {
    const document = createDocument(`
      <html lang="es">
        <head><title>Equipo - Sokker Manager</title></head>
        <body>
          <table>
            <thead>
              <tr>
                <th title="Jugador"></th>
                <th title="Edad"></th>
                <th title="Salario"></th>
                <th title="Valor estimado"></th>
                <th title="Forma"></th>
                <th title="Condicion"></th>
                <th title="Rapidez"></th>
                <th title="Tecnica"></th>
                <th title="Pases"></th>
                <th title="Porteria"></th>
                <th title="Defensa"></th>
                <th title="Creacion"></th>
                <th title="Anotacion"></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><a href="/es/app/player/38643161">Ryan Ahlburg</a></td>
                <td>34</td>
                <td>33.45k</td>
                <td>1.55M</td>
                <td>6</td>
                <td title="Condicion: solido"></td>
                <td title="Rapidez: excelente"></td>
                <td title="Tecnica: muy bueno"></td>
                <td title="Pases: bueno"></td>
                <td title="Porteria: tragico"></td>
                <td title="Defensa: excelente"></td>
                <td title="Creacion: solido"></td>
                <td title="Anotacion: bueno"></td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `);

    const result = extractPlayerSnapshot(document, {
      exportedAt,
      pageUrl: "https://sokker.org/es/app/squad/",
      locale: "es"
    });

    expect(result.snapshot.players[0]).toMatchObject({
      externalId: "38643161",
      name: "Ryan Ahlburg",
      wage: { amount: 33450 },
      estimatedValue: { amount: 1550000 },
      skills: {
        stamina: 8,
        pace: 10,
        technique: 9,
        passing: 7,
        keeper: 0,
        defender: 10,
        playmaker: 8,
        striker: 7
      }
    });
    expect(result.warnings).toEqual([]);
  });

  it("produces JSON accepted by the ATLAS contract validator", () => {
    const validation = validatePlayerSnapshotV0(extensionFixture);

    expect(validation.status).toBe("accepted");
  });
});

function createDocument(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}
