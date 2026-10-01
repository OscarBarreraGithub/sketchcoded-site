/**
 * The public example board. Read only: you can move the frames and walk the flow, nothing else,
 * and nothing is saved — reloading puts every frame back where the board says it belongs.
 *
 * tools/make-example.mjs copies the user's live board and its real drawings. Standard pages
 * come from the application's public snapshot endpoint, exactly as Test flow derives them.
 */
(() => {
  const $ = (name) => document.querySelector(`[data-${name}]`);
  const scroller = $("scroll"),
    stage = $("stage"),
    world = $("world"),
    yarnLayer = $("yarn"),
    cards = $("cards"),
    overlay = $("overlay"),
    loading = $("loading"),
    legend = $("legend"),
    zoomLabel = $("zoom");
  const player = $("player"),
    playerStage = $("player-stage"),
    frameBox = $("frame"),
    shot = $("shot"),
    choice = $("choice"),
    choiceList = $("choice-list");
  const COLORS = {
    red: "#b95144",
    gold: "#b98c43",
    blue: "#547c91",
    olive: "#718060",
    violet: "#7b5e93",
    teal: "#3d8585",
  };
  /** The categories a board starts with, as the app names them; a board may rename them. */
  const CATEGORIES = {
    red: "Main path",
    gold: "Branch",
    blue: "Detour",
    olive: "Way back",
  };
  const ROLES = {
    screen: "SCREEN",
    auth: "AUTHENTICATION",
    modal: "DIALOG",
    terminal: "ENDING",
    detail: "DETAIL REFERENCE",
  };
  const svg = (name, attrs) => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", name);
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
  const ideasOf = (id) =>
    (board.ideas ?? []).filter((i) => i.screenId === id && !i.pinId);
  const shotHeight = (screen) => {
    const a = assetOf(screen),
      width = layout[screen.id].width - 24;
    return a ? (width * a.height) / a.width : width * 0.5;
  };
  const cardHeight = (screen) => 30 + shotHeight(screen) + 46;
  const pinsOf = (id) => board.pins.filter((pin) => pin.screenId === id);
  const yarnOf = (pinId) => board.transitions.filter((t) => t.pinId === pinId);
  const isHistory = (t) =>
    t.navigation === "back" || t.navigation === "dismiss";

  /** Where a label may sit along its yarn, best first: the middle, then out towards the ends. */
  const SPOTS = [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.18, 0.82];
  /**
   * The curve from a pin to the top of the frame it opens, as the app draws it, and the spots its
   * label may take. While the frames stack (on a phone), the yarn takes the route that
   * stackFrames() gave it.
   */
  function curve(t) {
    const pin = byId(board.pins, t.pinId);
    const from = pin && byId(board.screens, pin.screenId);
    const to = t.target && byId(board.screens, t.target);
    if (!pin || !from || !to) return null;
    const a = layout[from.id],
      b = layout[to.id];
    const x1 = a.x + 12 + pin.x * (a.width - 24),
      y1 = a.y + 30 + pin.y * shotHeight(from);
    if (stacked) {
      const route = stacked.routes.get(t);
      if (!route) return null;
      const x2 = b.x + b.width / 2 + route.offset,
        y2 = b.y + 8;
      const corners =
        route.lane === null
          ? [
              [x1, y1],
              [x1, route.band],
              [x2, route.band],
              [x2, y2],
            ]
          : [
              [x1, y1],
              [route.lane, y1],
              [route.lane, route.band],
              [x2, route.band],
              [x2, y2],
            ];
      // The label sits where the yarn turns down into its frame, or further back along the turn.
      const turn = route.lane ?? x1;
      return {
        d: rounded(corners, 24),
        spots: [1, 0.75, 0.5, 0.25].map((s) => ({
          x: turn + (x2 - turn) * s,
          y: route.band,
        })),
      };
    }
    const x2 = b.x + b.width / 2,
      y2 = b.y + 8;
    const parallel = board.transitions.filter(
      (other) =>
        other.pinId === t.pinId &&
        other.target === t.target &&
        !isHistory(other),
    );
    const bend =
      Math.max(50, Math.abs(x2 - x1) * 0.22) +
      Math.max(0, parallel.indexOf(t)) * 52;
    const points = [
      [x1, y1],
      [x1 + (x2 - x1) * 0.3, y1 + bend],
      [x2 - (x2 - x1) * 0.2, y2 + bend],
      [x2, y2],
    ];
    return {
      d: `M ${x1} ${y1} C ${points[1].join(" ")}, ${points[2].join(" ")}, ${x2} ${y2}`,
      spots: SPOTS.map((s) => along(points, s)),
    };
  }
  /** A path through the corners, each one rounded the way yarn bends around a tack. */
  function rounded(corners, radius) {
    const points = corners.filter(
      (p, i) =>
        i === 0 ||
        Math.hypot(p[0] - corners[i - 1][0], p[1] - corners[i - 1][1]) > 0.5,
    );
    let d = `M ${points[0].join(" ")}`;
    for (let i = 1; i < points.length - 1; i++) {
      const [a, b, c] = points.slice(i - 1, i + 2);
      const into = Math.hypot(b[0] - a[0], b[1] - a[1]),
        out = Math.hypot(c[0] - b[0], c[1] - b[1]);
      const r = Math.min(radius, into / 2, out / 2);
      const p = [
        b[0] + ((a[0] - b[0]) * r) / into,
        b[1] + ((a[1] - b[1]) * r) / into,
      ];
      const q = [
        b[0] + ((c[0] - b[0]) * r) / out,
        b[1] + ((c[1] - b[1]) * r) / out,
      ];
      d += ` L ${p.join(" ")} Q ${b.join(" ")} ${q.join(" ")}`;
    }
    return `${d} L ${points.at(-1).join(" ")}`;
  }
  /** A point along the yarn, from 0 at the pin to 1 at the frame it opens. */
  const along = ([a, b, c, d], s) => {
    const r = 1 - s;
    const mix = (i) =>
      r * r * r * a[i] +
      3 * r * r * s * b[i] +
      3 * r * s * s * c[i] +
      s * s * s * d[i];
    return { x: mix(0), y: mix(1) };
  };
  const overlap = (a, b) =>
    Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));

  // ------------------------------------------------------------------- board
  function drawCards() {
    cards.textContent = "";
    const tilts = [-1.3, 0.8, -0.6, 1.5];
    board.screens.forEach((screen, i) => {
      const pos = layout[screen.id],
        a = assetOf(screen);
      const card = el("article", "card");
      card.dataset.screen = screen.id;
      card.style.cssText = `left:${pos.x}px;top:${pos.y}px;width:${pos.width}px;--tilt:${tilts[i % 4]}deg`;
      card.setAttribute("aria-label", `${screen.code} ${screen.title}`);

      const paper = el("div", "card-paper");
      paper.append(el("span", "card-tack"));
      const shotButton = el("button", `card-shot ${a ? "" : "planned"}`);
      shotButton.type = "button";
      shotButton.setAttribute(
        "aria-label",
        `Test the flow from ${screen.title}`,
      );
      if (a) {
        const img = el("img");
        img.src = `example/art/${a.file}`;
        img.alt = screen.title;
        img.draggable = false;
        img.width = a.width;
        img.height = a.height;
        shotButton.append(img);
      } else {
        // A page left to the AI wears the app's post-it, larger; another undrawn page says what
        // waits for its drawing.
        if (screen.leftToAi)
          shotButton.append(
            el("span", "card-post-it", "Leave it up\nto the AI"),
          );
        else {
          const waiting = ideasOf(screen.id).length;
          const note = el("span", "card-waiting");
          note.append(
            el("em", null, "WAITING FOR A DRAWING"),
            el(
              "b",
              null,
              waiting
                ? `${waiting} ${waiting === 1 ? "idea" : "ideas"} planned`
                : "Nothing planned yet",
            ),
          );
          shotButton.append(note);
        }
      }
      pinsOf(screen.id).forEach((pin, index) => {
        // On a drawing, a provisional pin's spot is a placeholder until the user places it.
        if (a && pin.provisional) return;
        const dot = el("span", "pin", String(index + 1));
        dot.style.cssText = `left:${pin.x * 100}%;top:${pin.y * 100}%`;
        shotButton.append(dot);
      });
      paper.append(shotButton);

      const foot = el("div", "card-foot");
      foot.append(
        el("b", "card-code", screen.code),
        el("span", null, ROLES[screen.role] ?? "SCREEN"),
      );
      // A way back is a small mark in the footer, as in the app: its words show on hover or focus.
      for (const t of board.transitions.filter(
        (t) =>
          isHistory(t) && byId(board.pins, t.pinId)?.screenId === screen.id,
      )) {
        const mark = el("span", "way-back-mark", "\u21b6");
        mark.tabIndex = 0;
        mark.setAttribute(
          "aria-label",
          `Way back: ${t.summary || t.navigation}`,
        );
        mark.append(el("span", null, t.summary || t.navigation));
        foot.append(mark);
      }
      paper.append(foot);

      const tape = el("button", "card-tape");
      tape.type = "button";
      tape.append(el("span", null, screen.title));
      if (screen.entry) tape.append(el("span", "card-home", "\u2302"));
      tape.setAttribute("aria-label", `Test the flow from ${screen.title}`);
      card.append(paper, tape);
      cards.append(card);
      dragable(card, screen.id);
      shotButton.addEventListener("click", () => open(screen.id));
      tape.addEventListener("click", () => open(screen.id));
    });
  }

  /** The yarn, its labels and the ways back. Redrawn whenever a frame moves. */
  function drawThreads() {
    yarnLayer.textContent = "";
    overlay.textContent = "";
    for (const t of board.transitions) {
      if (isHistory(t) || !t.target) continue;
      const path = curve(t);
      if (!path) continue;
      yarnLayer.append(
        svg("path", {
          d: path.d,
          fill: "none",
          stroke: "#4d3f2a33",
          "stroke-width": 6,
        }),
        svg("path", {
          d: path.d,
          fill: "none",
          stroke: COLORS[t.color] ?? COLORS.red,
          "stroke-width": 3,
          "stroke-linecap": "round",
        }),
      );
      const label = el("div", "yarn-label", t.summary);
      label.title = t.summary;
      label.style.cssText = `left:${path.spots[0].x}px;top:${path.spots[0].y}px`;
      label.spots = path.spots;
      overlay.append(label);
    }
    placeLabels();
  }

  /**
   * Nothing overlaps: each yarn label slides along its own yarn to the first spot clear of every
   * frame and the labels already placed, starting from the middle. Label size
   * follows the zoom, so this runs again whenever the zoom changes.
   */
  let placedAt = null;
  function placeLabels() {
    placedAt = view.zoom;
    const margin = 6;
    // Measured on the page, so the paper's border, the tilt and the tape are inside the box.
    const origin = world.getBoundingClientRect();
    const taken = [...cards.querySelectorAll(".card")].map((card) => {
      const parts = [card, card.querySelector(".card-tape")].map((node) =>
        node.getBoundingClientRect(),
      );
      const left = Math.min(...parts.map((r) => r.left)),
        top = Math.min(...parts.map((r) => r.top));
      return {
        x: (left - origin.left) / view.zoom,
        y: (top - origin.top) / view.zoom,
        width: (Math.max(...parts.map((r) => r.right)) - left) / view.zoom,
        height: (Math.max(...parts.map((r) => r.bottom)) - top) / view.zoom,
      };
    });
    const clear = (box) => taken.reduce((sum, t) => sum + overlap(box, t), 0);
    // A label with no clear spot anywhere on its yarn waits as a small mark; hovering or
    // focusing it shows the words.
    for (const label of overlay.querySelectorAll(".yarn-label")) {
      label.classList.remove("as-dot");
      const w = label.offsetWidth + margin * 2,
        h = label.offsetHeight + margin * 2;
      let spot = null;
      for (const p of label.spots) {
        const box = { x: p.x - w / 2, y: p.y - h / 2, width: w, height: h };
        if (!clear(box)) {
          spot = { p, box };
          break;
        }
      }
      label.removeAttribute("tabindex");
      if (!spot) {
        label.classList.add("as-dot");
        label.tabIndex = 0;
        const d = label.offsetWidth + margin * 2;
        for (const p of label.spots) {
          const box = { x: p.x - d / 2, y: p.y - d / 2, width: d, height: d };
          if (!spot || !clear(box)) spot = { p, box };
          if (!clear(box)) break;
        }
      }
      label.style.left = `${spot.p.x}px`;
      label.style.top = `${spot.p.y}px`;
      taken.push(spot.box);
    }
  }

  const moveCard = (id) => {
    const card = cards.querySelector(`[data-screen="${id}"]`);
    card.style.left = `${layout[id].x}px`;
    card.style.top = `${layout[id].y}px`;
    drawThreads();
  };

  const apply = () => {
    // Stacked, the column fills the width and the page scrolls, so there is no pan to clamp.
    if (stacked) {
      world.style.transform = `translate(${stacked.offset}px, 0) scale(${view.zoom})`;
      world.style.setProperty("--board-zoom", view.zoom);
      world.classList.remove("far");
      stage.style.height = `${Math.ceil(stacked.height * view.zoom)}px`;
      if (placedAt !== view.zoom) placeLabels();
      updateBoardHint();
      return;
    }
    stage.style.height = "";
    if (board?.screens.length) {
      const r = stage.getBoundingClientRect(),
        pad = 48;
      const left =
        Math.min(...board.screens.map((s) => layout[s.id].x)) * view.zoom;
      const top =
        Math.min(...board.screens.map((s) => layout[s.id].y - 35)) * view.zoom;
      const right =
        Math.max(
          ...board.screens.map((s) => layout[s.id].x + layout[s.id].width),
        ) * view.zoom;
      const bottom =
        Math.max(...board.screens.map((s) => layout[s.id].y + cardHeight(s))) *
        view.zoom;
      const clamp = (v, a, b) =>
        Math.max(Math.min(a, b), Math.min(Math.max(a, b), v));
      view.x = clamp(view.x, pad - left, r.width - pad - right);
      view.y = clamp(view.y, pad - top, r.height - pad - bottom);
      // Sparse layouts may have empty corners inside their bounds. Keep one frame visible.
      let best = null;
      for (const screen of board.screens) {
        const p = layout[screen.id],
          w = p.width * view.zoom,
          h = cardHeight(screen) * view.zoom;
        const x = p.x * view.zoom + view.x,
          y = p.y * view.zoom + view.y;
        const kx = Math.min(120, w, r.width / 2),
          ky = Math.min(120, h, r.height / 2);
        const dx = clamp(x, kx - w, r.width - kx) - x,
          dy = clamp(y, ky - h, r.height - ky) - y;
        if (!best || Math.hypot(dx, dy) < best.distance)
          best = { dx, dy, distance: Math.hypot(dx, dy) };
      }
      if (best) {
        view.x += best.dx;
        view.y += best.dy;
      }
    }
    world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`;
    world.style.setProperty("--board-zoom", view.zoom);
    world.classList.toggle("far", view.zoom < 0.4);
    zoomLabel.textContent = `${Math.round(view.zoom * 100)}%`;
    if (board && placedAt !== view.zoom) placeLabels();
  };

  /** The whole board, centred, with room around it. */
  function fit() {
    const pad = { top: 44, right: 32, bottom: 24, left: 32 };
    const rect = stage.getBoundingClientRect();
    const xs = board.screens.map((s) => layout[s.id].x),
      ys = board.screens.map((s) => layout[s.id].y - 35);
    const right = Math.max(
        ...board.screens.map((s) => layout[s.id].x + layout[s.id].width),
      ),
      // cardHeight already counts the foot; the tape above is why ys starts 35 higher.
      bottom = Math.max(
        ...board.screens.map((s) => layout[s.id].y + cardHeight(s)),
      );
    const box = { x: Math.min(...xs), y: Math.min(...ys) };
    box.width = right - box.x;
    box.height = bottom - box.y;
    const usableW = Math.max(120, rect.width - pad.left - pad.right),
      usableH = Math.max(120, rect.height - pad.top - pad.bottom);
    // Never so far out that the board stops being readable: on a phone it overflows and pans
    // instead, which the hint says. The text on a frame is clamped for the same reason.
    view.zoom = Math.max(
      0.34,
      Math.min(1.4, usableW / box.width, usableH / box.height),
    );
    // When the whole board does not fit (a phone), start where the app starts: the entry frame,
    // with the rest of the board a drag away.
    if (!board) return;
    const entry = board.screens.find((s) => s.entry) ?? board.screens[0];
    const tight =
      box.width * view.zoom > usableW + 2 ||
      box.height * view.zoom > usableH + 2;
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
    card.addEventListener("pointerdown", (e) => {
      // Stacked, a drag scrolls the page; frames stay in their column.
      if (stacked) return;
      if (e.button !== 0 && e.pointerType === "mouse") return;
      const start = {
        x: layout[id].x,
        y: layout[id].y,
        px: e.clientX,
        py: e.clientY,
      };
      let moved = false;
      // No pointer capture here: capturing would retarget the release to the card and swallow the
      // click on the drawing, which is how you walk the flow. Window listeners keep both.
      const move = (ev) => {
        const dx = ev.clientX - start.px,
          dy = ev.clientY - start.py;
        if (!moved && Math.hypot(dx, dy) < 4) return;
        if (!moved) {
          moved = true;
          card.classList.add("dragging");
        }
        layout[id] = {
          ...layout[id],
          x: start.x + dx / view.zoom,
          y: start.y + dy / view.zoom,
        };
        moveCard(id);
      };
      const up = () => {
        removeEventListener("pointermove", move);
        removeEventListener("pointerup", up);
        removeEventListener("pointercancel", up);
        card.classList.remove("dragging");
        // A drag is not a click: swallow the one the release is about to produce.
        if (moved) {
          const swallow = (click) => {
            click.stopPropagation();
            click.preventDefault();
          };
          card.addEventListener("click", swallow, {
            capture: true,
            once: true,
          });
          setTimeout(
            () => card.removeEventListener("click", swallow, { capture: true }),
            60,
          );
        }
      };
      addEventListener("pointermove", move);
      addEventListener("pointerup", up);
      addEventListener("pointercancel", up);
    });
  }

  const pointers = new Map();
  let pan = null,
    pinch = null;
  stage.addEventListener("pointerdown", (e) => {
    if (stacked || e.target.closest(".card")) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    stage.setPointerCapture(e.pointerId);
    if (pointers.size === 1) {
      pan = { x: view.x, y: view.y, px: e.clientX, py: e.clientY };
      stage.classList.add("panning");
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: view.zoom };
      pan = null;
    }
  });
  stage.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const rect = stage.getBoundingClientRect();
      const mid = {
        x: (a.x + b.x) / 2 - rect.left,
        y: (a.y + b.y) / 2 - rect.top,
      };
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
      stage.classList.remove("panning");
    }
  };
  stage.addEventListener("pointerup", letGo);
  stage.addEventListener("pointercancel", letGo);
  stage.addEventListener(
    "wheel",
    (e) => {
      // Leave the browser's own zoom alone, and a stacked board to scroll as a page does.
      if (stacked || e.ctrlKey || e.metaKey) return;
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
  $("zoom-in").addEventListener("click", () => zoomAt(1.2));
  $("zoom-out").addEventListener("click", () => zoomAt(1 / 1.2));
  $("fit").addEventListener("click", fit);
  /** Where the board opens: the view its author left it on, or the whole board without one. */
  function start() {
    const v = board.viewport;
    if (!v || !(v.zoom > 0)) return fit();
    view = { x: v.x, y: v.y, zoom: Math.max(0.2, Math.min(2.5, v.zoom)) };
    apply();
  }
  // Until someone moves the board, a resized window shows the opening view again.
  let started = false,
    moved = false;
  for (const type of ["pointerdown", "wheel"])
    stage.addEventListener(type, () => (moved = true), { passive: true });
  for (const name of ["zoom-in", "zoom-out", "fit"])
    $(name).addEventListener("click", () => (moved = true));
  addEventListener("resize", () => {
    if (!started) return;
    // Crossing into or out of a phone's width, or turning a phone, lays the frames out again.
    if (phone.matches !== !!stacked || (stacked && innerWidth !== arrangedAt))
      return arrange();
    if (stacked) return;
    if (moved) apply();
    else start();
  });

  // ------------------------------------------------------------- on a phone
  /**
   * A phone is too narrow for the board as its author laid it out, so there the frames stack in
   * one column, in the order a visitor meets them: the entry, then the pages its pins lead to, in
   * pin order, and so on; frames nothing leads to follow in the board's reading order. The page
   * scrolls instead of panning. Yarn to the next frame drops straight to it; yarn that skips
   * frames runs down a lane at the left, the longest furthest out. Each thread turns into its
   * frame just under its label, above the frame's tape. As on the board, nothing is saved.
   */
  const phone = matchMedia("(max-width: 599px)"),
    touch = matchMedia("(pointer: coarse)");
  let stacked = null,
    arrangedAt = 0;
  // Some browsers send the resize before the media query has caught up, so also follow the query.
  phone.addEventListener("change", () => started && arrange());
  /** World units: the room between frames (label band and tape), and the yarn lane. */
  const STACK = { gap: 112, first: 48, band: 70, edge: 12, spacing: 9 };
  const onward = (screenId) =>
    pinsOf(screenId).flatMap((pin) =>
      yarnOf(pin.id).filter(
        (t) => !isHistory(t) && t.target && byId(board.screens, t.target),
      ),
    );
  function stackFrames() {
    const order = [],
      seen = new Set();
    const visit = (first) => {
      const from = order.length;
      seen.add(first.id);
      order.push(first);
      for (let i = from; i < order.length; i++)
        for (const t of onward(order[i].id))
          if (!seen.has(t.target)) {
            seen.add(t.target);
            order.push(byId(board.screens, t.target));
          }
    };
    const placed = (s) => board.layout[s.id];
    visit(board.screens.find((s) => s.entry) ?? board.screens[0]);
    for (const s of [...board.screens].sort(
      (a, b) => placed(a).y - placed(b).y || placed(a).x - placed(b).x,
    ))
      if (!seen.has(s.id)) visit(s);

    const row = new Map(order.map((s, i) => [s.id, i]));
    const threads = order.flatMap((s) =>
      onward(s.id).map((t) => ({
        t,
        from: row.get(s.id),
        to: row.get(t.target),
      })),
    );
    // Rows, top to bottom; x waits for the lane's width.
    const next = {};
    let y = 0;
    order.forEach((s, i) => {
      const into = threads.some((r) => r.to === i);
      y += i === 0 && !into ? STACK.first : STACK.gap;
      next[s.id] = { x: 0, y, width: placed(s).width };
      layout = next;
      y += cardHeight(s);
    });
    // Each thread into a frame gets its own turn; two into one frame sit side by side.
    const routes = new Map();
    order.forEach((s, i) => {
      const into = threads.filter((r) => r.to === i);
      into.forEach((r, j) => {
        const shift = j - (into.length - 1) / 2;
        routes.set(r.t, {
          lane: null,
          band: next[s.id].y - STACK.band + shift * 10,
          offset: shift * 14,
        });
      });
    });
    // Lane slots: the shortest runs nearest the frames, so a thread turning in crosses none that
    // is still on its way down. Runs that never share a stretch of the lane share a slot.
    const pinY = (r) => {
      const pin = byId(board.pins, r.t.pinId),
        s = order[r.from];
      return next[s.id].y + 30 + pin.y * shotHeight(s);
    };
    const runs = threads
      .filter((r) => r.to !== r.from + 1)
      .map((r) => {
        const ends = [pinY(r), routes.get(r.t).band];
        return { r, lo: Math.min(...ends), hi: Math.max(...ends) };
      })
      .sort((a, b) => a.hi - a.lo - (b.hi - b.lo));
    const taken = [];
    for (const run of runs) {
      run.slot = 0;
      while (
        taken.some(
          (o) =>
            o.slot === run.slot && o.lo < run.hi + 20 && run.lo < o.hi + 20,
        )
      )
        run.slot++;
      taken.push(run);
    }
    const slots = Math.max(0, ...runs.map((run) => run.slot + 1));
    const lane = slots ? STACK.edge * 2 + (slots - 1) * STACK.spacing : 16;
    for (const s of order) next[s.id].x = lane;
    for (const run of runs)
      routes.get(run.r.t).lane = lane - STACK.edge - run.slot * STACK.spacing;
    const width = lane + Math.max(...order.map((s) => next[s.id].width)) + 8;
    return { routes, width, height: y + 40 };
  }
  /** Lays the board out for the window: stacked on a phone, otherwise as its author left it. */
  function arrange() {
    document.body.classList.toggle("stacked", phone.matches);
    arrangedAt = innerWidth;
    if (phone.matches) {
      stacked = stackFrames();
      const room = stage.clientWidth;
      view.zoom = Math.min(1, (room - 16) / stacked.width);
      stacked.offset = (room - stacked.width * view.zoom) / 2;
    } else {
      if (stacked) layout = JSON.parse(JSON.stringify(board.layout));
      stacked = null;
    }
    placedAt = null;
    drawCards();
    if (stacked) apply();
    else start();
    drawThreads();
  }
  // Stacked, the arrow says there is more board below until the visitor starts scrolling.
  const boardHint = $("board-hint");
  function updateBoardHint() {
    boardHint.hidden =
      !stacked ||
      scroller.scrollTop > 2 ||
      scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop < 3;
  }
  scroller.addEventListener("scroll", updateBoardHint, { passive: true });
  new ResizeObserver(updateBoardHint).observe(scroller);
  boardHint.addEventListener("click", () =>
    scroller.scrollBy({ top: scroller.clientHeight * 0.7, behavior: "smooth" }),
  );

  // ----------------------------------------------------- walking the flow
  let stack = [];
  let steps = 0;
  let details = [];
  let mobile = false;
  let arrivedVia = [];
  const playerAsset = (screen) =>
    byId(
      board.assets,
      mobile && screen.mobileAssetId ? screen.mobileAssetId : screen.assetId,
    );
  const shownScreen = () =>
    byId(board.screens, details.at(-1) ?? current()?.screenId);
  const current = () => stack[stack.length - 1];
  // A percentage height against an auto-height parent resolves to nothing, so the drawing is
  // sized to the stage in both directions instead, the way the app sizes it.
  let stageSize = { width: 0, height: 0 };
  new ResizeObserver(() => {
    stageSize = {
      width: playerStage.clientWidth,
      height: playerStage.clientHeight,
    };
    if (!player.hidden) sizeFrame();
  }).observe(playerStage);
  const updateScrollHint = () => {
    $("scroll-hint").hidden =
      player.hidden ||
      playerStage.scrollHeight -
        playerStage.clientHeight -
        playerStage.scrollTop <
        3;
  };
  playerStage.addEventListener("scroll", updateScrollHint);
  $("scroll-hint").addEventListener("click", () =>
    playerStage.scrollBy({
      top: playerStage.clientHeight * 0.7,
      behavior: "smooth",
    }),
  );
  new ResizeObserver(updateScrollHint).observe(frameBox);
  // Pins sit on the drawing, not on the whole frame, which may also hold the pins still to place.
  new ResizeObserver(() => {
    const box = { x: shot.offsetLeft, y: shot.offsetTop };
    Object.assign(box, { w: shot.offsetWidth, h: shot.offsetHeight });
    for (const [key, value] of Object.entries(box))
      frameBox.style.setProperty(`--shot-${key}`, `${value}px`);
  }).observe(shot);
  new ResizeObserver(() => {
    if (!player.hidden) sizeFrame();
    updateScrollHint();
  }).observe($("note"));
  function sizeFrame() {
    const screen = shownScreen();
    const a = screen && playerAsset(screen);
    if (!a || !stageSize.width) {
      frameBox.style.width = "";
      return;
    }
    const pad = 20;
    const aspect = a.width / a.height;
    // As in the app, a drawing never shrinks until its pins pile up: its long side keeps 420px,
    // and past that the stage scrolls. A phone is narrower than that, and scrolling a drawing
    // sideways by touch is awkward, so there the drawing fits the width instead, down to 300px,
    // where every pin's centre is still clear of its neighbours. A zoomed laptop keeps the rule.
    let least = Math.min(aspect >= 1 ? 420 : 420 * aspect, a.width) + pad;
    if (phone.matches && touch.matches)
      least = Math.min(least, Math.max(stageSize.width, 300));
    // The drawing shares the stage's height with what sits under it: the pins still to place,
    // inside the frame, and the note below it. Together they fit without scrolling.
    const note = $("note");
    const besides = () => {
      const unplaced = frameBox.querySelector(".player-unplaced");
      return (
        (note.offsetHeight
          ? note.offsetHeight + parseFloat(getComputedStyle(playerStage).rowGap)
          : 0) +
        (unplaced
          ? unplaced.offsetHeight +
            parseFloat(getComputedStyle(unplaced).marginTop)
          : 0)
      );
    };
    const fit = () =>
      Math.max(
        160,
        least,
        Math.floor(
          Math.min(
            stageSize.width,
            (stageSize.height - besides() - pad) * aspect + pad,
          ),
        ),
      );
    frameBox.style.width = `${fit()}px`;
    // The pins still to place rewrap at the new width, so measure them once more.
    frameBox.style.width = `${fit()}px`;
  }

  function open(screenId) {
    if (!board) return;
    details = [];
    mobile = false;
    ({ stack, via: arrivedVia } = arrival(screenId));
    steps = 0;
    player.hidden = false;
    document.body.style.overflow = "hidden";
    show();
    $("close").focus();
  }
  function close() {
    player.hidden = true;
    choice.hidden = true;
    $("play").focus();
  }

  function show() {
    const screen = shownScreen();
    const a = playerAsset(screen);
    frameBox.classList.toggle("planned", !a);
    $("code").textContent = screen.code;
    $("title").textContent = screen.title;
    $("kind").hidden = current().kind !== "modal";
    $("steps").textContent = `${steps} ${steps === 1 ? "step" : "steps"}`;
    $("close-detail").hidden = !details.length;
    $("layout").hidden = !screen.mobileAssetId;
    $("layout").textContent = mobile
      ? "Show web drawing"
      : "Show mobile drawing";
    shot.hidden = !a;
    if (a) {
      shot.src = `example/art/${a.file}`;
      shot.alt = screen.title;
    }
    frameBox.querySelectorAll(".plan-page").forEach((node) => node.remove());
    if (!a) renderPlan(screen);
    frameBox
      .querySelectorAll(".player-pin, .player-unplaced, .pin-note")
      .forEach((pin) => pin.remove());
    // An undrawn page lists its ways onward among what it should do (renderPlan).
    const pins = !a
      ? []
      : pinsOf(screen.id).filter(
          (pin) => !details.length || pin.kind === "detail",
        );
    const unplaced = el("div", "player-unplaced");
    const onMobile = mobile && screen.mobileAssetId;
    // As in the app: a pin missing from this drawing (not on the mobile drawing, or still at its
    // provisional placeholder) waits beside it as a button.
    if (a && pins.some((pin) => (onMobile ? !pin.mobile : pin.provisional)))
      unplaced.append(
        el(
          "span",
          null,
          onMobile
            ? "Not placed on the mobile drawing yet:"
            : "Not placed on the drawing yet:",
        ),
      );
    pins.forEach((pin) => {
      const i = pinsOf(screen.id).findIndex((p) => p.id === pin.id);
      if (onMobile ? !pin.mobile : pin.provisional) {
        const button = el("button", "button", `${i + 1}. ${pin.title}`);
        button.addEventListener("click", () => tryPin(pin));
        unplaced.append(button);
        return;
      }
      const dot = el("button", "player-pin", String(i + 1));
      dot.type = "button";
      const pos = mobile && pin.mobile ? pin.mobile : pin;
      dot.style.cssText = `left:calc(var(--shot-x) + ${pos.x} * var(--shot-w));top:calc(var(--shot-y) + ${pos.y} * var(--shot-h))`;
      dot.title = pin.title;
      dot.setAttribute("aria-label", `Try ${pin.title}`);
      dot.dataset.pin = pin.id;
      dot.addEventListener("click", () => tryPin(pin));
      frameBox.append(dot);
    });
    if (unplaced.children.length) frameBox.append(unplaced);
    // An undrawn page is only its plan: no note under it.
    $("note").hidden = !a;
    $("note").textContent = pins.length
      ? "Click a numbered pin to take a path."
      : "Nothing leads on from here. Step back, or return to the board.";
    if (a && !steps && arrivedVia.length)
      $("note").textContent =
        `Arrived from ${arrivedVia.map((id) => byId(board.screens, id).title).join(" → ")}, the way a visitor gets here. ` +
        $("note").textContent;
    sizeFrame();
    playerStage.scrollTop = 0;
    requestAnimationFrame(updateScrollHint);
  }

  /**
   * A page with no drawing yet, as its author wrote it: a one-line summary, then what they want
   * the page to do. A line that is a way onward follows its yarn.
   */
  function renderPlan(screen) {
    const page = el("section", "plan-page");
    const summary = screen.summary ?? screen.purpose;
    if (summary) page.append(el("p", "plan-summary", summary));
    const wants = screen.wants ?? [];
    if (wants.length) {
      page.append(el("p", "plan-lead", "I want this page to:"));
      const list = el("ul");
      for (const want of wants) {
        const item = el("li");
        if (want.pinId) {
          const go = el("button", "plan-go", want.text);
          go.type = "button";
          go.addEventListener("click", () =>
            tryPin(byId(board.pins, want.pinId)),
          );
          item.append(go);
        } else item.textContent = want.text;
        list.append(item);
      }
      page.append(list);
    }
    frameBox.append(page);
  }
  /**
   * A pin that does not lead to another frame says what it is, beside the pin: its title, then
   * its description, with a link pin's address as a link. Clicking elsewhere closes it.
   */
  function pinNote(pin, fallback) {
    frameBox.querySelector(".pin-note")?.remove();
    const note = el("div", "pin-note");
    note.setAttribute("role", "status");
    note.append(el("strong", null, pin.title || "Untitled pin"));
    const text = pin.description || fallback;
    if (text) {
      const line = el("p");
      const url = pin.kind === "link" && text.match(LINK)?.[0];
      if (url) {
        const [before, after] = text.split(url);
        const a = el("a", null, url);
        a.href = url.startsWith("www.") ? `https://${url}` : url;
        a.target = "_blank";
        a.rel = "noreferrer";
        line.append(before, a, after ?? "");
      } else line.textContent = text;
      note.append(line);
    }
    const dot = frameBox.querySelector(`[data-pin="${CSS.escape(pin.id)}"]`);
    if (!dot) {
      $("note").hidden = false;
      $("note").textContent = `${pin.title}${text ? `: ${text}` : ""}`;
      return;
    }
    const pos = mobile && pin.mobile ? pin.mobile : pin;
    note.style.cssText = dot.style.cssText;
    note.classList.toggle("flip-x", pos.x > 0.55);
    note.classList.toggle("flip-y", pos.y > 0.6);
    frameBox.append(note);
    // Keep it inside the part of the walk that is in view, however the drawing is scrolled.
    const box = note.getBoundingClientRect(),
      view = playerStage.getBoundingClientRect(),
      edge = 8;
    const dx =
      Math.max(0, view.left + edge - box.left) -
      Math.max(0, box.right - (view.right - edge));
    const dy =
      Math.max(0, view.top + edge - box.top) -
      Math.max(0, box.bottom - (view.bottom - edge));
    note.style.marginLeft = `${dx}px`;
    note.style.marginTop = `${dy}px`;
  }
  const LINK = /https?:\/\/[^\s)\]}>"']+|\bwww\.[^\s)\]}>"']+/i;
  frameBox.addEventListener("click", (e) => {
    if (!e.target.closest(".player-pin, .pin-note"))
      frameBox.querySelector(".pin-note")?.remove();
  });
  function tryPin(pin) {
    if (pin.kind === "annotation")
      return pinNote(pin, "This stays on the current screen.");
    if (pin.kind === "link")
      return pinNote(pin, "This link needs an address in its description.");
    if (pin.kind === "detail") {
      if (!byId(board.screens, pin.detailTarget))
        return pinNote(pin, "This detail needs an attached drawing.");
      details.push(pin.detailTarget);
      show();
      return;
    }
    const options = yarnOf(pin.id);
    if (!options.length) return pinNote(pin, "No path is tied to it yet.");
    frameBox.querySelector(".pin-note")?.remove();
    if (options.length === 1) return take(options[0]);
    $("choice-title").textContent = pin.title;
    $("choice-detail").textContent = pin.description ?? "";
    choiceList.textContent = "";
    for (const t of options) {
      const button = el("button", "branch");
      button.type = "button";
      const target = t.target ? byId(board.screens, t.target) : null;
      button.append(
        el("strong", null, t.summary || "Unnamed path"),
        el("small", null, t.condition || "No condition written."),
        el(
          "em",
          null,
          `${target ? `${target.code} ${target.title}` : "The previous screen"}${t.fallback ? " · fallback" : ""}`,
        ),
      );
      button.addEventListener("click", () => {
        choice.hidden = true;
        take(t);
      });
      choiceList.append(button);
    }
    choice.hidden = false;
    choiceList.querySelector("button")?.focus();
  }

  /** One authored step on a history, as the app's shared navigation takes it. */
  function step(from, t) {
    let next = from.map((frame) => ({ ...frame }));
    if (t.navigation === "back") {
      if (next.length < 2)
        return { error: "There is no previous screen in this app history." };
      next.pop();
    } else if (t.navigation === "dismiss") {
      const modal = next.findLastIndex((frame) => frame.kind === "modal");
      if (modal < 1)
        return { error: "There is no dialog caller to dismiss to." };
      next = next.slice(0, modal);
    } else {
      if (!byId(board.screens, t.target))
        return { error: "This destination is missing." };
      const frame = {
        screenId: t.target,
        kind: t.navigation === "modal" ? "modal" : "page",
      };
      if (t.navigation === "reset") next = [frame];
      else {
        if (t.navigation === "replace") frame.kind = next.pop().kind;
        // As in the app, Back never goes in circles: going to a screen already in the history
        // takes the history back to it.
        const earlier = next.findIndex((f) => f.screenId === frame.screenId);
        if (earlier >= 0) {
          frame.kind = next[earlier].kind;
          next = next.slice(0, earlier);
        }
        next.push(frame);
      }
    }
    return { next };
  }
  function take(t) {
    const { next, error } = step(stack, t);
    if (error) {
      $("note").textContent = error;
      return;
    }
    stack = next;
    steps += 1;
    details = [];
    show();
  }

  /**
   * Starting away from an entry: arrive the way a visitor would, along the shortest authored
   * route from an entry, as the app does, so a page's own Back and Close lead where they really
   * do. The route only sets up history; it is not a test step.
   */
  function arrival(screenId) {
    const alone = { stack: [{ screenId, kind: "page" }], via: [] };
    const entries = board.screens
      .filter((s) => s.entry && s.role !== "detail")
      .map((s) => s.id);
    if (!entries.length || entries.includes(screenId)) return alone;
    const onward = (from) =>
      board.transitions.filter((t) => {
        const pin = byId(board.pins, t.pinId);
        return (
          pin?.screenId === from &&
          (pin.kind ?? "interaction") === "interaction" &&
          !isHistory(t) &&
          byId(board.screens, t.target)
        );
      });
    const reachedBy = new Map(entries.map((id) => [id, null]));
    const queue = [...entries];
    for (let i = 0; i < queue.length && !reachedBy.has(screenId); i++)
      for (const t of onward(queue[i]))
        if (!reachedBy.has(t.target)) {
          reachedBy.set(t.target, t);
          queue.push(t.target);
        }
    if (!reachedBy.has(screenId)) return alone;
    const route = [];
    for (let at = screenId, t = reachedBy.get(at); t; t = reachedBy.get(at)) {
      route.unshift(t);
      at = byId(board.pins, t.pinId).screenId;
    }
    let history = [
      { screenId: byId(board.pins, route[0].pinId).screenId, kind: "page" },
    ];
    const via = [history[0].screenId];
    for (const t of route) {
      history = step(history, t).next;
      via.push(t.target);
    }
    return { stack: history, via: via.slice(0, -1) };
  }

  $("play").addEventListener("click", () => {
    if (!board) return;
    const entry = board.screens.find((s) => s.entry) ?? board.screens[0];
    open(entry.id);
  });
  $("close").addEventListener("click", close);
  $("restart").addEventListener("click", () => {
    if (!board) return;
    const entry = board.screens.find((s) => s.entry) ?? board.screens[0];
    open(entry.id);
  });
  // The example has no Rewind test: its pages' own Back and Close, and Restart, cover the walk.
  $("close-detail").addEventListener("click", () => {
    details.pop();
    show();
  });
  $("layout").addEventListener("click", () => {
    mobile = !mobile;
    show();
  });
  $("choice-cancel").addEventListener("click", () => (choice.hidden = true));
  addEventListener("keydown", (e) => {
    if (e.key === "Tab" && !player.hidden) {
      const scope = choice.hidden ? player : choice;
      const controls = [
        ...scope.querySelectorAll("button:not(:disabled), a[href], input"),
      ].filter((el) => el.getClientRects().length);
      const first = controls[0],
        last = controls.at(-1);
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          !scope.contains(document.activeElement))
      ) {
        e.preventDefault();
        last?.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last ||
          !scope.contains(document.activeElement))
      ) {
        e.preventDefault();
        first?.focus();
      }
    }
    if (e.key !== "Escape") return;
    const note = frameBox.querySelector(".pin-note");
    if (note) note.remove();
    else if (!choice.hidden) choice.hidden = true;
    else if (!player.hidden) close();
  });
  playerStage.addEventListener("click", (e) => {
    if (e.target === playerStage) close();
  });

  // -------------------------------------------------------------- the legend
  function drawLegend() {
    const used = Object.keys(COLORS).filter((c) =>
      board.transitions.some((t) => t.color === c),
    );
    legend.textContent = "";
    for (const color of used) {
      const name = board.colorLabels?.[color] || CATEGORIES[color] || color;
      const item = el("span");
      const dot = el("i");
      dot.style.background = COLORS[color];
      item.append(dot, document.createTextNode(name));
      legend.append(item);
    }
  }

  fetch("example/board.json")
    .then((r) => r.json())
    .then((data) => {
      board = data;
      layout = JSON.parse(JSON.stringify(board.layout));
      loading.remove();
      drawLegend();
      arrange();
      started = true;
    })
    .catch(() => {
      loading.textContent =
        "The example board could not be loaded. Reload the page to try again.";
    });
})();
