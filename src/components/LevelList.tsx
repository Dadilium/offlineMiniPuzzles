import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { fonts, radii } from '../theme/tokens';
import { createThemedStyles } from '../theme/createThemedStyles';

export type LevelStatus = 'locked' | 'available' | 'complete' | 'skipped';

export interface LevelListItem {
  title?: string;
  status: LevelStatus;
}

interface Props {
  items: LevelListItem[];
  onPress: (index: number) => void;
}

/** Shared level-picker list used by every game's Levels screen: one row per
 * level with a status icon (locked / in-progress / complete). */
export default function LevelList({ items, onPress }: Props) {
  const styles = useStyles();
  return (
    <View style={styles.list}>
      {items.map((item, idx) => {
        const locked = item.status === 'locked';
        return (
          <TouchableOpacity
            key={idx}
            style={[styles.row, locked && styles.rowLocked]}
            disabled={locked}
            activeOpacity={0.7}
            onPress={() => onPress(idx)}
          >
            <Text style={styles.rowNum}>LVL 0{idx + 1}</Text>
            {item.title ? (
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.title}
              </Text>
            ) : (
              <View style={styles.rowSpacer} />
            )}
            <Text style={styles.rowIcon}>
              {item.status === 'complete' ? '✅' : item.status === 'skipped' ? '⏭' : item.status === 'locked' ? '🔒' : ''}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  list: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowLocked: { opacity: 0.42 },
  rowNum: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.textFaint, letterSpacing: 1 },
  rowTitle: { flex: 1, fontFamily: fonts.display, fontWeight: '600', fontSize: 14, color: colors.text },
  rowSpacer: { flex: 1 },
  rowIcon: { width: 22, textAlign: 'center', fontSize: 15 },
}));
