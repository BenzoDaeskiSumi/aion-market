import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {Backdrop, Caption, Logo, Rise, ScreenPan} from './parts';
import {C, inter, marcellus} from './theme';
import R from '../public/rects.json';

// boxes measured on the live page by scripts/shots.mjs (CSS px of the 1920x1080 screenshot)
const pad = (r: {x: number; y: number; w: number; h: number}, p: number) => ({x: r.x - p, y: r.y - p, w: r.w + 2 * p, h: r.h + 2 * p});
const span = (a: {x: number; w: number}, b: {x: number; w: number}) => ({x: a.x, w: b.x + b.w - a.x});

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

export const Intro = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 40}}>
        <div
          style={{
            scale: interpolate(frame, [0, 30], [0.6, 1], {...clamp, easing: Easing.spring({damping: 12}), output: 'perceptual-scale'}),
            opacity: interpolate(frame, [0, 12], [0, 1], clamp),
          }}
        >
          <Logo size={220} />
        </div>
        <Rise delay={18}>
          <div style={{fontFamily: marcellus, fontSize: 150, color: C.text, letterSpacing: 2}}>Aion 2 Market</div>
        </Rise>
        <Rise delay={34}>
          <div style={{fontFamily: inter, fontSize: 48, color: C.dim}}>The Aion 2 Market, read for you</div>
        </Rise>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Stat = ({value, label, color, delay}: {readonly value: string; readonly label: string; readonly color: string; readonly delay: number}) => (
  <Rise delay={delay} style={{width: 470, padding: '44px 40px', borderRadius: 24, backgroundColor: 'rgba(22,27,38,0.85)', border: `2px solid ${C.line}`}}>
    <div style={{fontFamily: marcellus, fontSize: 104, color, lineHeight: 1}}>{value}</div>
    <div style={{fontFamily: inter, fontSize: 40, color: C.dim, marginTop: 18}}>{label}</div>
  </Rise>
);

export const Overview = () => (
  <AbsoluteFill>
    <Backdrop />
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 80}}>
      <Rise delay={4}>
        <div style={{fontFamily: marcellus, fontSize: 104, color: C.text, textAlign: 'center'}}>Marchutan prices, every hour</div>
      </Rise>
      <div style={{display: 'flex', gap: 48}}>
        <Stat value="1,250+" label="items tracked" color={C.kinah} delay={16} />
        <Stat value="1 h" label="between updates" color={C.accent} delay={26} />
        <Stat value="Free" label="no account needed" color={C.up} delay={36} />
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);

export const Market = () => (
  <AbsoluteFill>
    <Backdrop />
    <Caption kicker="Market" title="Every price at a glance" lines={['Lowest price, average and 7-day trend', 'Filter by category, grade and favourites', 'Signal: Buy, Sell or Hold']} />
    <ScreenPan src="market.jpg" from={{x: 0, y: 0, w: 1920}} to={{x: R.market.table.x - 16, y: R.market.table.y - 16, w: R.market.table.w + 32}} startAt={30} moveFor={100}
      highlight={{...pad({...R.market.row1, ...span(R.market.latest, R.market.trend7)}, 4), at: 140}} />
  </AbsoluteFill>
);

export const Detail = () => (
  <AbsoluteFill>
    <Backdrop />
    <Caption kicker="Details" title="The story of every item" lines={['Charts for 24 hours, 7, 30 and 90 days', 'Confidence, liquidity and volatility', 'What you make if you resell it']} />
    <ScreenPan src="detail.jpg" from={{x: R.detail.aside.x - 24, y: R.detail.aside.y - 16, w: R.detail.aside.w + 48}} to={{x: R.detail.aside.x - 24, y: 1080, w: R.detail.aside.w + 48}} startAt={60} moveFor={90} />
  </AbsoluteFill>
);

export const Crafting = () => (
  <AbsoluteFill>
    <Backdrop />
    <Caption kicker="Crafting" title="Craft it or buy it?" lines={['Estimated cost at today\'s prices', 'Recipe step by step', 'Compared with the 7-day average']} />
    <ScreenPan src="craft_detail.jpg" from={{x: R.craft.table.x - 16, y: R.craft.table.y - 16, w: R.craft.table.w + 32}} to={{x: R.craft.aside.x - 24, y: R.craft.aside.y - 16, w: R.craft.aside.w + 48}} startAt={70} moveFor={100} />
  </AbsoluteFill>
);

