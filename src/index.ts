// Sympakt — app entry
import fontUrl from './assets/PressStart2P-Regular.woff2?url';

// Inject @font-face into document so it's available globally
const fontStyle = document.createElement('style');
fontStyle.textContent = `@font-face { font-family: 'PixelFont'; src: url('${fontUrl}') format('woff2'); font-display: swap; }`;
document.head.appendChild(fontStyle);

import './components/app-shell.js';
