import { validDate, exerciseById, validateDays, dayVolume, completedSets } from './model.js';

export function registerWorkoutTools({ getDay, getDays, navigate, addExercise }) {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();
  const tools = [
    {
      name: 'get_workout_record', title: '날짜별 운동 기록 조회',
      description: 'Read locally stored exercises, sets and total volume for one date. Does not change records.',
      inputSchema: { type: 'object', properties: { date: { type: 'string', description: 'YYYY-MM-DD' } }, required: ['date'], additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute({ date }) { if (!validDate(date)) throw new Error('Invalid date'); const day = getDay(date); return { ...structuredClone(day), totalVolumeKg: dayVolume(day), completedSets: completedSets(day) }; },
    },
    {
      name: 'navigate_workout_date', title: '운동 기록 날짜 열기',
      description: 'Open the workout editor for a date. Does not create or modify a workout.',
      inputSchema: { type: 'object', properties: { date: { type: 'string' } }, required: ['date'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute({ date }) { if (!validDate(date)) throw new Error('Invalid date'); navigate(date); return { date, opened: true }; },
    },
    {
      name: 'add_workout_exercise', title: '운동과 세트 기록하기',
      description: 'Save a new exercise and its weight/repetition sets on a date. Refuses to overwrite an existing exercise. Weight in kg, volume is the sum of each weight times repetitions.',
      inputSchema: { type: 'object', properties: { date: { type: 'string' }, exerciseId: { type: 'string' }, sets: { type: 'array', minItems: 1, maxItems: 100, items: { type: 'object', properties: { weight: { type: 'number', minimum: 0, maximum: 2000 }, reps: { type: 'integer', minimum: 1, maximum: 999 } }, required: ['weight','reps'], additionalProperties: false } } }, required: ['date','exerciseId','sets'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute({ date, exerciseId, sets }) {
        if (!validDate(date) || !exerciseById(exerciseId)) throw new Error('Invalid date or exercise');
        const [candidate] = validateDays([{ date, exercises: [{ id: exerciseId, sets }] }]);
        if (getDays().find(d => d.date === date)?.exercises.some(e => e.id === exerciseId)) throw new Error('Exercise already exists');
        return addExercise(date, candidate.exercises[0]);
      },
    },
  ];
  for (const tool of tools) {
    try { Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch { /* Optional enhancement; ordinary logging remains available. */ }
  }
  window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
}
