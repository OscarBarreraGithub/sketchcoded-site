/**
 * The public example board. Read only: you can move the frames and walk the flow, nothing else,
 * and nothing is saved — reloading puts every frame back where the board says it belongs.
 *
 * The data is the same example board Sketchcoded opens with, written by scripts/make-demo.ts in
 * the app's repository, so the two never drift apart. The geometry (a frame's 30px of tape, the
 * drawing, a 46px foot, and where yarn leaves a pin) matches the app so the board looks the same.
 *
 * Walking the flow here is friendlier than the app on purpose: in the app you press Test flow and
 * start at the beginning; here, clicking any screen starts from that screen.
 */
(() => {
  const $ = (name) => document.querySelector(`[data-${name}]`);
  const stage = $('stage'),
    world = $('world'),
    yarnLayer = $('yarn'),
    cards = $('cards'),
    overlay = $('overlay'),
    loading = $('loading'),
    legend = $('legend'),
    zoomLabel = $('zoom');
  const player = $('player'),
    playerStage = $('player-stage'),
    frameBox = $('frame'),
    shot = $('shot'),
    choice = $('choice'),
    choiceList = $('choice-list');
  const COLORS = {
    red: '#b95144',
    gold: '#b98c43',
    blue: '#547c91',
    olive: '#718060',
    violet: '#7b5e93',
    teal: '#3d8585',
  };
  const ROLES = {
    screen: 'SCREEN',
    auth: 'AUTHENTICATION',
    modal: 'DIALOG',
    terminal: 'ENDING',
    detail: 'DETAIL REFERENCE',
  };
  const svg = (name, attrs) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', name);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  };
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  let board = null;
  /** Positions live here, not in the data, so a reload is a clean slate. */
  let layout = {};
  let view = { x: 0, y: 0, zoom: 1 };
  const byId = (list, id) => list.find((item) => item.id === id);

  // ---------------------------------------------------------------- geometry
  const assetOf = (screen) => byId(board.assets, screen.assetId);
  const ideasOf = (id) => (board.ideas ?? []).filter((i) => i.screenId === id && !i.pinId);
  const shotHeight = (screen) => {
    const a = assetOf(screen),
      width = layout[screen.id].width - 24;
    return a ? (width * a.height) / a.width : width * 0.5;
  };
  const cardHeight = (screen) => 30 + shotHeight(screen) + 46;
  const pinsOf = (id) => board.pins.filter((pin) => pin.screenId === id);
  const yarnOf = (pinId) => board.transitions.filter((t) => t.pinId === pinId);
  const isHistory = (t) => t.navigation === 'back' || t.navigation === 'dismiss';

  /** The curve from a pin to the top of the frame it opens, as the app draws it. */
  function curve(t) {
    const pin = byId(board.pins, t.pinId);
    const from = pin && byId(board.screens, pin.screenId);
    const to = t.target && byId(board.screens, t.target);
    if (!pin || !from || !to) return null;
    const a = layout[from.id],
      b = layout[to.id];
    const x1 = a.x + 12 + pin.x * (a.width - 24),
      y1 = a.y + 30 + pin.y * shotHeight(from);
    const x2 = b.x + b.width / 2,
      y2 = b.y + 8;
    const parallel = board.transitions.filter(
      (other) => other.pinId === t.pinId && other.target === t.target && !isHistory(other),
    );
    const bend = Math.max(50, Math.abs(x2 - x1) * 0.22) + Math.max(0, parallel.indexOf(t)) * 52;
    return {
      d: `M ${x1} ${y1} C ${x1 + (x2 - x1) * 0.3} ${y1 + bend}, ${x2 - (x2 - x1) * 0.2} ${y2 + bend}, ${x2} ${y2}`,
      x: (x1 + x2) / 2,
      y: (y1 + y2) / 2 + bend * 0.75,
    };
  }

  // ------------------------------------------------------------------- board
  function drawCards() {
    cards.textContent = '';
    const tilts = [-1.3, 0.8, -0.6, 1.5];
    board.screens.forEach((screen, i) => {
      const pos = layout[screen.id],
        a = assetOf(screen);
      const card = el('article', 'card');
      card.dataset.screen = screen.id;
      card.style.cssText = `left:${pos.x}px;top:${pos.y}px;width:${pos.width}px;--tilt:${tilts[i % 4]}deg`;
      card.setAttribute('aria-label', `${screen.code} ${screen.title}`);

      const paper = el('div', 'card-paper');
      paper.append(el('span', 'card-tack'));
      const shotButton = el('button', `card-shot ${a ? '' : 'planned'}`);
      shotButton.type = 'button';
      shotButton.setAttribute('aria-label', `Walk the flow from ${screen.title}`);
      if (a) {
        const img = el('img');
        img.src = `example/art/${a.file}`;
        img.alt = screen.title;
        img.draggable = false;
        img.width = a.width;
        img.height = a.height;
        shotButton.append(img);
      } else {
        const waiting = ideasOf(screen.id).length;
        const note = el('span', 'card-waiting');
        note.append(
          el('em', null, 'WAITING FOR A DRAWING'),
          el('b', null, waiting ? `${waiting} ${waiting === 1 ? 'idea' : 'ideas'} planned` : 'Nothing planned yet'),
        );
        shotButton.append(note);
      }
      pinsOf(screen.id).forEach((pin, index) => {
        const dot = el('span', 'pin', String(index + 1));
        dot.style.cssText = `left:${pin.x * 100}%;top:${pin.y * 100}%`;
        shotButton.append(dot);
      });
      paper.append(shotButton);

      const foot = el('div', 'card-foot');
      foot.append(
        el('b', 'card-code', screen.code),
        el('span', null, ROLES[screen.role] ?? 'SCREEN'),
      );
      paper.append(foot);

      const tape = el('button', 'card-tape');
      tape.type = 'button';
      tape.append(el('span', null, screen.title));
      if (screen.entry) tape.append(el('span', 'card-home', '\u2302'));
      tape.setAttribute('aria-label', `Walk the flow from ${screen.title}`);
      card.append(paper, tape);
      cards.append(card);
      dragable(card, screen.id);
      shotButton.addEventListener('click', () => open(screen.id));
      tape.addEventListener('click', () => open(screen.id));
    });
  }

  /** The yarn, its labels and the ways back. Redrawn whenever a frame moves. */
  function drawThreads() {
    yarnLayer.textContent = '';
    overlay.textContent = '';
    for (const t of board.transitions) {
      if (isHistory(t) || !t.target) continue;
      const path = curve(t);
      if (!path) continue;
      yarnLayer.append(
        svg('path', { d: path.d, fill: 'none', stroke: '#4d3f2a33', 'stroke-width': 6 }),
        svg('path', {
          d: path.d,
          fill: 'none',
          stroke: COLORS[t.color] ?? COLORS.red,
          'stroke-width': 3,
          'stroke-linecap': 'round',
        }),
      );
      const label = el('div', 'yarn-label', t.summary);
      label.style.cssText = `left:${path.x}px;top:${path.y}px`;
      overlay.append(label);
    }
    // A way back is not a line: it is a note under the frame it leaves from, as on the board.
    for (const screen of board.screens) {
      const backs = board.transitions.filter(
        (t) => isHistory(t) && byId(board.pins, t.pinId)?.screenId === screen.id,
      );
      backs.forEach((t, i) => {
        const tag = el('div', 'history-tag', `\u21b6 ${t.summary || t.navigation}`);
        const pos = layout[screen.id];
        tag.style.cssText = `left:${pos.x + 15}px;top:${pos.y + cardHeight(screen) + 12 + i * 34}px`;
        overlay.append(tag);
      });
    }
  }

  const moveCard = (id) => {
    const card = cards.querySelector(`[data-screen="${id}"]`);
    card.style.left = `${layout[id].x}px`;
    card.style.top = `${layout[id].y}px`;
    drawThreads();
  };

  const apply = () => {
    world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`;
    world.style.setProperty('--board-zoom', view.zoom);
    world.classList.toggle('far', view.zoom < 0.3);
    zoomLabel.textContent = `${Math.round(view.zoom * 100)}%`;
  };

  /** The whole board, centred, with room around it. */
  function fit() {
    const pad = { top: 74, right: 40, bottom: 84, left: 40 };
    const rect = stage.getBoundingClientRect();
    const xs = board.screens.map((s) => layout[s.id].x),
      ys = board.screens.map((s) => layout[s.id].y - 35);
    const right = Math.max(...board.screens.map((s) => layout[s.id].x + layout[s.id].width)),
      // cardHeight already counts the foot; the tape above is why ys starts 35 higher.
      bottom = Math.max(...board.screens.map((s) => layout[s.id].y + cardHeight(s)));
    const box = { x: Math.min(...xs), y: Math.min(...ys) };
    box.width = right - box.x;
    box.height = bottom - box.y;
    const usableW = Math.max(120, rect.width - pad.left - pad.right),
      usableH = Math.max(120, rect.height - pad.top - pad.bottom);
    // Never so far out that the board stops being readable: on a phone it overflows and pans
    // instead, which the hint says. The text on a frame is clamped for the same reason.
    view.zoom = Math.max(0.34, Math.min(1.4, usableW / box.width, usableH / box.height));
    // When the whole board does not fit (a phone), start where the app starts: the entry frame,
    // with the rest of the board a drag away.
    const entry = board.screens.find((s) => s.entry) ?? board.screens[0];
    const tight = box.width * view.zoom > usableW + 2 || box.height * view.zoom > usableH + 2;
    const centre = tight
      ? {
          x: layout[entry.id].x + layout[entry.id].width / 2,
          y: layout[entry.id].y + cardHeight(entry) / 2,
        }
      : { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    view.x = pad.left + usableW / 2 - centre.x * view.zoom;
    view.y = pad.top + usableH / 2 - centre.y * view.zoom;
    apply();
  }

  const zoomAt = (factor, point) => {
    const rect = stage.getBoundingClientRect();
    const anchor = point ?? { x: rect.width / 2, y: rect.height / 2 };
    const next = Math.max(0.2, Math.min(2.5, view.zoom * factor));
    view.x = anchor.x - ((anchor.x - view.x) * next) / view.zoom;
    view.y = anchor.y - ((anchor.y - view.y) * next) / view.zoom;
    view.zoom = next;
    apply();
  };

  // ------------------------------------------------------- moving the board
  function dragable(card, id) {
    card.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const start = { x: layout[id].x, y: layout[id].y, px: e.clientX, py: e.clientY };
      let moved = false;
      // No pointer capture here: capturing would retarget the release to the card and swallow the
      // click on the drawing, which is how you walk the flow. Window listeners keep both.
      const move = (ev) => {
        const dx = ev.clientX - start.px,
          dy = ev.clientY - start.py;
        if (!moved && Math.hypot(dx, dy) < 4) return;
        if (!moved) {
          moved = true;
          card.classList.add('dragging');
        }
        layout[id] = { ...layout[id], x: start.x + dx / view.zoom, y: start.y + dy / view.zoom };
        moveCard(id);
      };
      const up = () => {
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', up);
        removeEventListener('pointercancel', up);
        card.classList.remove('dragging');
        // A drag is not a click: swallow the one the release is about to produce.
        if (moved) {
          const swallow = (click) => {
            click.stopPropagation();
            click.preventDefault();
          };
          card.addEventListener('click', swallow, { capture: true, once: true });
          setTimeout(() => card.removeEventListener('click', swallow, { capture: true }), 60);
        }
      };
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
      addEventListener('pointercancel', up);
    });
  }

  const pointers = new Map();
  let pan = null,
    pinch = null;
  stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.card, .demo-controls, .demo-legend')) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    stage.setPointerCapture(e.pointerId);
    if (pointers.size === 1) {
      pan = { x: view.x, y: view.y, px: e.clientX, py: e.clientY };
      stage.classList.add('panning');
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: view.zoom };
      pan = null;
    }
  });
  stage.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const rect = stage.getBoundingClientRect();
      const mid = { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top };
      zoomAt((pinch.zoom * (distance / pinch.distance)) / view.zoom, mid);
    } else if (pan) {
      view.x = pan.x + (e.clientX - pan.px);
      view.y = pan.y + (e.clientY - pan.py);
      apply();
    }
  });
  const letGo = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) {
      pan = null;
      stage.classList.remove('panning');
    }
  };
  stage.addEventListener('pointerup', letGo);
  stage.addEventListener('pointercancel', letGo);
  stage.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey || e.metaKey) return; // leave the browser's own zoom alone
      e.preventDefault();
      const rect = stage.getBoundingClientRect();
      if (e.shiftKey) {
        view.x -= e.deltaX;
        view.y -= e.deltaY;
        apply();
      } else {
        zoomAt(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.03 : 0.002)), {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    },
    { passive: false },
  );
  $('zoom-in').addEventListener('click', () => zoomAt(1.2));
  $('zoom-out').addEventListener('click', () => zoomAt(1 / 1.2));
  $('fit').addEventListener('click', fit);
  let fitted = false;
  addEventListener('resize', () => {
    if (fitted) fit();
  });

  // ----------------------------------------------------- walking the flow
  let stack = [];
  let steps = 0;
  const current = () => stack[stack.length - 1];
  // A percentage height against an auto-height parent resolves to nothing, so the drawing is
  // sized to the stage in both directions instead, the way the app sizes it.
  let stageSize = { width: 0, height: 0 };
  new ResizeObserver(() => {
    stageSize = { width: playerStage.clientWidth, height: playerStage.clientHeight };
    if (!player.hidden) sizeFrame();
  }).observe(playerStage);
  function sizeFrame() {
    const screen = byId(board.screens, current()?.screenId);
    const a = screen && assetOf(screen);
    if (!a || !stageSize.width) {
      frameBox.style.width = '';
      return;
    }
    const pad = 20;
    const width = Math.max(
      160,
      Math.floor(Math.min(stageSize.width, (stageSize.height - pad) * (a.width / a.height) + pad)),
    );
    frameBox.style.width = `${width}px`;
  }

  function open(screenId) {
    stack = [{ screenId, kind: 'page' }];
    steps = 0;
    player.hidden = false;
    document.body.style.overflow = 'hidden';
    show();
    $('close').focus();
  }
  function close() {
    player.hidden = true;
    choice.hidden = true;
  }

  function show() {
    const screen = byId(board.screens, current().screenId);
    const a = assetOf(screen);
    frameBox.classList.toggle('planned', !a);
    $('code').textContent = screen.code;
    $('title').textContent = screen.title;
    $('kind').hidden = current().kind !== 'modal';
    $('steps').textContent = `${steps} ${steps === 1 ? 'step' : 'steps'}`;
    $('rewind').disabled = stack.length < 2;
    shot.hidden = !a;
    if (a) {
      shot.src = `example/art/${a.file}`;
      shot.alt = screen.title;
    }
    frameBox.querySelectorAll('.player-waiting').forEach((node) => node.remove());
    if (!a) {
      const waiting = ideasOf(screen.id);
      const panel = el('div', 'player-waiting');
      panel.append(
        el('strong', null, `${screen.title} has no drawing yet.`),
        el('p', null, screen.purpose || ''),
      );
      if (waiting.length) {
        panel.append(el('span', null, 'Planned for this screen:'));
        const list = el('ul');
        for (const idea of waiting.slice(0, 9)) list.append(el('li', null, idea.title));
        if (waiting.length > 9) list.append(el('li', 'more', `and ${waiting.length - 9} more`));
        panel.append(list);
      }
      frameBox.append(panel);
    }
    frameBox.querySelectorAll('.player-pin').forEach((pin) => pin.remove());
    const pins = pinsOf(screen.id);
    pins.forEach((pin, i) => {
      const dot = el('button', 'player-pin', String(i + 1));
      dot.type = 'button';
      dot.style.cssText = `left:calc(10px + ${pin.x} * (100% - 20px));top:calc(10px + ${pin.y} * (100% - 20px))`;
      dot.title = pin.title;
      dot.setAttribute('aria-label', `Try ${pin.title}`);
      dot.addEventListener('click', () => tryPin(pin));
      frameBox.append(dot);
    });
    sizeFrame();
    $('note').textContent = !a
      ? 'This frame is planned, not drawn yet. That is what a board looks like while it is being made.'
      : pins.length
        ? 'Click a numbered pin to take a path.'
        : 'Nothing leads on from here. Step back, or return to the board.';
  }

  function tryPin(pin) {
    const options = yarnOf(pin.id);
    if (!options.length) {
      $('note').textContent = `“${pin.title}” has no path tied to it yet.`;
      return;
    }
    if (options.length === 1) return take(options[0]);
    $('choice-title').textContent = pin.title;
    $('choice-detail').textContent = pin.description ?? '';
    choiceList.textContent = '';
    for (const t of options) {
      const button = el('button', 'branch');
      button.type = 'button';
      const target = t.target ? byId(board.screens, t.target) : null;
      button.append(
        el('strong', null, t.summary || 'Unnamed path'),
        el('small', null, t.condition || 'No condition written.'),
        el(
          'em',
          null,
          `${target ? `${target.code} ${target.title}` : 'The previous screen'}${t.fallback ? ' · fallback' : ''}`,
        ),
      );
      button.addEventListener('click', () => {
        choice.hidden = true;
        take(t);
      });
      choiceList.append(button);
    }
    choice.hidden = false;
  }

  function take(t) {
    if (isHistory(t)) {
      if (stack.length < 2) {
        $('note').textContent =
          'There is no screen behind this one on this path. That is what Review flow would tell you.';
        return;
      }
      stack.pop();
    } else if (t.navigation === 'reset') stack = [{ screenId: t.target, kind: 'page' }];
    else if (t.navigation === 'replace')
      stack[stack.length - 1] = { screenId: t.target, kind: 'page' };
    else stack.push({ screenId: t.target, kind: t.navigation === 'modal' ? 'modal' : 'page' });
    steps += 1;
    show();
  }

  $('play').addEventListener('click', () => {
    const entry = board.screens.find((s) => s.entry) ?? board.screens[0];
    open(entry.id);
  });
  $('close').addEventListener('click', close);
  $('restart').addEventListener('click', () => {
    const entry = board.screens.find((s) => s.entry) ?? board.screens[0];
    open(entry.id);
  });
  $('rewind').addEventListener('click', () => {
    if (stack.length < 2) return;
    stack.pop();
    steps += 1;
    show();
  });
  $('choice-cancel').addEventListener('click', () => (choice.hidden = true));
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!choice.hidden) choice.hidden = true;
    else if (!player.hidden) close();
  });
  playerStage.addEventListener('click', (e) => {
    if (e.target === playerStage) close();
  });

  // -------------------------------------------------------------- the legend
  function drawLegend() {
    const used = Object.keys(COLORS).filter((c) => board.transitions.some((t) => t.color === c));
    legend.textContent = '';
    for (const color of used) {
      const name = board.colorLabels?.[color] ?? color;
      const item = el('span');
      const dot = el('i');
      dot.style.background = COLORS[color];
      item.append(dot, document.createTextNode(name));
      legend.append(item);
    }
  }

  fetch('example/board.json')
    .then((r) => r.json())
    .then((data) => {
      board = data;
      layout = JSON.parse(JSON.stringify(board.layout));
      loading.remove();
      drawCards();
      drawThreads();
      drawLegend();
      fit();
      fitted = true;
    })
    .catch(() => {
      loading.textContent = 'The example board could not be loaded. Reload the page to try again.';
    });
})();
