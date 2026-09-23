import { describe, expect, it, vi } from "vitest";
import { PlayerStatusBadges, PlayerLink } from "../index";

vi.mock("@/context/PlayerCountryContext", () => ({
  registerPlayerCountry: vi.fn(),
  usePlayerCountry: vi.fn().mockReturnValue(null)
}));

describe("PlayerStatusBadges", () => {
  it("returns null when there are no cards and no injury and alwaysReserveSpace is false", () => {
    expect(PlayerStatusBadges({})).toBeNull();
    expect(PlayerStatusBadges({ cards: { yellow: 0, red: 0 }, injury: { days: 0, severe: false } })).toBeNull();
    expect(PlayerStatusBadges({ cards: { yellow: 0, red: 0 }, injury: { days: null, severe: null } })).toBeNull();
    expect(PlayerStatusBadges({ cards: null, injury: null })).toBeNull();
  });

  it("reserves empty aligned slots when alwaysReserveSpace is true", () => {
    const element = PlayerStatusBadges({ alwaysReserveSpace: true });
    expect(element).not.toBeNull();
    expect(element!.props.className).toContain("atlas-player-status-badges");
    expect(element!.props.className).toContain("is-empty");

    const [injurySlot, cardsSlot] = element!.props.children;
    expect(injurySlot.props.className).toBe("atlas-player-status-slot is-injury");
    expect(injurySlot.props.children).toBeNull();
    expect(cardsSlot.props.className).toBe("atlas-player-status-slot is-cards");
    expect(cardsSlot.props.children[0]).toBeNull();
    expect(cardsSlot.props.children[1]).toBeNull();
  });

  it("renders yellow card badge in cards slot", () => {
    const element = PlayerStatusBadges({ cards: { yellow: 1, red: 0 } });
    expect(element).not.toBeNull();
    expect(element!.props.className).toBe("atlas-player-status-badges");

    const [injurySlot, cardsSlot] = element!.props.children;
    expect(injurySlot.props.children).toBeNull();

    const [cardGroup, redBadge] = cardsSlot.props.children;
    expect(redBadge).toBeFalsy();
    expect(cardGroup.props.className).toBe("atlas-card-group");
    expect(cardGroup.props.title).toBe("1 tarjeta amarilla");
    expect(cardGroup.props["aria-label"]).toBe("1 tarjeta amarilla");
    expect(cardGroup.props.children).toHaveLength(1);
    expect(cardGroup.props.children[0].props.className).toContain("is-yellow");
  });

  it("renders multiple yellow cards capped at 3 in cards slot", () => {
    const element = PlayerStatusBadges({ cards: { yellow: 2, red: 0 } });
    const [, cardsSlot] = element!.props.children;
    const [cardGroup] = cardsSlot.props.children;
    expect(cardGroup.props.title).toBe("2 tarjetas amarillas");
    expect(cardGroup.props.children).toHaveLength(2);

    const capped = PlayerStatusBadges({ cards: { yellow: 5, red: 0 } });
    const [, cappedCardsSlot] = capped!.props.children;
    const [cappedGroup] = cappedCardsSlot.props.children;
    expect(cappedGroup.props.children).toHaveLength(3);
  });

  it("renders red card badge in cards slot", () => {
    const element = PlayerStatusBadges({ cards: { yellow: 0, red: 1 } });
    expect(element).not.toBeNull();

    const [injurySlot, cardsSlot] = element!.props.children;
    expect(injurySlot.props.children).toBeNull();

    const [cardGroup, redBadge] = cardsSlot.props.children;
    expect(cardGroup).toBeFalsy();
    expect(redBadge.props.className).toBe("atlas-card-badge is-red");
    expect(redBadge.props.title).toBe("Tarjeta roja (Suspendido)");
  });

  it("renders severe injury badge in injury slot with Red Cross symbol and remaining days tooltip", () => {
    const element = PlayerStatusBadges({ injury: { days: 7, severe: true } });
    expect(element).not.toBeNull();

    const [injurySlot, cardsSlot] = element!.props.children;
    expect(cardsSlot.props.children[0]).toBeFalsy();
    expect(cardsSlot.props.children[1]).toBeFalsy();

    const injuryBadge = injurySlot.props.children;
    expect(injuryBadge.props.className).toBe("atlas-injury-badge is-severe");
    expect(injuryBadge.props.title).toBe("Lesionado (grave): 7 días restantes");
    expect(injuryBadge.props["aria-label"]).toBe("Lesionado grave: 7 días restantes");
    expect(injuryBadge.props.children).toBe("✚");
  });

  it("renders non-severe/bruised injury badge in injury slot with bandage emoji and remaining days tooltip", () => {
    const element = PlayerStatusBadges({ injury: { days: 2, severe: false } });
    expect(element).not.toBeNull();

    const [injurySlot, cardsSlot] = element!.props.children;
    expect(cardsSlot.props.children[0]).toBeFalsy();
    expect(cardsSlot.props.children[1]).toBeFalsy();

    const injuryBadge = injurySlot.props.children;
    expect(injuryBadge.props.className).toBe("atlas-injury-badge is-bruised");
    expect(injuryBadge.props.title).toBe("Lastimado (con venda): 2 días restantes");
    expect(injuryBadge.props["aria-label"]).toBe("Lastimado con venda: 2 días restantes");
    expect(injuryBadge.props.children).toBe("🩹");
  });

  it("renders both cards and injury in their respective aligned slots", () => {
    const element = PlayerStatusBadges({
      cards: { yellow: 1, red: 0 },
      injury: { days: 4, severe: true }
    });
    expect(element).not.toBeNull();

    const [injurySlot, cardsSlot] = element!.props.children;
    expect(injurySlot.props.className).toBe("atlas-player-status-slot is-injury");
    expect(cardsSlot.props.className).toBe("atlas-player-status-slot is-cards");

    const injuryBadge = injurySlot.props.children;
    expect(injuryBadge.props.className).toBe("atlas-injury-badge is-severe");

    const [cardGroup] = cardsSlot.props.children;
    expect(cardGroup.props.className).toBe("atlas-card-group");
  });
});

