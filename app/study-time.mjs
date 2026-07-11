export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function localMondayKey(date = new Date()) {
  const monday = new Date(date);
  const day = (monday.getDay() + 6) % 7;
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - day);
  return localDateKey(monday);
}

export function addWeeklySeconds(stored, delta, now = new Date()) {
  const week = localMondayKey(now);
  const seconds = stored?.week === week && Number.isFinite(stored.seconds) && stored.seconds >= 0 ? stored.seconds : 0;
  return { week, seconds: seconds + Math.max(0, Number.isFinite(delta) ? delta : 0) };
}
