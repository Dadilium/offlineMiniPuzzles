import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fonts } from '../theme/colors';
import IconButton from './IconButton';

interface Props {
  onBack: () => void;
  backAccessibilityLabel?: string;
  eyebrow?: string;
  title?: string;
  right?: React.ReactNode;
}

/** Shared topbar used by every game's hub and game screens: a back button
 * on the left, an optional title in the middle, and optional action buttons
 * (reset / replay-tutorial) on the right. */
export default function TopBar({ onBack, backAccessibilityLabel, eyebrow, title, right }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.topbar}>
      <IconButton glyph="‹" onPress={onBack} accessibilityLabel={backAccessibilityLabel ?? t('topBar.back')} size={44} glyphSize={22} />
      {(eyebrow || title) && (
        <View style={styles.titleWrap}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          {title ? <Text style={styles.title}>{title}</Text> : null}
        </View>
      )}
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingTop: 10 },
  titleWrap: { flex: 1, minWidth: 0 },
  eyebrow: { fontFamily: fonts.mono, fontSize: 10, color: colors.textFaint, letterSpacing: 1 },
  title: { fontFamily: fonts.display, fontWeight: '700', fontSize: 14.5, color: colors.text },
});
