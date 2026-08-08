import { EN_WORDS } from './en';
import { FR_WORDS } from './fr';

export type WordBankLanguage = 'en' | 'fr';

// Uppercase Latin letters plus the accented characters actually used by the
// French bank -- accents are kept (stripping them would make a French word
// unrecognizable), but anything with a space/hyphen/apostrophe is rejected
// since a word-search placement can't span a gap.
const WORD_PATTERN = /^[A-ZÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸÆŒ]+$/;
const MIN_LENGTH = 3;
const MAX_LENGTH = 9;

/** Filters a raw hand-authored word list down to what generation can use: single alphabetic tokens, 3-9 letters, deduplicated, uppercased. */
export function sanitizeWordBank(words: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of words) {
    const word = raw.trim().toUpperCase();
    if (word.length < MIN_LENGTH || word.length > MAX_LENGTH) continue;
    if (!WORD_PATTERN.test(word)) continue;
    if (seen.has(word)) continue;
    seen.add(word);
    out.push(word);
  }
  return out;
}

// Sanitized once at import time, not per generation call -- the raw lists
// never change at runtime.
const SANITIZED: Record<WordBankLanguage, string[]> = {
  en: sanitizeWordBank(EN_WORDS),
  fr: sanitizeWordBank(FR_WORDS),
};

export function wordBankFor(language: WordBankLanguage): string[] {
  return SANITIZED[language];
}
