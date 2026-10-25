import {Composition} from 'remotion';
import {MarketIntro} from './MarketIntro';

export const RemotionRoot = () => (
  <Composition
    id="MarketIntro"
    component={MarketIntro}
    durationInFrames={1530}
    fps={30}
    width={1920}
    height={1080}
  />
);
