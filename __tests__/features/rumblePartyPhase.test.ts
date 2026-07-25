import { describe, expect, it } from '@jest/globals';
import {
  RUMBLE_FIRST_TEAM_REVEAL_SECONDS,
  RUMBLE_ROUND_END_SECONDS,
  RUMBLE_SECOND_TEAM_REVEAL_SECONDS,
  RUMBLE_TRANSITION_SECONDS,
  getNextRumbleCheckpointSeconds,
  getRumblePartyPhase,
  getRumblePartySlots,
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
