export type WeeklyStudyTime = { week: string; seconds: number };
export function localDateKey(date?: Date): string;
export function localMondayKey(date?: Date): string;
export function addWeeklySeconds(stored: WeeklyStudyTime | null | undefined, delta: number, now?: Date): WeeklyStudyTime;
