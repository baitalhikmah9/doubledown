import { describe, expect, it } from '@jest/globals';
import {
  RUMBLE_FIRST_TEAM_REVEAL_SECONDS,
  RUMBLE_ROUND_END_SECONDS,
  RUMBLE_SECOND_TEAM_REVEAL_SECONDS,
  RUMBLE_TRANSITION_SECONDS,
  getNextRumbleCheckpointSeconds,
  getRumblePartyPhase,
  getRumblePartySlots,
  isRumbleTeamCountAllowed,
  rumbleQuestionsPerDifficulty,
  rumbleTeamCountsForTopics,
  snapRumbleTeamCount,
} from '@/features/play/rumble';

describe('getRumblePartyPhase / getRumblePartySlots', () => {
  it('maps elapsed seconds to party phases at the official boundaries', () => {
    expect(getRumblePartyPhase(0)).toBe('waiting');
    expect(getRumblePartyPhase(30)).toBe('waiting');
    expect(getRumblePartyPhase(31)).toBe('firstAnswering');
    expect(getRumblePartyPhase(60)).toBe('firstAnswering');
    expect(getRumblePartyPhase(61)).toBe('transition');
    expect(getRumblePartyPhase(75)).toBe('transition');
    expect(getRumblePartyPhase(76)).toBe('secondAnswering');
    expect(getRumblePartyPhase(89)).toBe('secondAnswering');
    expect(getRumblePartyPhase(90)).toBe('ended');
    expect(getRumblePartyPhase(120)).toBe('ended');
  });

  it('reveals first team at 31s, second at 76s, and sets the active slot', () => {
    expect(getRumblePartySlots(0)).toEqual({
      firstRevealed: false,
      secondRevealed: false,
      activeSlot: null,
    });
    expect(getRumblePartySlots(31)).toEqual({
      firstRevealed: true,
      secondRevealed: false,
      activeSlot: 'first',
    });
    expect(getRumblePartySlots(61)).toEqual({
      firstRevealed: true,
      secondRevealed: false,
      activeSlot: null,
    });
    expect(getRumblePartySlots(76)).toEqual({
      firstRevealed: true,
      secondRevealed: true,
      activeSlot: 'second',
    });
    expect(getRumblePartySlots(90)).toEqual({
      firstRevealed: true,
      secondRevealed: true,
      activeSlot: null,
    });
  });
});

describe('getNextRumbleCheckpointSeconds', () => {
  it('returns the next stage boundary used by Skip wait', () => {
    expect(getNextRumbleCheckpointSeconds(0)).toBe(RUMBLE_FIRST_TEAM_REVEAL_SECONDS);
    expect(getNextRumbleCheckpointSeconds(30)).toBe(RUMBLE_FIRST_TEAM_REVEAL_SECONDS);
    expect(getNextRumbleCheckpointSeconds(31)).toBe(RUMBLE_TRANSITION_SECONDS);
    expect(getNextRumbleCheckpointSeconds(60)).toBe(RUMBLE_TRANSITION_SECONDS);
    expect(getNextRumbleCheckpointSeconds(61)).toBe(RUMBLE_SECOND_TEAM_REVEAL_SECONDS);
    expect(getNextRumbleCheckpointSeconds(75)).toBe(RUMBLE_SECOND_TEAM_REVEAL_SECONDS);
    expect(getNextRumbleCheckpointSeconds(76)).toBe(RUMBLE_ROUND_END_SECONDS);
    expect(getNextRumbleCheckpointSeconds(89)).toBe(RUMBLE_ROUND_END_SECONDS);
  });

  it('returns null once the round has ended', () => {
    expect(getNextRumbleCheckpointSeconds(90)).toBeNull();
    expect(getNextRumbleCheckpointSeconds(120)).toBeNull();
  });
});

describe('rumble topic / team pairing', () => {
  it('keeps 2, 3, 4, and 6 teams on six topics', () => {
    expect(rumbleTeamCountsForTopics(6)).toEqual([2, 3, 4, 6]);
    expect(rumbleQuestionsPerDifficulty(6)).toBe(12);
  });

  it('allows only 2 and 4 teams on four topics', () => {
    expect(rumbleTeamCountsForTopics(4)).toEqual([2, 4]);
    expect(isRumbleTeamCountAllowed(4, 3)).toBe(false);
    expect(isRumbleTeamCountAllowed(4, 6)).toBe(false);
    expect(snapRumbleTeamCount(4, 3)).toBe(4);
    expect(snapRumbleTeamCount(4, 6)).toBe(4);
    expect(rumbleQuestionsPerDifficulty(4)).toBe(8);
  });

  it('allows only 3 and 6 teams on three topics', () => {
    expect(rumbleTeamCountsForTopics(3)).toEqual([3, 6]);
    expect(isRumbleTeamCountAllowed(3, 2)).toBe(false);
    expect(isRumbleTeamCountAllowed(3, 4)).toBe(false);
    expect(snapRumbleTeamCount(3, 2)).toBe(3);
    expect(snapRumbleTeamCount(3, 4)).toBe(3);
    expect(rumbleQuestionsPerDifficulty(3)).toBe(6);
  });
});
