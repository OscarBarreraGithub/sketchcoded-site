/**
 * Writes the example board: this website, planned on a Sketchcoded board.
 *
 *   node tools/make-example.mjs
 *
 * Run it by hand when the site's pages or its flow change, and commit what it writes. It is not a
 * build step: visitors get the committed files. Keeping the drawings in code means the frames on
 * the board and the pins on them can never drift apart, because both are placed from the same
 * numbers below.
 *
 * The frames are the pages of sketchcoded.com, so the board a visitor walks is the site they are
 * standing on: Home, this example board, the Guide, the FAQ, and the end of the journey, the app
 * running on their own computer.
 */
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'example');

// ---------------------------------------------------------------- drawing kit
const W = 760;
const ink = '#59615d';
const faint = '#9ba09a';
const paper = (h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}">
<defs>
  <pattern id="grid" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M18 0H0V18" fill="none" stroke="#d7e0dd" stroke-opacity=".38" stroke-width=".6"/></pattern>
  <filter id="rough"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.1" xChannelSelector="R" yChannelSelector="G"/></filter>
</defs>
<rect width="100%" height="100%" fill="#fdfbf4"/><rect width="100%" height="100%" fill="url(#grid)"/>`;
/** The browser window every page is drawn inside. */
const chrome = (title, h) =>
  `<g fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" filter="url(#rough)">
  <path d="M22 42L738 39 736 ${h - 22} 24 ${h - 20}z"/><path d="M23 72L736 70"/>
  <circle cx="40" cy="56" r="4"/><circle cx="57" cy="56" r="4"/><circle cx="74" cy="56" r="4"/></g>
  <g font-family="Chalkboard, Comic Sans MS, cursive" fill="#4e5753"><text x="330" y="61" font-size="16">${title}</text>`;
const end = '</g></svg>';
const box = (x, y, w, h, fill = 'none', stroke = '#6d746d', width = 2) =>
  `<path d="M${x} ${y + 2}L${x + w} ${y} ${x + w - 1} ${y + h} ${x + 1} ${y + h - 1}z" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
const rule = (x, y, w, colour = faint) =>
  `<path d="M${x} ${y}q${w / 2} -2 ${w} 0" stroke="${colour}" stroke-width="2" fill="none"/>`;
const lines = (x, y, w, n, gap = 15, colour = faint) =>
  Array.from({ length: n }, (_, i) => rule(x, y + i * gap, i === n - 1 ? w * 0.62 : w, colour)).join('');
const say = (x, y, text, size = 17, fill = '#4e5753', anchor = 'start') =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}">${text}</text>`;
const button = (x, y, w, h, label, fill = '#e0e6d8') =>
  box(x, y, w, h, fill) + say(x + w / 2, y + h / 2 + 6, label, 16, '#42503f', 'middle');

// --------------------------------------------------------------- the drawings
// Every pin below is placed from these numbers, so a pin always lands on its element.
const spots = {};
const at = (name, h, x, y) => {
  spots[name] = { x: +(x / W).toFixed(3), y: +(y / h).toFixed(3) };
};

const art = {};

// 1. Home — the landing page a visitor is looking at.
{
  const h = 550;
  at('home-example', h, 560, 250);
  at('home-prompt', h, 232, 448);
  at('home-guide', h, 585, 63);
  at('home-github', h, 683, 63);
  art['01-home.svg'] =
    paper(h) +
    chrome('sketchcoded.com', h) +
    say(46, 106, 'sketchcoded', 21) +
    say(170, 106, '.', 21, '#b95144') +
    say(470, 103, 'Example', 14, faint) +
    say(552, 103, 'Guide', 14, faint) +
    say(616, 103, 'FAQ', 14, faint) +
    say(660, 103, 'GitHub', 14, faint) +
    rule(40, 124, 690, '#d7ddd4') +
    say(46, 190, 'Sketchcoded', 38) +
    say(46, 228, 'Prompts make apps.', 17, '#6c7467') +
    say(46, 254, 'Sketching makes your vision.', 17, '#3d5144') +
    lines(46, 292, 300, 4) +
    box(430, 150, 290, 210, '#c9a97a', '#6d746d') +
    // a tiny board inside the frame: this is the example you can open
    box(452, 172, 76, 58, '#fffef5', '#8a7f68', 1.5) +
    box(556, 190, 76, 58, '#fffef5', '#8a7f68', 1.5) +
    box(500, 268, 76, 58, '#fffef5', '#8a7f68', 1.5) +
    `<path d="M528 200q22 6 28 18" stroke="#b95144" stroke-width="2" fill="none"/>` +
    `<path d="M556 248q-20 10 -22 20" stroke="#b98c43" stroke-width="2" fill="none"/>` +
    say(575, 348, 'Open the board →', 14, '#fffdf4', 'middle') +
    say(430, 382, 'Example: this website, on a board', 14, faint) +
    box(40, 410, 350, 96, '#f4f6ee') +
    say(56, 434, 'Tell your AI', 13, faint) +
    lines(56, 452, 250, 2, 14) +
    button(286, 432, 90, 32, 'Copy') +
    box(430, 410, 290, 96) +
    say(448, 440, 'Runs on your computer.', 16) +
    lines(448, 462, 250, 2, 14) +
    end;
}

