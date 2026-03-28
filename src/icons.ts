import { svg } from 'lit';
import type { SVGTemplateResult } from 'lit';

const icon = (content: SVGTemplateResult, size = 12) => svg`
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" stroke-linejoin="miter">
    ${content}
  </svg>
`;

/** Filled play triangle */
export const iconPlay = icon(svg`<polygon points="6,4 20,12 6,20" fill="currentColor" stroke="none" />`);

/** Filled play triangle mirrored (pointing left) */
export const iconPlayPrev = icon(svg`<polygon points="18,4 4,12 18,20" fill="currentColor" stroke="none" />`);

/** Filled stop square */
export const iconStop = icon(svg`<rect x="5" y="5" width="14" height="14" fill="currentColor" stroke="none" />`);

/** Loop / cycle arrows */
export const iconLoop = icon(svg`
  <path d="M17 2l4 4-4 4" />
  <path d="M3 12v-2a4 4 0 0 1 4-4h14" />
  <path d="M7 22l-4-4 4-4" />
  <path d="M21 12v2a4 4 0 0 1-4 4H3" />
`);

/** Checkmark */
export const iconCheck = icon(svg`<polyline points="4,12 10,18 20,6" />`);

/** X / close */
export const iconClose = icon(svg`
  <line x1="6" y1="6" x2="18" y2="18" />
  <line x1="18" y1="6" x2="6" y2="18" />
`);

/** Plus */
export const iconPlus = icon(svg`
  <line x1="12" y1="5" x2="12" y2="19" />
  <line x1="5" y1="12" x2="19" y2="12" />
`);

/** Gear / settings */
export const iconGear = icon(svg`
  <circle cx="12" cy="12" r="3" />
  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
`, 10);

/** Piano keyboard */
export const iconKeyboard = icon(svg`
  <rect x="3" y="5" width="18" height="14" rx="1" stroke="currentColor" fill="none" />
  <line x1="9" y1="5" x2="9" y2="19" />
  <line x1="15" y1="5" x2="15" y2="19" />
  <rect x="7" y="5" width="3" height="8" fill="currentColor" stroke="none" />
  <rect x="13" y="5" width="3" height="8" fill="currentColor" stroke="none" />
`);

/** Vertical ellipsis menu icon */
export const iconMenu = icon(svg`
  <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
  <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
  <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none" />
`);

/** Dual split icon (vertical divider) */
export const iconSplit = icon(svg`
  <line x1="12" y1="3" x2="12" y2="21" stroke-width="2" />
  <polyline points="8,7 4,12 8,17" fill="none" />
  <polyline points="16,7 20,12 16,17" fill="none" />
`);

/** Scissors */
export const iconScissors = icon(svg`
  <circle cx="6" cy="18" r="3" fill="none" />
  <circle cx="18" cy="18" r="3" fill="none" />
  <line x1="8.5" y1="16" x2="17" y2="4" />
  <line x1="15.5" y1="16" x2="7" y2="4" />
`);

/** Edit / pencil */
export const iconEdit = icon(svg`
  <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
`);

/** Download arrow */
export const iconDownload = icon(svg`
  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
  <polyline points="7 10 12 15 17 10" />
  <line x1="12" y1="15" x2="12" y2="3" />
`);

/** Grid / slots */
export const iconGrid = icon(svg`
  <rect x="3" y="3" width="7" height="7" />
  <rect x="14" y="3" width="7" height="7" />
  <rect x="3" y="14" width="7" height="7" />
  <rect x="14" y="14" width="7" height="7" />
`);

/** Expand / maximize */
export const iconExpand = icon(svg`
  <polyline points="15 3 21 3 21 9" />
  <polyline points="9 21 3 21 3 15" />
  <line x1="21" y1="3" x2="14" y2="10" />
  <line x1="3" y1="21" x2="10" y2="14" />
`);

/** Contract / minimize */
export const iconContract = icon(svg`
  <polyline points="4 14 10 14 10 20" />
  <polyline points="20 10 14 10 14 4" />
  <line x1="14" y1="10" x2="21" y2="3" />
  <line x1="10" y1="14" x2="3" y2="21" />
`);

/** Heart (filled, pixel art) */
export const iconHeart = svg`
  <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 9 9"
    fill="currentColor" shape-rendering="crispEdges">
    <rect x="1" y="0" width="1" height="1"/>
    <rect x="2" y="0" width="1" height="1"/>
    <rect x="5" y="0" width="1" height="1"/>
    <rect x="6" y="0" width="1" height="1"/>
    <rect x="0" y="1" width="1" height="1"/>
    <rect x="1" y="1" width="1" height="1"/>
    <rect x="2" y="1" width="1" height="1"/>
    <rect x="3" y="1" width="1" height="1"/>
    <rect x="4" y="1" width="1" height="1"/>
    <rect x="5" y="1" width="1" height="1"/>
    <rect x="6" y="1" width="1" height="1"/>
    <rect x="7" y="1" width="1" height="1"/>
    <rect x="0" y="2" width="1" height="1"/>
    <rect x="1" y="2" width="1" height="1"/>
    <rect x="2" y="2" width="1" height="1"/>
    <rect x="3" y="2" width="1" height="1"/>
    <rect x="4" y="2" width="1" height="1"/>
    <rect x="5" y="2" width="1" height="1"/>
    <rect x="6" y="2" width="1" height="1"/>
    <rect x="7" y="2" width="1" height="1"/>
    <rect x="0" y="3" width="1" height="1"/>
    <rect x="1" y="3" width="1" height="1"/>
    <rect x="2" y="3" width="1" height="1"/>
    <rect x="3" y="3" width="1" height="1"/>
    <rect x="4" y="3" width="1" height="1"/>
    <rect x="5" y="3" width="1" height="1"/>
    <rect x="6" y="3" width="1" height="1"/>
    <rect x="7" y="3" width="1" height="1"/>
    <rect x="1" y="4" width="1" height="1"/>
    <rect x="2" y="4" width="1" height="1"/>
    <rect x="3" y="4" width="1" height="1"/>
    <rect x="4" y="4" width="1" height="1"/>
    <rect x="5" y="4" width="1" height="1"/>
    <rect x="6" y="4" width="1" height="1"/>
    <rect x="2" y="5" width="1" height="1"/>
    <rect x="3" y="5" width="1" height="1"/>
    <rect x="4" y="5" width="1" height="1"/>
    <rect x="5" y="5" width="1" height="1"/>
    <rect x="3" y="6" width="1" height="1"/>
    <rect x="4" y="6" width="1" height="1"/>
  </svg>
`;
