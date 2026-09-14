/**
 * Small per-browser UI preferences for the Descargas screen (which review
 * tab is showing). Losing them is harmless, so every storage failure falls
 * back to "no preference".
 */
export const REVIEW_TAB_KEY = 'descargas.ui.reviewTab';

export function loadPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function savePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode or quota: the preference just won't survive a reload.
  }
}
