import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { fonts, radii } from '../theme/tokens';
import { createThemedStyles } from '../theme/createThemedStyles';
import { usePlayOnShow } from '../sound/usePlayOnShow';

interface Props {
  visible: boolean;
  badge: string;
  title: string;
  subtitle: string;
  retryLabel: string;
  onRetry: () => void;
}

/** Lose-state counterpart to WinOverlay -- for games with a mistake budget
 * (e.g. Arrows' hearts). Same absolutely-positioned overlay approach as
 * WinOverlay, for the same reason: no native <Modal> under navigation.replace. */
export default function LevelFailedOverlay({ visible, badge, title, subtitle, retryLabel, onRetry }: Props) {
  const styles = useStyles();
  usePlayOnShow(visible, 'fail');
  if (!visible) return null;
  return (
    <Animated.View entering={FadeIn.duration(220)} style={styles.backdrop} pointerEvents="box-none">
      <Animated.View entering={ZoomIn.delay(80).springify()} style={styles.card}>
        <Text style={styles.badge}>{badge}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{subtitle}</Text>
        <TouchableOpacity style={styles.button} onPress={onRetry} activeOpacity={0.85}>
          <Text style={styles.buttonText}>{retryLabel}</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5,6,10,0.72)', alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    paddingVertical: 26,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '78%',
  },
  badge: { fontSize: 34, marginBottom: 8 },
  title: { fontFamily: fonts.display, fontWeight: '700', fontSize: 18, color: colors.text, marginBottom: 4, textAlign: 'center' },
  sub: { fontSize: 12.5, color: colors.textDim, marginBottom: 18, textAlign: 'center' },
  button: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 18, alignSelf: 'stretch', alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
}));
