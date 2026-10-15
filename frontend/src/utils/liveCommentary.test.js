import { isDismissalEvent, prepareLiveComments } from './liveCommentary';

const goal = { id: 158178941, type: 'GOAL', minute: 20, player_name: 'James Bree' };
const dismissal = { id: 158179583, type: 'YELLOWREDCARD', minute: 44, player_name: 'Cameron Bragg' };
const detail = { minute: 20, order: 8, comment: 'James Bree takes a left-footed shot and scores.', is_goal: false, is_important: true };
const announcement = { minute: 20, order: 7, comment: 'Goal! James Bree scores to make it 1-0, assisted by Finn Azaz.', is_goal: true, is_important: true };

test('combines differently flagged descriptions of one goal without losing detail', () => {
  const result = prepareLiveComments([detail, announcement], [goal]);
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({ is_goal: true, is_important: true, matchingEvent: goal });
  expect(result[0].comment).toContain(detail.comment);
  expect(result[0].comment).toContain(announcement.comment);
  expect(detail.comment).toBe('James Bree takes a left-footed shot and scores.');
});

test('promotes an unflagged second-yellow dismissal using its event', () => {
  const comment = { minute: 44, comment: 'Cameron Bragg receives a second yellow card.', is_goal: false, is_important: false };
  expect(prepareLiveComments([comment], [dismissal])[0]).toMatchObject({
    is_goal: false, is_important: true, matchingEvent: dismissal,
  });
});

test.each(['REDCARD', 'RED_CARD', 'YELLOWREDCARD', 'YELLOW_RED_CARD', 'SECOND_YELLOW'])(
  'recognizes %s as a dismissal', (type) => expect(isDismissalEvent(type)).toBe(true),
);

test('does not promote an ordinary yellow card or an unrelated player comment', () => {
  const comments = [
    { minute: 32, comment: 'Cameron Bragg receives a yellow card.' },
    { minute: 44, comment: 'James Bree receives a second yellow card.' },
  ];
  expect(prepareLiveComments(comments, [dismissal])).toEqual(comments);
  expect(isDismissalEvent('YELLOWCARD')).toBe(false);
});

test('keeps separate goals, stoppage-time events, and non-scoring shots separate', () => {
  const comments = [
    detail,
    { ...announcement, minute: 21 },
    { ...announcement, extra_minute: 1 },
    { ...detail, comment: 'James Bree takes a left-footed shot but misses.' },
  ];
  const result = prepareLiveComments(comments, [goal, { ...goal, id: 2, minute: 21 }]);
  expect(result).toHaveLength(4);
  expect(result[0].matchingEvent).toBe(goal);
  expect(result[1].matchingEvent.id).toBe(2);
  expect(result[2].matchingEvent).toBeUndefined();
  expect(result[3].matchingEvent).toBeUndefined();
});

test('does not attach commentary to rescinded events', () => {
  expect(prepareLiveComments([detail], [{ ...goal, rescinded: true }])).toEqual([detail]);
});
