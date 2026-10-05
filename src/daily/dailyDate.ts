import type { TFunction } from 'i18next';
import { translateDynamic } from '../i18n/dynamicKey';
import { monthDayForNumber } from './calendar';

/**
 * Short localized date for a daily, e.g. "Oct 5" / "5 oct." / "1er oct." --
 * built from translated month names rather than `Intl`, so it reads the same
 * on every device regardless of the JS engine's locale data. `t` must be
 * bound to the `common` namespace.
 */
export function formatDailyDate(t: TFunction<'common'>, dayNumber: number): string {
  const { month, day } = monthDayForNumber(dayNumber);
  const monthLabel = translateDynamic(t, `daily.months.${month}`);
  return day === 1 ? t('daily.dateFirstOfMonth', { month: monthLabel }) : t('daily.date', { month: monthLabel, day });
}
