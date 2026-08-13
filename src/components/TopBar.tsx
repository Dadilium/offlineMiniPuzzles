import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '../theme/tokens';
import { createThemedStyles } from '../theme/createThemedStyles';
import IconButton from './IconButton';

interface Props {
  onBack: () => void;
  backAccessibilityLabel?: string;
  eyebrow?: string;
  title?: string;
  right?: React.ReactNode;
  /** Centers the title across the full bar width instead of anchoring it
   * beside the back button -- opt-in per screen, e.g. Settings. */
  centerTitle?: boolean;
}

/** Shared topbar used by every game's hub and game screens: a back button
 * on the left, an optional title in the middle, and optional action buttons
 * (reset / replay-tutorial) on the right. */
export default function TopBar({ onBack, backAccessibilityLabel, eyebrow, title, right, centerTitle }: Props) {
  const { t } = useTranslation();
  const styles = useStyles();
  return (
    <View style={styles.topbar}>
      <IconButton name="chevron-back" onPress={onBack} accessibilityLabel={backAccessibilityLabel ?? t('topBar.back')} />
      {(eyebrow || title) && (
        <View style={centerTitle ? styles.centerTitleWrap : styles.titleWrap} pointerEvents={centerTitle ? 'none' : 'auto'}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          {title ? <Text style={styles.title}>{title}</Text> : null}
        </View>
      )}
      {right}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 18, paddingTop: 10 },
  titleWrap: { flex: 1, minWidth: 0 },
  centerTitleWrap: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontFamily: fonts.mono, fontSize: 10, color: colors.textFaint, letterSpacing: 1 },
  title: { fontFamily: fonts.display, fontWeight: '700', fontSize: 14.5, color: colors.text },
}));
