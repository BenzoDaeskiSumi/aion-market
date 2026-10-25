import {loadFont as loadInter} from '@remotion/google-fonts/Inter';
import {loadFont as loadMarcellus} from '@remotion/google-fonts/Marcellus';

// Same look as the site's dark skin (css/style.css): Inter for text, Marcellus for titles.
export const inter = loadInter('normal', {weights: ['400', '600', '700'], subsets: ['latin']}).fontFamily;
export const marcellus = loadMarcellus('normal', {weights: ['400'], subsets: ['latin']}).fontFamily;

export const C = {
  bg: '#0b0e14',
  panel: '#11151d',
  card: '#161b26',
  line: '#232a38',
  accent: '#5b8cff',
  text: '#e7ebf3',
  dim: '#8a94a7',
  kinah: '#e3b54f',
  up: '#34d399',
  down: '#f87171',
};
