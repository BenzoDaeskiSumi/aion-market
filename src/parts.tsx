import type {ReactNode} from 'react';
import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, inter, marcellus} from './theme';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const ease = Easing.bezier(0.16, 1, 0.3, 1);

// Starry wallpaper of the site (bg/abyss.svg) drifting slowly behind every scene.
export const Backdrop = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: C.bg, overflow: 'hidden'}}>
      <Img
        src={staticFile('abyss.svg')}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: 0.55,
          scale: interpolate(frame, [0, 600], [1.05, 1.15], clamp),
        }}
      />
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(11,14,20,0.2) 0%, rgba(11,14,20,0.85) 70%)'}} />
    </AbsoluteFill>
  );
};

// Element that slides up and fades in at `delay` frames.
export const Rise = ({delay = 0, children, style}: {readonly delay?: number; readonly children: ReactNode; readonly style?: React.CSSProperties}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        opacity: interpolate(frame, [delay, delay + 18], [0, 1], clamp),
        translate: interpolate(frame, [delay, delay + 24], ['0px 40px', '0px 0px'], {...clamp, easing: ease}),
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// Left column of a feature scene: small label, big title, a few short lines.
export const Caption = ({kicker, title, lines}: {readonly kicker: string; readonly title: string; readonly lines: readonly string[]}) => (
  <div style={{position: 'absolute', left: 110, top: 0, bottom: 0, width: 600, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28}}>
    <Rise delay={4}>
      <div style={{fontFamily: inter, fontWeight: 600, fontSize: 30, letterSpacing: 4, textTransform: 'uppercase', color: C.accent}}>{kicker}</div>
    </Rise>
    <Rise delay={10}>
      <div style={{fontFamily: marcellus, fontSize: 96, lineHeight: 1.02, color: C.text}}>{title}</div>
    </Rise>
    {lines.map((l, i) => (
      <Rise key={l} delay={22 + i * 12}>
        <div style={{fontFamily: inter, fontSize: 40, lineHeight: 1.3, color: C.dim, display: 'flex', gap: 18}}>
          <span style={{color: C.kinah}}>◆</span>
          <span>{l}</span>
        </div>
      </Rise>
    ))}
  </div>
);

type Focus = {readonly x: number; readonly y: number; readonly w: number};

// A browser-like window showing a screenshot (1920x1080 CSS px, captured at 2x) that glides from one area to another.
export const ScreenPan = ({src, from, to, startAt = 20, moveFor = 90, highlight}: {
  readonly src: string;
  readonly from: Focus;
  readonly to: Focus;
  readonly startAt?: number;
  readonly moveFor?: number;
  readonly highlight?: {readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly at: number};
}) => {
  const frame = useCurrentFrame();
  const W = 1080, H = 720;
  const t = interpolate(frame, [startAt, startAt + moveFor], [0, 1], {...clamp, easing: Easing.bezier(0.65, 0, 0.35, 1)});
  const f = {x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, w: from.w + (to.w - from.w) * t};
  const s = W / f.w;
  return (
    <div
      style={{
        position: 'absolute', left: 760, top: 180, width: W, height: H + 44, borderRadius: 18, overflow: 'hidden',
        backgroundColor: C.panel, border: `2px solid ${C.line}`, boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
        opacity: interpolate(frame, [0, 16], [0, 1], clamp),
        translate: interpolate(frame, [0, 26], ['60px 0px', '0px 0px'], {...clamp, easing: ease}),
      }}
    >
      <div style={{height: 44, display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 18, backgroundColor: C.card, borderBottom: `1px solid ${C.line}`}}>
        {['#f87171', '#e3b54f', '#34d399'].map((c) => <div key={c} style={{width: 13, height: 13, borderRadius: 7, backgroundColor: c}} />)}
        <div style={{marginLeft: 18, fontFamily: inter, fontSize: 18, color: C.dim}}>benzodaeskisumi.github.io/aion-market</div>
      </div>
      <div style={{position: 'relative', width: W, height: H, overflow: 'hidden'}}>
        <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transformOrigin: '0 0', scale: String(s), translate: `${-f.x * s}px ${-f.y * s}px`}}>
          <Img src={staticFile(src)} style={{width: 1920, height: 1080}} />
          {highlight ? (
            <div
              style={{
                position: 'absolute', left: highlight.x, top: highlight.y, width: highlight.w, height: highlight.h, borderRadius: 10,
                border: `${3 / s}px solid ${C.kinah}`, boxShadow: `0 0 ${24 / s}px rgba(227,181,79,0.6)`,
                opacity: interpolate(frame, [highlight.at, highlight.at + 12], [0, 1], clamp),
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};

export const Logo = ({size}: {readonly size: number}) => (
  <Img src={staticFile('logo.png')} style={{width: size, height: size, borderRadius: size * 0.22, boxShadow: '0 0 60px rgba(91,140,255,0.45)'}} />
);

export const useFps = () => useVideoConfig().fps;
