# Original background track for the Aion 2 Market video, synthesised from scratch (no samples, no copyright issues).
import numpy as np
from scipy.signal import butter, lfilter, fftconvolve
from scipy.io import wavfile
SR, DUR, BPM = 44100, 56.0, 96
beat = 60 / BPM; bar = 4 * beat
N = int(SR * DUR); t = np.arange(N) / SR
rng = np.random.default_rng(7)
def hz(m): return 440 * 2 ** ((m - 69) / 12)
def lp(x, fc, order=2): b, a = butter(order, fc / (SR / 2)); return lfilter(b, a, x)
# Am - F - C - G (vi IV I V), one chord per bar
CH = [[57, 60, 64], [53, 57, 60], [48, 55, 60], [55, 59, 62]]
ROOT = [45, 41, 48, 43]
pad = np.zeros(N); arp = np.zeros(N); bass = np.zeros(N); kick = np.zeros(N); shim = np.zeros(N)
nb = int(np.ceil(DUR / bar))
for b in range(nb):
    s0 = int(b * bar * SR); s1 = min(N, int((b + 1) * bar * SR) + int(0.4 * SR)); tt = np.arange(s1 - s0) / SR
    ch = CH[b % 4]
    env = np.minimum(1, tt / 0.6) * np.exp(-np.maximum(0, tt - bar) * 6)
    for m in ch + [ch[0] + 12]:
        for d in (-0.08, 0.08):  # detuned saws
            f = hz(m) * 2 ** (d / 12); ph = (f * tt) % 1
            pad[s0:s1] += (2 * ph - 1) * env * 0.05
    # bass: root on beats 1 and 3
    for k in (0, 2):
        a0 = s0 + int(k * beat * SR); L = int(1.1 * beat * SR); tt2 = np.arange(min(L, N - a0)) / SR
        bass[a0:a0 + len(tt2)] += np.sin(2 * np.pi * hz(ROOT[b % 4]) * tt2) * np.exp(-tt2 * 2.2) * 0.35
    # arpeggio (8ths) from bar 2
    if b >= 1:
        seq = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[1] + 12, ch[0] + 24, ch[2] + 12, ch[1] + 12, ch[2] + 12]
        for k, m in enumerate(seq):
            a0 = s0 + int(k * beat / 2 * SR); L = int(0.9 * SR); tt2 = np.arange(min(L, N - a0)) / SR
            if len(tt2) <= 0: continue
            f = hz(m); tone = np.sin(2 * np.pi * f * tt2) + 0.35 * np.sin(4 * np.pi * f * tt2) + 0.1 * np.sin(6 * np.pi * f * tt2)
            arp[a0:a0 + len(tt2)] += tone * np.exp(-tt2 * 5.5) * 0.09
    # soft kick + hat from bar 4 (when the features start)
    if b >= 4:
        for k in range(4):
            a0 = s0 + int(k * beat * SR); tt2 = np.arange(min(int(0.35 * SR), N - a0)) / SR
            if len(tt2) <= 0: continue
            f = 48 + 70 * np.exp(-tt2 * 30)
            kick[a0:a0 + len(tt2)] += np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt2 * 9) * 0.5
            h0 = a0 + int(beat / 2 * SR); L = min(int(0.06 * SR), N - h0)
            if L > 0: shim[h0:h0 + L] += rng.standard_normal(L) * np.exp(-np.arange(L) / SR * 60) * 0.04
pad = lp(pad, 1800); arp = lp(arp, 5000); shim = shim - lp(shim, 6000)
ir_t = np.arange(int(2.2 * SR)) / SR; ir = rng.standard_normal(len(ir_t)) * np.exp(-ir_t * 2.6); ir /= np.abs(ir).sum() / 6
wet = fftconvolve(pad * 0.6 + arp, ir)[:N]
mix = pad + arp * 0.9 + bass + kick * 0.8 + shim + wet * 0.35
fade = np.minimum(1, t / 1.5) * np.minimum(1, np.maximum(0, (DUR - t) / 3.5))
mix *= fade
mix = np.tanh(mix / np.max(np.abs(mix)) * 1.2) * 0.8
st = np.stack([mix, np.concatenate([np.zeros(220), mix[:-220]])], 1)  # tiny stereo widening
wavfile.write('music.wav', SR, (st * 32767).astype(np.int16))
