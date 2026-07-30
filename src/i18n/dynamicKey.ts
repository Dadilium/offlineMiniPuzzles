import type { TFunction } from 'i18next';

// Tutorial copy is looked up by a key built from data (the tutorial group
// name + step index), not a hand-typed literal -- i18next's typed t()
// rejects that because TS can't prove a template-literal string is a member
// of the known key union. `npm run i18n:check` (en/fr parity) plus the
// manual QA pass catch a missing key instead of the type system.
export function translateDynamic(t: TFunction<any>, key: string): string {
  return t(key as any) as string;
}