const Shot = ({src, label, delay, top, left}: {readonly src: string; readonly label: string; readonly delay: number; readonly top: number; readonly left: number}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: 'absolute', left, top, width: 720, height: 405 + 48, borderRadius: 18, overflow: 'hidden',
        border: `2px solid ${C.line}`, backgroundColor: C.panel, boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
        opacity: interpolate(frame, [delay, delay + 16], [0, 1], clamp),
        translate: interpolate(frame, [delay, delay + 26], ['80px 0px', '0px 0px'], {...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1)}),
      }}
    >
      <div style={{height: 48, display: 'flex', alignItems: 'center', paddingLeft: 22, fontFamily: inter, fontWeight: 600, fontSize: 26, color: C.text, backgroundColor: C.card}}>{label}</div>
      <Img src={staticFile(src)} style={{width: 720, height: 405, scale: interpolate(frame, [delay, delay + 200], [1, 1.08], clamp)}} />
    </div>
  );
};

export const DbChars = () => (
  <AbsoluteFill>
    <Backdrop />
    <Caption kicker="And more" title="Database and Characters" lines={['Every official item in the game', 'Stats and Market price side by side', 'Any Marchutan character: Gear Score, gear, Daevanion']} />
    <Shot src="db.jpg" label="Database" delay={20} top={130} left={860} />
    <Shot src="chars.jpg" label="Characters" delay={50} top={470} left={1080} />
  </AbsoluteFill>
);

const COMMANDS: readonly (readonly [string, string])[] = [
  ['/info', 'card and chart of any item'],
  ['/craft', 'is it worth crafting?'],
  ['/alert', 'pings you when the price hits'],
  ['/favorites', 'your items from the site'],
  ['/character', 'official character card'],
];

export const Bot = () => (
  <AbsoluteFill>
    <Backdrop />
    <Caption kicker="Discord" title="The Market in your server" lines={['A bot with the site\'s data', 'Price alerts on your account']} />
    <div style={{position: 'absolute', left: 790, top: 150, width: 1030, display: 'flex', flexDirection: 'column', gap: 22}}>
      {COMMANDS.map(([cmd, what], i) => (
        <Rise key={cmd} delay={16 + i * 10}>
          <div style={{display: 'flex', alignItems: 'center', gap: 32, padding: '26px 36px', borderRadius: 20, backgroundColor: 'rgba(22,27,38,0.9)', border: `2px solid ${C.line}`}}>
            <div style={{fontFamily: inter, fontWeight: 700, fontSize: 44, color: C.accent, width: 310, flexShrink: 0}}>{cmd}</div>
            <div style={{fontFamily: inter, fontSize: 38, color: C.text}}>{what}</div>
          </div>
        </Rise>
      ))}
    </div>
  </AbsoluteFill>
);

export const Outro = () => (
  <AbsoluteFill>
    <Backdrop />
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 34}}>
      <Rise delay={0}><Logo size={170} /></Rise>
      <Rise delay={10}><div style={{fontFamily: marcellus, fontSize: 120, color: C.text}}>Aion 2 Market</div></Rise>
      <Rise delay={22}>
        <div style={{fontFamily: inter, fontWeight: 600, fontSize: 52, color: C.accent, padding: '18px 44px', borderRadius: 999, border: `2px solid ${C.accent}`}}>
          benzodaeskisumi.github.io/aion-market
        </div>
      </Rise>
      <Rise delay={34}><div style={{fontFamily: inter, fontSize: 44, color: C.kinah}}>Marchutan · EU · free, no account needed</div></Rise>
      <Rise delay={46}><div style={{fontFamily: inter, fontSize: 30, color: C.dim, marginTop: 30}}>Prices: aion2.exchange · Recipes: MetaBot.GG · Not affiliated with NCSOFT</div></Rise>
    </AbsoluteFill>
  </AbsoluteFill>
);
