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
          <p>Temporada 78 Semana 7 2026 2026</p>
          <table>
            <thead>
              <tr>
                <th title="Jugador"></th>
                <th title="Edad"></th>
                <th title="Salario"></th>
                <th title="Valor estimado"></th>
                <th title="Forma"></th>
                <th title="Estado"></th>
                <th title="Habilidades"></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><a href="/es/app/player/38643161">Ryan Ahlburg</a></td>
                <td>34</td>
                <td>33 450 $</td>
                <td>1 550 000 $</td>
                <td>6</td>
                <td title="Estado:"></td>
                <td title="Condicion: solido Rapidez: excelente Tecnica: muy bueno Pases: bueno Porteria: tragico Defensa: excelente Creacion: solido Anotacion: bueno"></td>
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
      wage: { amount: 33450, currency: "ARS" },
      estimatedValue: { amount: 1550000, currency: "ARS" },
      availabilityStatus: "available",
      observedPosition: null,
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
    expect(result.snapshot.snapshot).toMatchObject({ season: 78, week: 7 });
    expect(result.warnings).toEqual([]);
  });

  it("maps Sokker player-box cards with numeric skill-list values", () => {
    const document = createDocument(`
      <html lang="es">
        <head><title>Equipo - Sokker Manager</title></head>
        <body>
          <div class="player-box__center">
            <div class="player-box-head" data-player-id="999">
              <div class="player-face" id="face2-38643161" data-pid="999"></div>
            </div>
            <div class="player-box__content">
              <div class="player-box__header">
                <div class="player-box-header">
                  <div class="player-box-header__name">
                    <span class="headline"><a href="/player/PID/38643161">Ryan Ahlburg</a></span>
                  </div>
                  <div class="player-box-header__age"><span>Edad:</span><span>34</span></div>
                  <div class="player-box-header__value"><span>Valor:</span><span>1&nbsp;549&nbsp;000&nbsp;u$s</span></div>
                  <div class="player-box-header__salary"><span>Sueldo:</span><span>33&nbsp;450&nbsp;u$s</span></div>
                  <div class="player-box-header__status"><span>Estado: </span></div>
                </div>
              </div>
              <div class="player-box__skills">
                <ul class="skill-list">
                  ${skillItem("condicion", 11)}
                  ${skillItem("rapidez", 14)}
                  ${skillItem("tecnica", 16)}
                  ${skillItem("pases", 16)}
                  ${skillItem("porteria", 0)}
                  ${skillItem("defensa", 10)}
                  ${skillItem("creacion", 16)}
                  ${skillItem("anotacion", 6)}
                  ${skillItem("forma", 6)}
                </ul>
              </div>
            </div>
          </div>
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
      age: 34,
      wage: { amount: 33450, currency: "USD" },
      estimatedValue: { amount: 1549000, currency: "USD" },
      form: 6,
      availabilityStatus: "available",
      observedPosition: null,
      skills: {
        stamina: 11,
        pace: 14,
        technique: 16,
        passing: 16,
        keeper: 0,
        defender: 10,
        playmaker: 16,
        striker: 6
      }
    });
    expect(result.warnings).toEqual([]);
  });

  it("defaults missing Sokker status to available and keeps externalId from the player link", () => {
    const document = createDocument(`
      <html lang="es">
        <body>
          <div class="player-box__center" data-player-id="999">
            <div class="player-box__content">
              <div class="player-box__header">
                <div class="player-box-header">
                  <div class="player-box-header__name"><a href="/es/app/player/12345">Linked Player</a></div>
                  <div class="player-box-header__age"><span>Edad:</span><span>20</span></div>
                  <div class="player-box-header__value"><span>Valor:</span><span>100&nbsp;000&nbsp;u$s</span></div>
                  <div class="player-box-header__salary"><span>Sueldo:</span><span>1&nbsp;000&nbsp;u$s</span></div>
                </div>
              </div>
              <div class="player-box__skills">
                <ul class="skill-list">
                  ${skillItem("condicion", 8)}
                  ${skillItem("rapidez", 8)}
                  ${skillItem("tecnica", 8)}
                  ${skillItem("pases", 8)}
                  ${skillItem("porteria", 0)}
                  ${skillItem("defensa", 8)}
                  ${skillItem("creacion", 8)}
                  ${skillItem("anotacion", 8)}
                </ul>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);

    const result = extractPlayerSnapshot(document, { exportedAt });

    expect(result.snapshot.players[0]).toMatchObject({
      externalId: "12345",
      availabilityStatus: "available"
    });
  });

  it("does not duplicate nested Sokker player-box matches", () => {
    const document = createDocument(`
      <html lang="es">
        <body>
          <div class="player-box__center">
            <div class="player-box">
              <div class="player-box__content">
                <div class="player-box__header">
                  <div class="player-box-header">
                    <div class="player-box-header__name"><a href="/player/PID/38643161">Ryan Ahlburg</a></div>
                    <div class="player-box-header__age"><span>Edad:</span><span>34</span></div>
                    <div class="player-box-header__value"><span>Valor:</span><span>1&nbsp;549&nbsp;000&nbsp;u$s</span></div>
                    <div class="player-box-header__salary"><span>Sueldo:</span><span>33&nbsp;450&nbsp;u$s</span></div>
                  </div>
                </div>
                <div class="player-box__skills">
                  <ul class="skill-list">
                    ${skillItem("condicion", 11)}
                    ${skillItem("rapidez", 14)}
                    ${skillItem("tecnica", 16)}
                    ${skillItem("pases", 16)}
                    ${skillItem("porteria", 0)}
                    ${skillItem("defensa", 10)}
                    ${skillItem("creacion", 16)}
                    ${skillItem("anotacion", 6)}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);

    const result = extractPlayerSnapshot(document, { exportedAt });

    expect(result.snapshot.players).toHaveLength(1);
    expect(result.snapshot.players[0]?.externalId).toBe("38643161");
  });

  it("does not duplicate separate Sokker player-box renders for the same externalId", () => {
    const document = createDocument(`
      <html lang="es">
        <body>
          ${playerBox("38643161", "Ryan Ahlburg")}
          ${playerBox("38643161", "Ryan Ahlburg")}
        </body>
      </html>
    `);

    const result = extractPlayerSnapshot(document, { exportedAt });

    expect(result.snapshot.players).toHaveLength(1);
    expect(result.snapshot.players[0]?.externalId).toBe("38643161");
  });

  it("produces JSON accepted by the ATLAS contract validator", () => {
    const validation = validatePlayerSnapshotV0(extensionFixture);

    expect(validation.status).toBe("accepted");
  });
});

function createDocument(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

function skillItem(label: string, value: number): string {
  return `
    <li class="skill-list__item">
      <div class="skill-list-item"><span class="text-overflow">${label}</span></div>
      <div class="skill-list__value"><span>${value}</span></div>
    </li>
  `;
}

function playerBox(externalId: string, name: string): string {
  return `
    <div class="player-box__center">
      <div class="player-box__content">
        <div class="player-box__header">
          <div class="player-box-header">
            <div class="player-box-header__name"><a href="/player/PID/${externalId}">${name}</a></div>
            <div class="player-box-header__age"><span>Edad:</span><span>34</span></div>
            <div class="player-box-header__value"><span>Valor:</span><span>1&nbsp;549&nbsp;000&nbsp;u$s</span></div>
            <div class="player-box-header__salary"><span>Sueldo:</span><span>33&nbsp;450&nbsp;u$s</span></div>
          </div>
        </div>
        <div class="player-box__skills">
          <ul class="skill-list">
            ${skillItem("condicion", 11)}
            ${skillItem("rapidez", 14)}
            ${skillItem("tecnica", 16)}
            ${skillItem("pases", 16)}
            ${skillItem("porteria", 0)}
            ${skillItem("defensa", 10)}
            ${skillItem("creacion", 16)}
            ${skillItem("anotacion", 6)}
          </ul>
        </div>
      </div>
    </div>
  `;
}
