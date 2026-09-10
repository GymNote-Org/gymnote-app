export const CATEGORIES = ['전체', '가슴', '어깨', '등', '팔', '하체'];
export const EXERCISES = [
  ['chest-press', '체스트 프레스', '가슴'], ['bench-press', '벤치 프레스', '가슴'], ['chest-fly', '체스트 플라이', '가슴'],
  ['military-press', '밀리터리 프레스', '어깨'], ['lateral-raise', '사이드 레터럴 레이즈', '어깨'], ['reverse-fly', '리버스 팩덱 플라이', '어깨'],
  ['lat-pulldown', '랫 풀 다운', '등'], ['seated-row', '시티드 로우', '등'], ['dumbbell-row', '원 암 덤벨 로우', '등'],
  ['triceps-extension', '트라이셉스 익스텐션', '팔'], ['pushdown', '케이블 푸쉬 다운', '팔'], ['dumbbell-curl', '덤벨 컬', '팔'],
  ['leg-press', '레그 프레스', '하체'], ['leg-extension', '레그 익스텐션', '하체'],
].map(([id, name, category]) => ({ id, name, category }));
export const exerciseById = (id) => EXERCISES.find(e => e.id === id);
export const dateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parseDate = (key) => new Date(`${key}T12:00:00`);
export function validDate(key) {
  return typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key) && key >= '1900-01-01' && key <= '2100-12-31' && !isNaN(parseDate(key)) && dateKey(parseDate(key)) === key;
}
export const shiftDate = (key, days) => { const d = parseDate(key); d.setDate(d.getDate() + days); return dateKey(d); };
export const newSet = () => ({ weight: '', reps: '' });
export const blankDay = (date) => ({ date, exercises: [], updatedAt: null });
export const validWeight = (s) => s !== '' && /^\d+(\.\d{1,2})?$/.test(String(s)) && Number(s) >= 0 && Number(s) <= 2000;
export const validReps = (s) => s !== '' && /^\d+$/.test(String(s)) && Number(s) >= 1 && Number(s) <= 999;
export const completeSet = (s) => validWeight(s.weight) && validReps(s.reps);
export const setVolume = (s) => completeSet(s) ? Math.round(Number(s.weight) * 100) * Number(s.reps) / 100 : 0;
export const exerciseVolume = (e) => Math.round(e.sets.reduce((sum, s) => sum + setVolume(s), 0) * 100) / 100;
export const dayVolume = (d) => Math.round(d.exercises.reduce((sum, e) => sum + exerciseVolume(e), 0) * 100) / 100;
export const completedSets = (d) => d.exercises.reduce((sum, e) => sum + e.sets.filter(completeSet).length, 0);
export const totalSets = (d) => d.exercises.reduce((sum, e) => sum + e.sets.length, 0);
export const number = (n) => new Intl.NumberFormat('ko-KR', {maximumFractionDigits: 2}).format(n);
export const inRange = (days, from, to) => days.filter(d => d.date >= from && d.date <= to && d.exercises.length).sort((a,b) => a.date.localeCompare(b.date));
export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function validateDays(days) {
  if (!Array.isArray(days) || days.length > 20000) throw new Error('기록 목록의 형식이 올바르지 않아요.');
  const dates = new Set();
  return days.map(day => {
    if (!day || !validDate(day.date) || dates.has(day.date) || !Array.isArray(day.exercises) || day.exercises.length > EXERCISES.length) throw new Error('날짜 또는 운동 기록 형식이 올바르지 않아요.');
    dates.add(day.date);
    const ids = new Set();
    const exercises = day.exercises.map(e => {
      if (!e || !exerciseById(e.id) || ids.has(e.id) || !Array.isArray(e.sets) || e.sets.length < 1 || e.sets.length > 100) throw new Error('지원하지 않는 운동 또는 세트 형식이에요.');
      ids.add(e.id);
      const sets = e.sets.map(s => {
        if (!s || (s.weight !== '' && !validWeight(s.weight)) || (s.reps !== '' && !validReps(s.reps))) throw new Error('중량 또는 반복 횟수가 올바르지 않아요.');
        return { weight: String(s.weight), reps: String(s.reps) };
      });
      return { id: e.id, sets };
    });
    return { date: day.date, exercises, updatedAt: typeof day.updatedAt === 'string' ? day.updatedAt : null };
  });
}
export function makeBackup(days, from, to) {
  if (!validDate(from) || !validDate(to) || from > to) throw new Error('시작일과 종료일을 확인해 주세요.');
  return JSON.stringify({ app: 'gymnote', version: 1, exportedAt: new Date().toISOString(), from, to, days: inRange(days, from, to) }, null, 2);
}
export function readBackup(text) {
  let backup;
  try { backup = JSON.parse(text); } catch { throw new Error('읽을 수 없는 JSON 파일이에요.'); }
  if (backup?.app !== 'gymnote' || backup?.version !== 1) throw new Error('GYMNOTE v1 백업 파일을 선택해 주세요.');
  return validateDays(backup.days);
}
export function makeCsv(days, from, to) {
  const rows = [['날짜','부위','운동','세트','중량(kg)','반복 횟수','세트 볼륨(kg)','일일 총 볼륨(kg)']];
  for (const day of inRange(days, from, to)) for (const e of day.exercises) e.sets.forEach((s, i) => {
    const info = exerciseById(e.id);
    rows.push([day.date, info.category, info.name, i + 1, s.weight, s.reps, completeSet(s) ? setVolume(s) : '', dayVolume(day)]);
  });
  return '\uFEFF' + rows.map(row => row.map(v => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\r\n');
}
