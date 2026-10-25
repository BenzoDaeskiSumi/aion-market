import {Audio} from '@remotion/media';
import {TransitionSeries, linearTiming} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import {AbsoluteFill, Sequence, staticFile, useVideoConfig} from 'remotion';
import {Bot, Crafting, DbMap, Deals, Detail, Intro, Market, Outro, Overview} from './scenes';

// Scene lengths (seconds) and the cross-fade between them; total = sum - 8 fades.
const T = 15;
const WHOOSH_AT = [5, 10, 18, 25, 32, 40, 47, 54];   // scene starts (seconds), roughly, for a soft whoosh

export const MarketIntro = () => {
  const {fps} = useVideoConfig();
  return (
    <AbsoluteFill style={{backgroundColor: '#0b0e14'}}>
      <TransitionSeries>
        <TransitionSeries.Sequence name="Intro" durationInFrames={5 * fps}><Intro /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames: T})} />
        <TransitionSeries.Sequence name="Numeri" durationInFrames={5 * fps}><Overview /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames: T})} />
        <TransitionSeries.Sequence name="Market" durationInFrames={8 * fps}><Market /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames: T})} />
        <TransitionSeries.Sequence name="Dettaglio" durationInFrames={7 * fps}><Detail /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames: T})} />
        <TransitionSeries.Sequence name="Affari" durationInFrames={7 * fps}><Deals /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames: T})} />
        <TransitionSeries.Sequence name="Crafting" durationInFrames={8 * fps}><Crafting /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames: T})} />
        <TransitionSeries.Sequence name="Database e Mappa" durationInFrames={7 * fps}><DbMap /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames: T})} />
        <TransitionSeries.Sequence name="Bot Discord" durationInFrames={7 * fps}><Bot /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames: T})} />
        <TransitionSeries.Sequence name="Fine" durationInFrames={6 * fps}><Outro /></TransitionSeries.Sequence>
      </TransitionSeries>
      {/* original track synthesised by music.py (no samples, free to use) */}
      <Audio src={staticFile('music.mp3')} volume={0.6} />
      {WHOOSH_AT.map((s, i) => (
        <Sequence key={s} name={`Whoosh ${i + 1}`} from={Math.round(s * fps - (i + 1) * T)} durationInFrames={fps}>
          <Audio src="https://remotion.media/whoosh.wav" volume={0.22} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
