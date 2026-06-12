const actions = new Map();

export function trackAction(userId) {
  const now = Date.now();

  if (!actions.has(userId)) {
    actions.set(userId, []);
  }

  const history = actions.get(userId);

  history.push(now);

  const recent = history.filter(
    t => now - t < 10000
  );

  actions.set(userId, recent);

  return recent.length;
}
