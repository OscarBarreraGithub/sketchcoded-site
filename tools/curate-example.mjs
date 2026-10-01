/**
 * Shape a board snapshot into the public example.
 *
 * - Frames listed in `omit` (by code) are left out with their pins and ideas. A pin whose only
 *   path led to one of them stays as a note on its drawing, with its own description.
 * - Isolated, undeveloped planning frames are hidden unless `keepPlanned` is set. Every authored
 *   route and drawing is kept.
 * - A frame without a drawing carries `summary`, one line on what the page is for, and `wants`:
 *   what its author wants the page to do, one line per idea and per way onward. Both come from
 *   `pages`, keyed by frame code, then "summary", an idea code or "pin N". A missing summary
 *   falls back to the frame's purpose, a missing line to the idea's or pin's title, and a line
 *   set to null leaves that idea out of the list.
 */
export function curateExample(
  project,
  { omit = [], pages = {}, keepPlanned = false } = {},
) {
  const left = new Set(
    project.screens
      .filter((screen) => omit.includes(screen.code))
      .map((screen) => screen.id),
  );
  const kept = {
    screens: project.screens.filter((screen) => !left.has(screen.id)),
    pins: project.pins.filter((pin) => !left.has(pin.screenId)),
    transitions: project.transitions.filter(
      (transition) => !left.has(transition.target),
    ),
  };
  const used = new Set();
  for (const pin of kept.pins) {
    used.add(pin.screenId);
    if (pin.detailTarget) used.add(pin.detailTarget);
  }
  for (const transition of kept.transitions) {
    if (transition.target) used.add(transition.target);
  }
  const screens = kept.screens.filter(
    (screen) =>
      keepPlanned ||
      screen.entry ||
      screen.assetId ||
      screen.mobileAssetId ||
      screen.leftToAi ||
      used.has(screen.id),
  );
  const ids = new Set(screens.map((screen) => screen.id));
  const assets = new Set(
    screens
      .flatMap((screen) => [screen.assetId, screen.mobileAssetId])
      .filter(Boolean),
  );
  const transitions = kept.transitions.filter((transition) =>
    kept.pins.some(
      (pin) => pin.id === transition.pinId && ids.has(pin.screenId),
    ),
  );
  const pins = kept.pins
    .filter((pin) => ids.has(pin.screenId))
    .map((pin) => {
      const lostItsPath =
        (pin.kind ?? "interaction") === "interaction" &&
        project.transitions.some((t) => t.pinId === pin.id) &&
        !transitions.some((t) => t.pinId === pin.id);
      return lostItsPath ? { ...pin, kind: "annotation" } : pin;
    });
  const ideas = project.ideas.filter((idea) => ids.has(idea.screenId));
  const wants = (screen) => {
    const lines = pages[screen.code] ?? {};
    const own = pins.filter((pin) => pin.screenId === screen.id);
    return [
      ...ideas
        .filter(
          (idea) => idea.screenId === screen.id && lines[idea.code] !== null,
        )
        .map((idea) => ({ text: lines[idea.code] ?? idea.title })),
      ...own
        .map((pin, i) => ({ pin, key: `pin ${i + 1}` }))
        .filter(({ pin }) => transitions.some((t) => t.pinId === pin.id))
        .map(({ pin, key }) => ({
          text: lines[key] ?? pin.title,
          pinId: pin.id,
        })),
    ];
  };
  const { standardPages, ...rest } = project;
  return {
    ...rest,
    screens: screens.map((screen) =>
      screen.assetId
        ? screen
        : {
            ...screen,
            summary: pages[screen.code]?.summary ?? screen.purpose ?? "",
            wants: wants(screen),
          },
    ),
    pins,
    transitions,
    ideas,
    assets: project.assets.filter((asset) => assets.has(asset.id)),
    layout: Object.fromEntries(
      Object.entries(project.layout ?? {}).filter(([id]) => ids.has(id)),
    ),
  };
}

/** Ideas and ways onward on undrawn frames that have no line written for them in `pages`. */
export function unwrittenWants(project, pages = {}) {
  const missing = [];
  for (const screen of project.screens) {
    if (screen.assetId) continue;
    const lines = pages[screen.code] ?? {};
    if (!lines.summary) missing.push(`${screen.code} summary`);
    for (const idea of project.ideas)
      if (idea.screenId === screen.id && lines[idea.code] === undefined)
        missing.push(`${screen.code} ${idea.code} “${idea.title}”`);
    project.pins
      .filter((pin) => pin.screenId === screen.id)
      .forEach((pin, i) => {
        if (
          project.transitions.some((t) => t.pinId === pin.id) &&
          !lines[`pin ${i + 1}`]
        )
          missing.push(`${screen.code} pin ${i + 1} “${pin.title}”`);
      });
  }
  return missing;
}
