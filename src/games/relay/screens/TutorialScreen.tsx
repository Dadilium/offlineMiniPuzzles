import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, fonts, radii } from '../../../theme/colors';
import { tutorialGroups } from '../tutorialContent';
import type { RelayStackParamList } from '../navigation';
import { useRelayProgress } from '../state/useRelayProgress';

type Props = NativeStackScreenProps<RelayStackParamList, 'RelayTutorial'>;

export default function TutorialScreen({ route, navigation }: Props) {
  const { tutorialKey, pendingLevelIndex } = route.params;
  const { markTutorialSeen } = useRelayProgress();
  const steps = tutorialGroups[tutorialKey] ?? tutorialGroups.all;
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex];

  function finish() {
    markTutorialSeen(tutorialKey);
    if (pendingLevelIndex === null) {
      navigation.goBack();
    } else {
      navigation.replace('RelayGame', { levelIndex: pendingLevelIndex });
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={finish}>
          <Text style={styles.skip}>SKIP</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <View style={styles.diagram}>{step.diagram()}</View>
        <Text style={styles.stepLabel}>{steps.length > 1 ? `Step ${stepIndex + 1} of ${steps.length}` : 'New mechanic'}</Text>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.desc}>{step.desc}</Text>
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
            <Text style={styles.btnGhostText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={() => {
              if (stepIndex < steps.length - 1) setStepIndex((i) => i + 1);
              else finish();
            }}
          >
            <Text style={styles.btnPrimaryText}>{stepIndex === steps.length - 1 ? 'Start playing' : 'Next'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDeep },
  topbar: { alignItems: 'flex-end', paddingHorizontal: 18, paddingTop: 10 },
  skip: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.textFaint, letterSpacing: 1 },
  body: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 6 },
  diagram: { width: '100%', maxWidth: 270, height: 170, marginVertical: 12 },
  stepLabel: { fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 2, textTransform: 'uppercase', color: colors.signalBlue, marginBottom: 6 },
  title: { fontFamily: fonts.display, fontWeight: '700', fontSize: 18, color: colors.text, marginBottom: 8, textAlign: 'center' },
  desc: { fontSize: 13.5, lineHeight: 20, color: colors.textDim, maxWidth: 280, textAlign: 'center' },
  footer: { paddingHorizontal: 20, paddingBottom: 18, paddingTop: 14 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 7, marginBottom: 14 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.surface3 },
  dotActive: { width: 18, backgroundColor: colors.signalBlue },
  nav: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, borderRadius: radii.md, paddingVertical: 13, alignItems: 'center' },
  btnPrimary: { backgroundColor: colors.accent },
  btnPrimaryText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  btnGhost: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  btnGhostText: { color: colors.text, fontWeight: '600', fontSize: 14 },
  hidden: { opacity: 0 },
});
