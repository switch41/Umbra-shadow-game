const KEY = 'umbra.best.v1';

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readAll() {
  const s = storage();
  if (!s) return {};
  try {
    const raw = s.getItem(KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

export function loadBest(levelId) {
  const e = readAll()[levelId];
  return e && Number.isFinite(e.time) && Number.isFinite(e.turns) ? e : null;
}

export function saveBest(levelId, time, turns) {
  const prev = loadBest(levelId);
  const better =
    !prev || time < prev.time || (time === prev.time && turns < prev.turns);
  if (!better) return false;
  const all = readAll();
  all[levelId] = { time, turns };
  const s = storage();
  if (!s) return true;
  try {
    s.setItem(KEY, JSON.stringify(all));
  } catch {
    /* quota / private mode — in-memory result still returned */
  }
  return true;
}