// 2. The example board — the page the visitor is on right now.
{
  const h = 550;
  at('board-home', h, 60, 104);
  art['02-board.svg'] =
    paper(h) +
    chrome('sketchcoded.com/demo', h) +
    say(46, 108, 'sketchcoded', 17) +
    say(148, 108, '.', 17, '#b95144') +
    say(196, 106, 'This website, on a board', 14, faint) +
    button(614, 90, 110, 30, 'Test the flow', '#3d5144') +
    box(28, 128, 706, 300, '#c9a97a', '#8a7f68') +
    // frames pinned to the cork, with yarn between them
    box(64, 168, 118, 86, '#fffef5', '#8a7f68', 1.5) +
    box(250, 200, 118, 86, '#fffef5', '#8a7f68', 1.5) +
    box(436, 158, 118, 86, '#fffef5', '#8a7f68', 1.5) +
    box(436, 306, 118, 86, '#fffef5', '#8a7f68', 1.5) +
    box(600, 236, 100, 78, '#fffef5', '#8a7f68', 1.5) +
    `<path d="M182 212q40 26 68 20" stroke="#b95144" stroke-width="2.4" fill="none"/>` +
    `<path d="M368 232q36 -22 68 -28" stroke="#b95144" stroke-width="2.4" fill="none"/>` +
    `<path d="M368 258q34 34 68 50" stroke="#b98c43" stroke-width="2.4" fill="none"/>` +
    `<path d="M554 200q34 26 46 42" stroke="#547c91" stroke-width="2.4" fill="none"/>` +
    `<circle cx="123" cy="211" r="5" fill="#b95144"/><circle cx="309" cy="243" r="5" fill="#b95144"/>` +
    `<circle cx="495" cy="201" r="5" fill="#b95144"/>` +
    say(72, 162, 'Home', 13, '#5e5b3f') +
    say(258, 194, 'Guide', 13, '#5e5b3f') +
    say(444, 152, 'FAQ', 13, '#5e5b3f') +
    say(444, 300, 'Set up', 13, '#5e5b3f') +
    say(608, 230, 'Running', 13, '#5e5b3f') +
    box(316, 446, 130, 34, '#f4f6ee') +
    say(381, 468, '−   88%   +', 15, '#4e5753', 'middle') +
    say(40, 508, 'Drag a frame · click a screen to walk it · reload to put it back', 13, faint) +
    end;
}

// 3. Guide.
{
  const h = 550;
  at('guide-example', h, 258, 214);
  at('guide-faq', h, 118, 390);
  at('guide-home', h, 60, 104);
  art['03-guide.svg'] =
    paper(h) +
    chrome('sketchcoded.com/guide', h) +
    say(46, 108, 'sketchcoded', 17) +
    say(148, 108, '.', 17, '#b95144') +
    rule(40, 124, 690, '#d7ddd4') +
    say(46, 168, 'The guide', 30) +
    lines(46, 196, 360, 2, 15) +
    box(40, 238, 190, 250, '#f4f6ee') +
    say(56, 266, 'What it is', 14) +
    say(56, 296, 'The example', 14) +
    say(56, 326, 'Set up', 14) +
    say(56, 356, 'The checks', 14) +
    say(56, 386, 'FAQ', 14) +
    say(56, 416, 'What the AI gets', 14) +
    box(250, 238, 470, 108) +
    say(268, 266, 'Draw it, pin it, tie it together', 16) +
    lines(268, 288, 420, 3, 16) +
    box(250, 360, 470, 128) +
    say(268, 390, 'The example board', 16) +
    lines(268, 412, 420, 2, 16) +
    button(268, 440, 130, 32, 'Open it →') +
    end;
}

