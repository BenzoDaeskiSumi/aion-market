import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {Backdrop, Caption, Logo, Rise, ScreenPan} from './parts';
import {C, inter, marcellus} from './theme';

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
          <div style={{fontFamily: inter, fontSize: 48, color: C.dim}}>Il Market di Aion 2, letto per te</div>
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
        <div style={{fontFamily: marcellus, fontSize: 104, color: C.text, textAlign: 'center'}}>Prezzi aggiornati ogni ora</div>
      </Rise>
      <div style={{display: 'flex', gap: 48}}>
        <Stat value="23" label="server EU Asmodian" color={C.accent} delay={16} />
        <Stat value="1.252" label="oggetti su Marchutan" color={C.kinah} delay={26} />
        <Stat value="24/7" label="dati da aion2.exchange" color={C.up} delay={36} />
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);

export const Market = () => (
  <AbsoluteFill>
    <Backdrop />
    <Caption kicker="Market" title="Ogni prezzo, a colpo d'occhio" lines={['Prezzo più basso, media e trend a 7 giorni', 'Filtri per categoria, grado e preferiti', 'Segnale: Compra, Vendi o Tieni']} />
    <ScreenPan src="market.jpg" from={{x: 0, y: 0, w: 1920}} to={{x: 300, y: 360, w: 1180}} startAt={30} moveFor={100}
      highlight={{x: 870, y: 400, w: 470, h: 52, at: 140}} />
  </AbsoluteFill>
);

export const Detail = () => (
  <AbsoluteFill>
    <Backdrop />
    <Caption kicker="Dettaglio" title="La storia di ogni oggetto" lines={['Grafico a 24 ore, 7, 30 e 90 giorni', 'Affidabilità, liquidità e volatilità', 'Quanto guadagni se lo rivendi']} />
    <ScreenPan src="detail.jpg" from={{x: 1380, y: 270, w: 540}} to={{x: 1380, y: 690, w: 540}} startAt={60} moveFor={90} />
  </AbsoluteFill>
);

export const Deals = () => (
  <AbsoluteFill>
    <Backdrop />
    <Caption kicker="Affari" title="Le occasioni del momento" lines={['Cosa comprare sotto la media', 'Cosa rivendere, con il profitto stimato', 'Calcoli già al netto della tassa']} />
    <ScreenPan src="deals.jpg" from={{x: 0, y: 0, w: 1920}} to={{x: 300, y: 370, w: 1180}} startAt={30} moveFor={100}
      highlight={{x: 1150, y: 410, w: 300, h: 640, at: 140}} />
  </AbsoluteFill>
);

export const Crafting = () => (
  <AbsoluteFill>
    <Backdrop />
    <Caption kicker="Crafting" title="Craftarlo o comprarlo?" lines={['Costo stimato con i prezzi di oggi', 'Ricetta passo per passo', 'Confronto con la media dei 7 giorni']} />
    <ScreenPan src="craft_detail.jpg" from={{x: 300, y: 380, w: 1180}} to={{x: 1380, y: 300, w: 540}} startAt={70} moveFor={100} />
  </AbsoluteFill>
);

const Shot = ({src, label, delay, top, left}: {readonly src: string; readonly label: string; readonly delay: number; readonly top: number; readonly left: number}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: 'absolute', left, top, width: 800, height: 450 + 52, borderRadius: 18, overflow: 'hidden',
        border: `2px solid ${C.line}`, backgroundColor: C.panel, boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
        opacity: interpolate(frame, [delay, delay + 16], [0, 1], clamp),
        translate: interpolate(frame, [delay, delay + 26], ['80px 0px', '0px 0px'], {...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1)}),
      }}
    >
      <div style={{height: 52, display: 'flex', alignItems: 'center', paddingLeft: 24, fontFamily: inter, fontWeight: 600, fontSize: 28, color: C.text, backgroundColor: C.card}}>{label}</div>
      <Img src={staticFile(src)} style={{width: 800, height: 450, scale: interpolate(frame, [delay, delay + 200], [1, 1.08], clamp)}} />
    </div>
  );
};

export const DbMap = () => (
  <AbsoluteFill>
    <Backdrop />
    <Caption kicker="E non solo" title="Database e Mappa" lines={['Tutti gli oggetti ufficiali del gioco', 'Mappa con raccolta, boss e cubi nascosti']} />
    <Shot src="db.jpg" label="Database" delay={20} top={110} left={780} />
    <Shot src="map.jpg" label="Mappa" delay={60} top={480} left={1020} />
  </AbsoluteFill>
);

const COMMANDS: readonly (readonly [string, string])[] = [
  ['/info', 'scheda e grafico di un oggetto'],
  ['/affari', 'i migliori affari ora'],
  ['/craft', 'conviene craftarlo?'],
  ['/avviso', 'ti tagga quando il prezzo arriva'],
  ['/preferiti', 'i tuoi oggetti del sito'],
  ['/personaggio', 'scheda ufficiale di un PG'],
];

export const Bot = () => (
  <AbsoluteFill>
    <Backdrop />
    <Caption kicker="Discord" title="Il Market nel tuo server" lines={['Un bot con i dati del sito', 'Avvisi di prezzo con il tuo account']} />
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
      <Rise delay={34}><div style={{fontFamily: inter, fontSize: 44, color: C.kinah}}>Un progetto della Legione · Marchutan</div></Rise>
      <Rise delay={46}><div style={{fontFamily: inter, fontSize: 30, color: C.dim, marginTop: 30}}>Prezzi: aion2.exchange · Ricette e mappa: MetaBot.GG</div></Rise>
    </AbsoluteFill>
  </AbsoluteFill>
);
