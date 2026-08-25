import React from 'react';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import type { GameConfig, GameSessionState, QuestionCard } from '@/features/shared';

import PlayAnswerScreen from '@/app/(app)/play/answer';
import { usePlayStore } from '@/store/play';

function createQuestion(
  overrides: Partial<QuestionCard> & Pick<QuestionCard, 'id' | 'canonicalKey'>
): QuestionCard {
  return {
    id: overrides.id,
    canonicalKey: overrides.canonicalKey,
    categoryId: overrides.categoryId ?? 'cat_science',
    categoryName: overrides.categoryName ?? 'Science',
    prompt: overrides.prompt ?? 'What is the answer?',
    answer: overrides.answer ?? '42',
    promptImageUrl: overrides.promptImageUrl,
    answerImageUrl: overrides.answerImageUrl,
    pointValue: overrides.pointValue ?? 200,
    locale: overrides.locale ?? 'en',
    resolvedFromFallback: overrides.resolvedFromFallback ?? false,
    used: overrides.used ?? false,
    boardSide: overrides.boardSide,
    rumbleFirstTeamId: overrides.rumbleFirstTeamId,
    rumbleSecondTeamId: overrides.rumbleSecondTeamId,
  };
}

function createSession(overrides: Partial<GameSessionState> = {}): GameSessionState {
  const board = overrides.board ?? [createQuestion({ id: 'q-1', canonicalKey: 'science:200:1' })];
  const teams =
    overrides.teams ??
    [
      { id: 'team_1', name: 'Alpha', playerNames: ['Ava'], score: 0, wagersUsed: 0 },
      { id: 'team_2', name: 'Beta', playerNames: ['Ben'], score: 0, wagersUsed: 0 },
    ];

  const config: GameConfig =
    overrides.config ??
    {
      mode: overrides.mode ?? 'classic',
      teams: teams.map(({ id, name, playerNames }) => ({ id, name, playerNames })),
      categories: ['science'],
      contentLocaleChain: ['en'],
      quickPlayTopicCount: 3,
      hotSeatEnabled: false,
      wagerEnabled: true,
      wagersPerTeam: 1,
    };

  return {
    id: 'session-answer',
    mode: overrides.mode ?? 'classic',
    config,
    contentLocaleChain: ['en'],
    step: 'answer',
    phase: 'scoring',
    availableCategories: [
      {
        id: 'cat_science',
        slug: 'science',
        title: 'Science',
        questionCount: 8,
        resolvedLocale: 'en',
        fellBackToEnglish: false,
      },
    ],
    selectedCategoryIds: ['science'],
    currentTeamId: 'team_1',
    currentQuestion: board[0],
    board,
    teams,
    scores: {
      team_1: 0,
      team_2: 0,
    },
    usedQuestionIds: new Set(),
    seed: 'seed-answer',
    wagersPerTeam: 1,
    wager: null,
    bonus: {
      active: false,
      played: false,
      multiplier: 2,
    },
    scoreEvents: [],
    timerStartedAt: 1_000_000,
    ...overrides,
  };
}

describe('PlayAnswerScreen', () => {
  beforeEach(() => {
    usePlayStore.setState({ session: null, tokens: 5, rapidFire: null });
  });

  it('shows the correct-answer kicker, omits the original-question label, and renders the answer', () => {
    const question = createQuestion({
      id: 'q-answer',
      canonicalKey: 'science:200:answer',
      prompt: 'What is the answer?',
      answer: '42',
    });

    usePlayStore.setState({
      session: createSession({
        currentQuestion: question,
        board: [question],
      }),
    });

    render(<PlayAnswerScreen />);

    expect(screen.queryByText('Original Question')).toBeNull();
    expect(screen.getByText('CORRECT ANSWER')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('limits rumble result marking to the first-picked team, second-picked team, and neither', () => {
    const question = createQuestion({
      id: 'q-rumble-answer',
      canonicalKey: 'science:200:rumble-answer',
      rumbleFirstTeamId: 'team_2',
      rumbleSecondTeamId: 'team_3',
    });

    usePlayStore.setState({
      session: createSession({
        mode: 'rumble',
        config: {
          mode: 'rumble',
          teams: [
            { id: 'team_1', name: 'Alpha', playerNames: ['Ava'] },
            { id: 'team_2', name: 'Beta', playerNames: ['Ben'] },
            { id: 'team_3', name: 'Gamma', playerNames: ['Gia'] },
          ],
          categories: ['science'],
          contentLocaleChain: ['en'],
          quickPlayTopicCount: 3,
          hotSeatEnabled: false,
          wagerEnabled: false,
          wagersPerTeam: 0,
        },
        teams: [
          { id: 'team_1', name: 'Alpha', playerNames: ['Ava'], score: 0, wagersUsed: 0 },
          { id: 'team_2', name: 'Beta', playerNames: ['Ben'], score: 0, wagersUsed: 0 },
          { id: 'team_3', name: 'Gamma', playerNames: ['Gia'], score: 0, wagersUsed: 0 },
        ],
        scores: { team_1: 0, team_2: 0, team_3: 0 },
        currentQuestion: question,
        board: [question],
      }),
    });

    render(<PlayAnswerScreen />);

    expect(screen.queryByText('Alpha')).toBeNull();
    expect(screen.getByText('Beta')).toBeTruthy();
    expect(screen.getByText('Gamma')).toBeTruthy();
    expect(screen.getByText('Neither Team')).toBeTruthy();
  });
});