// 4. FAQ.
{
  const h = 430;
  at('faq-setup', h, 400, 344);
  at('faq-guide', h, 60, 104);
  art['04-faq.svg'] =
    paper(h) +
    chrome('sketchcoded.com/guide#faq', h) +
    say(46, 108, 'sketchcoded', 17) +
    say(148, 108, '.', 17, '#b95144') +
    rule(40, 124, 690, '#d7ddd4') +
    say(46, 164, 'FAQ', 28) +
    [
      'Does it need an API key?',
      'Where do my sketches live?',
      'Can I use it with any AI?',
      'What does it hand the AI?',
    ]
      .map((q, i) => box(40, 188 + i * 44, 680, 36) + say(58, 212 + i * 44, q, 15) + say(700, 212 + i * 44, '+', 16, faint, 'end'))
      .join('') +
    box(40, 364, 680, 44, '#f4f6ee') +
    say(58, 390, 'No account, no key, nothing uploaded.', 15) +
    button(560, 326, 140, 34, 'Set it up →') +
    end;
}

// 5. Sketchcoded running on your computer — where the journey ends.
{
  const h = 430;
  art['05-running.svg'] =
    paper(h) +
    chrome('your computer', h) +
    box(40, 92, 680, 120, '#20281f', '#20281f') +
    say(58, 124, '$ npm run dev', 15, '#cfe0c6') +
    say(58, 152, 'Sketchcoded is ready →', 15, '#9db894') +
    say(240, 152, 'http://127.0.0.1:5173', 15, '#cfe0c6') +
    say(58, 180, 'Projects saved in .drawcode', 14, '#7f9078') +
    box(40, 232, 680, 156, '#c9a97a', '#8a7f68') +
    box(70, 258, 120, 90, '#fffef5', '#8a7f68', 1.5) +
    box(250, 272, 120, 90, '#fffef5', '#8a7f68', 1.5) +
    box(430, 252, 120, 90, '#fffef5', '#8a7f68', 1.5) +
    `<path d="M190 300q38 20 60 18" stroke="#b95144" stroke-width="2.4" fill="none"/>` +
    `<path d="M370 312q34 -30 60 -38" stroke="#547c91" stroke-width="2.4" fill="none"/>` +
    say(580, 306, 'your own board', 15, '#5e5b3f') +
    end;
}

