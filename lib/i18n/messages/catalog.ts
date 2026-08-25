import enMessages, { type Messages } from './en';

export function withEnglishFallback(overrides: Partial<Messages>): Messages {
  return {
    ...enMessages,
    ...overrides,
  };
}

