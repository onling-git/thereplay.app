import { getPlayerLineupEvents, getPlayerLineupEventDetails } from "./lineupEvents";

const player = { player_id: 6513, player_name: "James Bree" };
const goal = { id: 1, type: "GOAL", player_id: 6513, related_player_id: 2, team: "home" };

test("counts goals and assists by player ID, including scored penalties", () => {
  const events = [
    goal,
    { ...goal, id: 2, type: "PENALTY" },
    { ...goal, id: 3, player_id: 2, related_player_id: "6513" },
    { ...goal, id: 4, player_id: 2, related_player_id: 6513 },
  ];
  expect(getPlayerLineupEvents(player, events, "home")).toEqual({ goals: 2, ownGoals: 0, assists: 2, card: null });
});

test("ignores duplicate IDs, rescinded goals, own goals, missed penalties and shootouts", () => {
  const events = [
    goal, { ...goal, id: "1" },
    ...["OWNGOAL", "MISSED_PENALTY", "PENALTY_SHOOTOUT_GOAL"].map((type, index) => ({ ...goal, id: index + 2, type })),
    { ...goal, id: 6, rescinded: true },
  ];
  expect(getPlayerLineupEvents(player, events)).toEqual({ goals: 1, ownGoals: 1, assists: 0, card: null });
  expect(getPlayerLineupEvents({ player_id: 2 }, events).assists).toBe(1);
});

test.each(["REDCARD", "RED_CARD", "YELLOWREDCARD", "YELLOW_RED_CARD", "SECOND_YELLOW"])(
  "%s replaces a prior yellow card", (type) => {
    expect(getPlayerLineupEvents(player, [
      { type: "YELLOWCARD", player_id: 6513 },
      { type, player_id: 6513 },
    ]).card).toBe("red");
  },
);

test("two separate yellows produce a red, but a duplicate or rescinded yellow does not", () => {
  const yellow = { id: 1, type: "YELLOW_CARD", player_id: 6513 };
  expect(getPlayerLineupEvents(player, [yellow]).card).toBe("yellow");
  expect(getPlayerLineupEvents(player, [yellow, yellow]).card).toBe("yellow");
  expect(getPlayerLineupEvents(player, [yellow, { ...yellow, id: 2 }]).card).toBe("red");
  expect(getPlayerLineupEvents(player, [{ ...yellow, rescinded: true }]).card).toBeNull();
});

test("falls back to trimmed names only when IDs are unavailable and keeps teams separate", () => {
  const events = [
    { type: "GOAL", player_name: " James Bree ", related_player_name: "Finn Azaz", team: "home" },
    { type: "GOAL", player_name: "James Bree", team: "away" },
    { type: "GOAL", player_id: 99, player_name: "James Bree", team: "home" },
  ];
  expect(getPlayerLineupEvents(player, events, "home").goals).toBe(1);
  expect(getPlayerLineupEvents({ player_name: " Finn Azaz\u00a0" }, events, "home").assists).toBe(1);
  expect(getPlayerLineupEvents({}, [{ type: "GOAL" }])).toEqual({ goals: 0, ownGoals: 0, assists: 0, card: null });
});

test("players without events have no badges", () => {
  expect(getPlayerLineupEvents(player)).toEqual({ goals: 0, ownGoals: 0, assists: 0, card: null });
});

test("credits own goals to the player even when the event team is the benefiting opponent", () => {
  const ownGoal = { ...goal, type: "OWN_GOAL", team: "away" };
  expect(getPlayerLineupEvents(player, [
    ownGoal, ownGoal, { ...ownGoal, id: 2 }, { ...ownGoal, id: 3, rescinded: true },
  ], "home")).toEqual({ goals: 0, ownGoals: 2, assists: 0, card: null });
  expect(getPlayerLineupEvents({ player_id: 2 }, [ownGoal], "home").ownGoals).toBe(0);
});

test("returns chronological event times and substitution partners for both players", () => {
  const sub = { id: 3, type: "SUBSTITUTION", player_id: 2, player_name: "Replacement",
    related_player_id: 6513, related_player_name: "James Bree", minute: 90, extra_minute: 2 };
  const details = getPlayerLineupEventDetails(player, [
    sub, { ...goal, minute: 20 }, { id: 2, type: "YELLOWCARD", player_id: 6513, minute: 44 },
  ]);
  expect(details).toEqual([
    { kind: "goal", minute: 20, extraMinute: undefined, relatedPlayer: null },
    { kind: "yellow-card", minute: 44, extraMinute: undefined, relatedPlayer: null },
    { kind: "sub-off", minute: 90, extraMinute: 2, relatedPlayer: "Replacement" },
  ]);
  expect(getPlayerLineupEventDetails({ player_id: 2 }, [sub])[0]).toEqual({
    kind: "sub-on", minute: 90, extraMinute: 2, relatedPlayer: "James Bree",
  });
});