// ------------------------------------------------------------------ the board
const drawing = (file, height) => ({
  id: file.slice(0, 2),
  name: file,
  file,
  width: W,
  height,
  importedAt: '2026-09-27T00:00:00.000Z',
});
const assets = [
  drawing('01-home.svg', 550),
  drawing('02-board.svg', 550),
  drawing('03-guide.svg', 550),
  drawing('04-faq.svg', 430),
  drawing('05-running.svg', 430),
];
const screen = (id, code, assetId, title, purpose, extra = {}) => ({
  id,
  code,
  assetId,
  title,
  purpose,
  entry: false,
  role: 'screen',
  ...extra,
});
const screens = [
  screen('home', 'F1', '01', 'Home', 'Where you land: the name, what Sketchcoded is for, the example board, and the prompt you paste into your AI to set it up.', { entry: true }),
  screen('board', 'F2', '02', 'The example board', 'This page. The site drawn as a Sketchcoded board: drag the frames, and click any screen to walk its flow from there.'),
  screen('guide', 'F3', '03', 'The guide', 'How a board becomes a plan, what the automatic checks look for, and what the AI is handed at the end.'),
  screen('faq', 'F4', '04', 'FAQ', 'The short answers: no account, no key, nothing uploaded, and what an AI actually receives.'),
  screen('running', 'F5', '05', 'Sketchcoded on your computer', 'The end of the journey on this site. The app is running locally and your own board is open; everything after this happens on your computer.', { role: 'terminal' }),
];
const pin = (id, screenId, spot, title, description, extra = {}) => ({
  id,
  screenId,
  x: spots[spot].x,
  y: spots[spot].y,
  title,
  description,
  kind: 'interaction',
  ...extra,
});
const pins = [
  pin('open-example', 'home', 'home-example', 'Open the board', 'The example frame on the landing page. It opens this board, read only: you can move the frames and walk the flow, nothing else.'),
  pin('copy-prompt', 'home', 'home-prompt', 'Copy the setup prompt', 'Copies the one paragraph you paste into your AI to install and start Sketchcoded. What happens next depends on whether the machine is ready.'),
  pin('read-guide', 'home', 'home-guide', 'Read the guide', 'Opens the guide, and comes back here.'),
  pin('github', 'home', 'home-github', 'GitHub', 'Leaves this site for the source at https://github.com/OscarBarreraGithub/sketchcoded. A link out is a pin, never a frame.', { kind: 'link' }),
  pin('board-home', 'board', 'board-home', 'Back to the site', 'The brand in the corner returns to the page you came from.'),
  pin('guide-example', 'guide', 'guide-example', 'Open the board', 'The guide points at the same example board.'),
  pin('guide-faq', 'guide', 'guide-faq', 'Jump to the FAQ', 'The contents list scrolls to the questions at the end of the guide.'),
  pin('guide-home', 'guide', 'guide-home', 'Back to the site', 'The brand in the corner returns to the page you came from.'),
  pin('faq-setup', 'faq', 'faq-setup', 'Set it up', 'Takes the reader to the setup prompt and on to a running copy.'),
  pin('faq-guide', 'faq', 'faq-guide', 'Back to the guide', 'Returns to the guide above the questions.'),
];
const yarn = (id, pinId, target, summary, colour, extra = {}) => ({
  id,
  pinId,
  target,
  summary,
  condition: '',
  logic: '',
  context: '',
  fallback: false,
  navigation: 'push',
  color: colour,
  ...extra,
});
const transitions = [
  yarn('to-board', 'open-example', 'board', 'Open the board', 'red'),
  yarn('setup-ready', 'copy-prompt', 'running', 'Node 22.12 or later', 'red', {
    condition: 'The computer has Node 22.12 or later, so the AI can clone the repository and start it.',
    logic: 'The AI installs and runs it; the browser opens on the first board.',
  }),
  yarn('setup-missing', 'copy-prompt', 'guide', 'Something is missing', 'gold', {
    condition: 'Node is missing or too old, or the clone fails.',
    logic: 'Send the reader to the guide, where the requirements and the file structure are written out.',
    fallback: true,
  }),
  yarn('to-guide', 'read-guide', 'guide', 'Read the guide', 'blue'),
  yarn('board-back', 'board-home', null, 'Back to the site', 'olive', { navigation: 'back' }),
  yarn('guide-to-board', 'guide-example', 'board', 'Open the board', 'red'),
  yarn('guide-to-faq', 'guide-faq', 'faq', 'Jump to the FAQ', 'blue'),
  yarn('guide-back', 'guide-home', null, 'Back to the site', 'olive', { navigation: 'back' }),
  yarn('faq-to-running', 'faq-setup', 'running', 'Set it up', 'red'),
  yarn('faq-back', 'faq-guide', null, 'Back to the guide', 'olive', { navigation: 'back' }),
];
const board = {
  name: 'sketchcoded.com',
  screens,
  assets,
  pins,
  transitions,
  layout: {
    home: { x: 40, y: 250, width: 320 },
    board: { x: 480, y: 10, width: 340 },
    guide: { x: 430, y: 560, width: 310 },
    faq: { x: 900, y: 600, width: 290 },
    running: { x: 930, y: 60, width: 310 },
  },
  colorLabels: { red: 'Main path', gold: 'Branch', blue: 'Detour', olive: 'Way back' },
};

await rm(out, { recursive: true, force: true });
await mkdir(path.join(out, 'art'), { recursive: true });
for (const [name, svg] of Object.entries(art)) await writeFile(path.join(out, 'art', name), svg);
await writeFile(path.join(out, 'board.json'), `${JSON.stringify(board, null, 2)}\n`);
console.log(
  `example written: ${screens.length} frames, ${pins.length} pins, ${transitions.length} threads, ${Object.keys(art).length} drawings`,
);
