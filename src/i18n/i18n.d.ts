import 'i18next';
import type { resources } from './index';

// `tutorial` is always looked up with a runtime-built key (group + step
// index, see translateDynamic in ./dynamicKey.ts) never a literal, so typing
// it precisely buys nothing. Left in, the arrays-of-objects shape across 8
// namespaces blow past TS's type-instantiation depth limit (TS2589) -- widen
// it to break that recursion, and keep the flat `meta`/`hub`/`game` sections
// (the ones actually referenced by literal key) fully type-checked.
type LooseTutorial<T> = T extends { tutorial: unknown } ? Omit<T, 'tutorial'> & { tutorial: Record<string, unknown> } : T;
type TypedResources = { [Ns in keyof (typeof resources)['en']]: LooseTutorial<(typeof resources)['en'][Ns]> };

// Type-checks every t()/useTranslation() call against the English resources
// at compile time. This does NOT catch en/fr key drift (both languages are
// typed from the same `resources` object) -- run `npm run i18n:check` for
// that.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: TypedResources;
    returnNull: false;
  }
}
