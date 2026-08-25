/**
 * Warm expo-image memory for hub/play chrome (logo, settings, wager, topics)
 * so later screens paint from cache.
 */
import { Image, type ImageSource } from 'expo-image';
import { getAllCategoryPictureSources } from '@/constants/categoryPictures';

const BACKFIRE_LOGO: ImageSource = require('../assets/bf-in-game-logo.webp');
const SETTINGS_BUTTON: ImageSource = require('../assets/qf-settings-button.webp');
const WAGER_ART: ImageSource = require('../assets/wager.webp');
const HOT_SEAT_ART: ImageSource = require('../assets/hot-seat.webp');

let inflight: Promise<void> | null = null;

export function prefetchPlayArtwork(): Promise<void> {
  if (inflight) return inflight;

  inflight = (async () => {
    const loadAsync = Image.loadAsync?.bind(Image);
    if (!loadAsync) return;

    const sources: ImageSource[] = [
      BACKFIRE_LOGO,
      SETTINGS_BUTTON,
      WAGER_ART,
      HOT_SEAT_ART,
      ...getAllCategoryPictureSources(),
    ];
    // Fire in parallel; failures are non-fatal (first real render still loads).
    await Promise.allSettled(sources.map((source) => loadAsync(source)));
  })();

  return inflight;
}
