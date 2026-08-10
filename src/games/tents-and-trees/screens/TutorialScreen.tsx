import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { fonts, radii } from '../../../theme/tokens';
import { createThemedStyles } from '../../../theme/createThemedStyles';
import { translateDynamic } from '../../../i18n/dynamicKey';
import { tutorialDiagrams } from '../tutorialContent';
import type { TentsAndTreesStackParamList } from '../navigation';
import { useTentsAndTreesProgress } from '../state/useTentsAndTreesProgress';

type Props = NativeStackScreenProps<TentsAndTreesStackParamList, 'TentsAndTreesTutorial'>;

export default function TutorialScreen({ route, navigation }: Props) {
  const { tutorialKey, pendingLevelIndex } = route.params;
  const { markTutorialSeen } = useTentsAndTreesProgress();
  const { t } = useTranslation('tents-and-trees');
  const { t: tc } = useTranslation('common');
  const styles = useStyles();
  const groupKey = tutorialDiagrams[tutorialKey] ? tutorialKey : 'all';
  const steps = tutorialDiagrams[groupKey];
  const [stepIndex, setStepIndex] = useState(0);
  const diagram = steps[stepIndex];
  const title = translateDynamic(t, `tutorial.${groupKey}.${stepIndex}.title`);
  const desc = translateDynamic(t, `tutorial.${groupKey}.${stepIndex}.desc`);

  function finish() {
    markTutorialSeen(tutorialKey);
    if (pendingLevelIndex === null) {
      navigation.goBack();
    } else {
      navigation.replace('TentsAndTreesGame', { levelIndex: pendingLevelIndex });
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={finish}>
          <Text style={styles.skip}>{tc('tutorial.skip')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <View style={styles.diagram}>{diagram()}</View>
        <Text style={styles.stepLabel}>
          {steps.length > 1 ? tc('tutorial.stepOf', { current: stepIndex + 1, total: steps.length }) : tc('tutorial.newRule')}
        </Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.desc}>{desc}</Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {steps.map((_, i) => (
            <View key={i} style={[styles.dot, i === stepIndex && styles.dotActive]} />
          ))}
        </View>
        <View style={styles.nav}>
          <TouchableOpacity
            style={[styles.btn, styles.btnGhost, stepIndex === 0 && styles.hidden]}
            disabled={stepIndex === 0}
            onPress={() => setStepIndex((i) => Math.max(0, i - 1))}
          >
            <Text style={styles.btnGhostText}>{tc('tutorial.back')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={() => {
              if (stepIndex < steps.length - 1) setStepIndex((i) => i + 1);
              else finish();
            }}
          >
            <Text style={styles.btnPrimaryText}>{stepIndex === steps.length - 1 ? tc('tutorial.startPlaying') : tc('tutorial.next')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bgDeep },
  topbar: { alignItems: 'flex-end', paddingHorizontal: 18, paddingTop: 10 },
  skip: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.textFaint, letterSpacing: 1 },
  body: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 6 },
  diagram: { width: '100%', maxWidth: 270, height: 200, marginVertical: 12 },
  stepLabel: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.success,
    marginBottom: 6,
  },
  title: { fontFamily: fonts.display, fontWeight: '700', fontSize: 18, color: colors.text, marginBottom: 8, textAlign: 'center' },
  desc: { fontSize: 13.5, lineHeight: 20, color: colors.textDim, maxWidth: 280, textAlign: 'center' },
  footer: { paddingHorizontal: 20, paddingBottom: 18, paddingTop: 14 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 7, marginBottom: 14 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.surface3 },
  dotActive: { width: 18, backgroundColor: colors.success },
  nav: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, borderRadius: radii.md, paddingVertical: 13, alignItems: 'center' },
  btnPrimary: { backgroundColor: colors.accent },
  btnPrimaryText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  btnGhost: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  btnGhostText: { color: colors.text, fontWeight: '600', fontSize: 14 },
  hidden: { opacity: 0 },
}));
