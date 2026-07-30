import React from 'react';
import { Circle, Text as SvgText } from 'react-native-svg';
import { colors } from '../../theme/colors';
import {
  BeamRelayDot,
  ConnLine,
  DiagramFrame,
  MirrorGlyph,
  RangeRing,
  ReceiverRing,
  RelayDot,
  SourceNode,
  WallBlock,
} from './components/TutorialDiagram';

// A single combined tutorial (all 4 steps), shown once before the player's
// very first level -- see levelTutorialKey in levels.ts. Earlier iterations
// split this across three separate per-level tutorials; consolidated into
// one so players only ever see it a single time.
// Title/desc text lives in locales/{en,fr}.json under `tutorial.<group>[i]`,
// keyed by this same group name + array index -- TutorialScreen resolves it.
export const tutorialDiagrams: Record<string, Array<() => React.ReactElement>> = {
  all: [
    () => (
      <DiagramFrame>
        <RangeRing cx={60} cy={85} r={42} color="blue" />
        <SourceNode cx={60} cy={85} color="blue" label="S" />
        <ConnLine x1={60} y1={85} x2={214} y2={85} color="blue" />
        <ReceiverRing cx={214} cy={85} color="blue" />
      </DiagramFrame>
    ),
    () => (
      <DiagramFrame>
        <RangeRing cx={46} cy={130} r={34} color="blue" />
        <SourceNode cx={46} cy={130} color="blue" label="S" />
        <RangeRing cx={135} cy={55} r={34} color="blue" />
        <RelayDot cx={135} cy={55} color="blue" />
        <ConnLine x1={46} y1={130} x2={135} y2={55} color="blue" />
        <RangeRing cx={224} cy={130} r={34} color="blue" />
        <ConnLine x1={135} y1={55} x2={224} y2={130} color="blue" />
        <ReceiverRing cx={224} cy={130} color="blue" />
      </DiagramFrame>
    ),
    () => (
      <DiagramFrame>
        <RangeRing cx={40} cy={85} r={34} color="blue" />
        <SourceNode cx={40} cy={85} color="blue" label="S" />
        <WallBlock x={120} y={20} w={16} h={60} />
        <ConnLine x1={40} y1={85} x2={200} y2={30} color="blue" dashed />
        <SvgText x={128} y={52} fontSize={15} fill={colors.signalRed} fontWeight="700">
          ✕
        </SvgText>
        <RangeRing cx={120} cy={140} r={34} color="blue" />
        <RelayDot cx={120} cy={140} color="blue" />
        <ConnLine x1={40} y1={85} x2={120} y2={140} color="blue" />
        <RangeRing cx={214} cy={85} r={34} color="blue" />
        <ConnLine x1={120} y1={140} x2={214} y2={85} color="blue" />
        <ReceiverRing cx={214} cy={85} color="blue" />
      </DiagramFrame>
    ),
    () => (
      <DiagramFrame>
        <RelayDot cx={70} cy={60} color="blue" />
        <RelayDot cx={96} cy={84} color="red" />
        <Circle cx={83} cy={72} r={30} fill="none" stroke={colors.warn} strokeWidth={1.6} strokeDasharray="3,3" />
        <SvgText x={83} y={40} fontSize={10} fill={colors.warn} textAnchor="middle">
          JAMMED
        </SvgText>
        <RelayDot cx={190} cy={50} color="blue" />
        <RelayDot cx={190} cy={120} color="red" />
        <SvgText x={190} y={88} fontSize={9} fill={colors.success} textAnchor="middle">
          clear ✓
        </SvgText>
      </DiagramFrame>
    ),
  ],
  // Gated on the first level that introduces a mirror tile -- see levelTutorialKey in levels.ts.
  mirrors: [
    () => (
      <DiagramFrame>
        <RangeRing cx={40} cy={130} r={30} color="blue" />
        <SourceNode cx={40} cy={130} color="blue" label="S" />
        <ConnLine x1={40} y1={130} x2={150} y2={40} color="blue" />
        <MirrorGlyph cx={150} cy={40} orientation="back" />
        <ConnLine x1={150} y1={40} x2={230} y2={130} color="blue" />
        <ReceiverRing cx={230} cy={130} color="blue" />
      </DiagramFrame>
    ),
    () => (
      <DiagramFrame>
        <RangeRing cx={55} cy={85} r={34} color="blue" />
        <RelayDot cx={55} cy={85} color="blue" />
        <SvgText x={55} y={135} fontSize={11} fill={colors.textDim} textAnchor="middle">
          Circle
        </SvgText>
        <ConnLine x1={140} y1={140} x2={140} y2={60} color="blue" />
        <MirrorGlyph cx={140} cy={45} orientation="back" />
        <ConnLine x1={140} y1={45} x2={215} y2={45} color="blue" />
        <BeamRelayDot cx={140} cy={140} color="blue" />
        <SvgText x={140} y={162} fontSize={11} fill={colors.textDim} textAnchor="middle">
          Beam
        </SvgText>
      </DiagramFrame>
    ),
  ],
};