describe("PlayerLink", () => {
  it("renders PlayerStatusBadges and CountryNameFlag in dedicated aligned slots before player name", () => {
    const element = PlayerLink({
      playerId: "12345",
      countryName: "Argentina",
      children: "Lionel Messi",
      cards: { yellow: 1, red: 0 },
      injury: { days: 3, severe: false },
      onSelectPlayer: () => {}
    });

    expect(element.props.className).toBe("atlas-player-link-group");
    const [linkElement] = element.props.children;
    const [statusBadges, flagSlot, nameSpan] = linkElement.props.children;

    // 1. Status Badges component with alwaysReserveSpace enabled when status props are passed
    expect(statusBadges.type).toBe(PlayerStatusBadges);
    expect(statusBadges.props.cards).toEqual({ yellow: 1, red: 0 });
    expect(statusBadges.props.injury).toEqual({ days: 3, severe: false });
    expect(statusBadges.props.alwaysReserveSpace).toBe(true);

    // 2. Aligned Country flag slot
    expect(flagSlot.props.className).toBe("atlas-player-flag-slot");
    const flagElement = flagSlot.props.children;
    expect(flagElement.props.countryName).toBe("Argentina");

    // 3. Player name element
    expect(nameSpan.props.className).toBe("atlas-player-link__name");
    expect(nameSpan.props.children).toBe("Lionel Messi");
  });

  it("reserves empty status space for players without cards or injury when status props are provided", () => {
    const element = PlayerLink({
      playerId: "67890",
      countryName: "Deutschland",
      children: "Thomas Müller",
      cards: { yellow: 0, red: 0 },
      injury: { days: null, severe: null },
      onSelectPlayer: () => {}
    });

    const [linkElement] = element.props.children;
    const [statusBadges, flagSlot] = linkElement.props.children;

    expect(statusBadges.props.alwaysReserveSpace).toBe(true);
    expect(flagSlot.props.className).toBe("atlas-player-flag-slot");
  });
});
