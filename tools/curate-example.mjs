/** Hide isolated, undeveloped planning frames while preserving every authored route and drawing. */
export function curateExample(project) {
  const used = new Set();
  for (const pin of project.pins) {
    used.add(pin.screenId);
    if (pin.detailTarget) used.add(pin.detailTarget);
  }
  for (const transition of project.transitions) {
    if (transition.target) used.add(transition.target);
  }
  const screens = project.screens.filter(
    (screen) =>
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
  const pins = project.pins.filter((pin) => ids.has(pin.screenId));
  const pinIds = new Set(pins.map((pin) => pin.id));
  return {
    ...project,
    screens,
    pins,
    transitions: project.transitions.filter((transition) =>
      pinIds.has(transition.pinId),
    ),
    ideas: project.ideas.filter((idea) => ids.has(idea.screenId)),
    assets: project.assets.filter((asset) => assets.has(asset.id)),
    layout: Object.fromEntries(
      Object.entries(project.layout ?? {}).filter(([id]) => ids.has(id)),
    ),
    standardPages: Object.fromEntries(
      Object.entries(project.standardPages ?? {}).filter(([id]) => ids.has(id)),
    ),
  };
}
