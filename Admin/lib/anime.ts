/** Shared dynamic import for animejs v4 — typed, no hand-rolled casts. */
let animePromise: Promise<typeof import('animejs')> | null = null;

export function loadAnime(): Promise<typeof import('animejs')> {
  if (!animePromise) {
    animePromise = import('animejs');
  }
  return animePromise;
}
