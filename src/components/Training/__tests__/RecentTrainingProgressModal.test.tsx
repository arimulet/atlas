import { describe, expect, it, vi } from "vitest";
import type { TrainingPageData, TrainingReport } from "@atlas/web/app/types";
import { RecentTrainingProgressModal } from "../RecentTrainingProgressModal";
import { PlayerLink } from "@/components/PlayerLink";

describe("RecentTrainingProgressModal", () => {
  const mockPlayers: TrainingPageData["players"] = [
    {
      playerId: "101",
      name: "Marcelo Cicint",
      countryName: "Argentina",
      age: 21,
      skills: {
        stamina: 8,
        pace: 10,
        technique: 7,
        passing: 6,
        keeper: 1,
        defending: 5,
        playmaking: 9,
        scoring: 4
      }
    } as unknown as TrainingPageData["players"][number],
    {
      playerId: "102",
      name: "John Doe",
      countryName: "England",
      age: 19,
      skills: {
        stamina: 7,
        pace: 9,
        technique: 6,
        passing: 5,
        keeper: 1,
        defending: 4,
        playmaking: 6,
        scoring: 8
      }
    } as unknown as TrainingPageData["players"][number]
  ];

  const mockHistory: TrainingReport[] = [
    {
      id: "rep-1",
      playerId: 101,
      date: "2026-05-01",
      gameWeek: 105,
      season: 25,
      seasonWeek: 5,
      age: 21,
      type: "striker",
      kind: "advanced",
      intensity: 100,
      skills: {} as unknown as TrainingReport["skills"],
      skillsChange: {},
      skillChanges: [
        { skill: "striker", before: 7, after: 8, delta: 1, direction: "up" },
        { skill: "technique", before: 6, after: 7, delta: 1, direction: "up" }
      ]
    },
    {
      id: "rep-2",
      playerId: 102,
      date: "2026-05-01",
      gameWeek: 105,
      season: 25,
      seasonWeek: 5,
      age: 19,
      type: "pace",
      kind: "advanced",
      intensity: 100,
      skills: {} as unknown as TrainingReport["skills"],
      skillsChange: {},
      skillChanges: [
        { skill: "pace", before: 8, after: 9, delta: 1, direction: "up" },
        { skill: "stamina", before: 8, after: 7, delta: -1, direction: "down" }
      ]
    },
    {
      id: "rep-old",
      playerId: 101,
      date: "2026-04-24",
      gameWeek: 104,
      season: 25,
      seasonWeek: 4,
      age: 21,
      type: "striker",
      kind: "advanced",
      intensity: 100,
      skills: {} as unknown as TrainingReport["skills"],
      skillsChange: {},
      skillChanges: [{ skill: "passing", before: 5, after: 6, delta: 1, direction: "up" }]
    }
  ];

  it("returns null when isOpen is false", () => {
    const element = RecentTrainingProgressModal({
      history: mockHistory,
      isOpen: false,
      onClose: vi.fn(),
      players: mockPlayers
    });

    expect(element).toBeNull();
  });

  it("renders empty state message when there are no reports or no changes in the latest week", () => {
    const element = RecentTrainingProgressModal({
      history: [],
      isOpen: true,
      onClose: vi.fn(),
      players: mockPlayers
    });

    expect(element).not.toBeNull();
    const section = element!.props.children;
    const [, content] = section.props.children;
    expect(content.props.children).toBe("No skill changes detected in the latest week.");
  });

  it("groups multiple skill changes into a single row per player for the latest week only", () => {
    const onClose = vi.fn();
    const onSelectPlayer = vi.fn();

    const element = RecentTrainingProgressModal({
      history: mockHistory,
      isOpen: true,
      onClose,
      players: mockPlayers,
      onSelectPlayer
    });

    expect(element).not.toBeNull();
    const section = element!.props.children;
    const [, list] = section.props.children;
    const items = list.props.children;

    // Should only have 2 player rows (latest week 105), week 104 is ignored
    expect(items).toHaveLength(2);

    // Player 101 row
    const rowPlayer1 = items.find((li: { key: string }) => li.key === "101");
    expect(rowPlayer1).toBeDefined();

    const [playerDiv1, changesSpan1] = rowPlayer1.props.children;

    // Player link and age
    const [playerLink1, ageSpan1] = playerDiv1.props.children;
    expect(playerLink1.type).toBe(PlayerLink);
    expect(playerLink1.props.countryName).toBe("Argentina");
    expect(playerLink1.props.playerId).toBe("101");
    expect(playerLink1.props.children).toBe("Marcelo Cicint");
    expect(ageSpan1.props.children).toEqual(["(", 21, ")"]);

    // Changes span
    const skillChangeItems1 = changesSpan1.props.children;
    expect(skillChangeItems1).toHaveLength(2);

    // First change: striker +1
    const firstChange = skillChangeItems1[0].props.children;
    expect(firstChange[0]).toBe("");
    expect(firstChange[1].props.className).toBe("is-skill-up");
    expect(firstChange[1].props.children).toEqual(["striker", " ", "+1"]);

    // Second change: technique +1 preceded by comma
    const secondChange = skillChangeItems1[1].props.children;
    expect(secondChange[0]).toBe(", ");
    expect(secondChange[1].props.className).toBe("is-skill-up");
    expect(secondChange[1].props.children).toEqual(["technique", " ", "+1"]);

    // Player 102 row (has negative delta stamina -1)
    const rowPlayer2 = items.find((li: { key: string }) => li.key === "102");
    expect(rowPlayer2).toBeDefined();

    const [playerDiv2, changesSpan2] = rowPlayer2.props.children;
    const [playerLink2, ageSpan2] = playerDiv2.props.children;
    expect(playerLink2.props.countryName).toBe("England");
    expect(playerLink2.props.playerId).toBe("102");
    expect(playerLink2.props.children).toBe("John Doe");
    expect(ageSpan2.props.children).toEqual(["(", 19, ")"]);

    const skillChangeItems2 = changesSpan2.props.children;
    const downChange = skillChangeItems2[1].props.children;
    expect(downChange[1].props.className).toBe("is-skill-down");
    expect(downChange[1].props.children).toEqual(["stamina", " ", -1]);
  });

  it("calls onClose and onSelectPlayer when player is selected via PlayerLink callback", () => {
    const onClose = vi.fn();
    const onSelectPlayer = vi.fn();

    const element = RecentTrainingProgressModal({
      history: mockHistory,
      isOpen: true,
      onClose,
      players: mockPlayers,
      onSelectPlayer
    });

    const section = element!.props.children;
    const [, list] = section.props.children;
    const items = list.props.children;
    const rowPlayer1 = items.find((li: { key: string }) => li.key === "101");
    const [playerDiv] = rowPlayer1.props.children;
    const [playerLink] = playerDiv.props.children;

    // Trigger onSelectPlayer from PlayerLink
    playerLink.props.onSelectPlayer("101");

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelectPlayer).toHaveBeenCalledWith("101");
  });
});
