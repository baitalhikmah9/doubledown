/**
 * Warm expo-image memory for play UI art so category/wager icons paint instantly
 * after the user leaves home.
 */
import { Image, type ImageSource } from 'expo-image';
import { getAllCategoryPictureSources } from '@/constants/categoryPictures';

const WAGER_ART: ImageSource = require('../assets/wager.webp');
const HOT_SEAT_ART: ImageSource = require('../assets/hot-seat.webp');

let inflight: Promise<void> | null = null;

export function prefetchPlayArtwork(): Promise<void> {
  if (inflight) return inflight;

  inflight = (async () => {
    const sources: ImageSource[] = [
      WAGER_ART,
      HOT_SEAT_ART,
      ...getAllCategoryPictureSources(),
    ];
    // Fire in parallel; failures are non-fatal (first real render still loads).
    await Promise.allSettled(sources.map((source) => Image.loadAsync(source)));
  })();

  return inflight;
}
