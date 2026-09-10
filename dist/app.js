import { CATEGORIES, EXERCISES, exerciseById, dateKey, parseDate, shiftDate, validDate, blankDay, newSet, dayVolume, exerciseVolume, setVolume, completeSet, completedSets, totalSets, number, escapeHtml as esc, inRange, makeBackup, makeCsv, readBackup, validWeight, validReps } from './model.js';
import { openDatabase, saveDays, loadDays } from './storage.js';
import { registerWorkoutTools } from './webmcp.js';

const paths = {
  log: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 2v4m6-4v4M9 11h6m-6 4h4"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5m4-1v5l3 2"/>',
  cloud: '<path d="M7 18H6a4 4 0 0 1-.5-8A6.5 6.5 0 0 1 18 8a5 5 0 0 1 0 10h-1M12 20V11m-3 3 3-3 3 3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  barbell: '<path d="M6 6v12M3 9v6m15-9v12m3-9v6M6 12h12"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18m-14 5h2m3 0h2"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 18h4"/>',
  chart: '<path d="M4 20h16M7 16v-5m5 5V4m5 12V8"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.barbell}</svg>`;
const app = document.querySelector('#app');
const dialog = document.querySelector('#dialog');
let days = [], selectedDate = dateKey(), view = 'log', status = 'loading', failure = '', category = '전체', search = '', historyMonth = selectedDate.slice(0,7);
let writeQueue = Promise.resolve(), pendingWrites = 0, toastTimer, installPrompt, stagedImport;
const dirtyDates = new Set();
let backupFrom = `${selectedDate.slice(0,7)}-01`, backupTo = selectedDate, backupFormat = 'json';
const currentDay = () => days.find(d => d.date === selectedDate) || blankDay(selectedDate);
const canEdit = () => status !== 'loading' && status !== 'failed';
const longDate = (key) => parseDate(key).toLocaleDateString('ko-KR', {month: 'long', day:'numeric', weekday:'long'});
const navItems = [['log', '운동 기록', 'log'], ['history', '지난 기록', 'history'], ['backup', '백업 및 내보내기', 'cloud']];

function notify(message) {
  const el = document.querySelector('#toast');
  el.textContent = message; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
}
function saveLabel() {
  return status === 'loading' ? '불러오는 중' : status === 'failed' ? '저장 확인 필요' : document.querySelector('[data-field][aria-invalid="true"]') ? '입력 확인 필요' : pendingWrites ? '저장 중…' : '이 기기에 저장됨';
}
function render() {
  const title = view === 'log' ? '운동 기록' : view === 'history' ? '지난 기록' : '기록을 안전하게';
  app.innerHTML = `<div class="app-shell">
    <aside class="sidebar"><a class="brand" href="#" data-action="home"><img src="./icon.svg" alt="" width="35" height="35">GYMNOTE<span>®</span></a>
      <div class="sidebar-section">MY WORKSPACE</div><nav aria-label="주 메뉴">${navItems.map(([id,label,i]) => `<button class="nav-item ${view === id ? 'active' : ''}" data-view="${id}" ${view === id ? 'aria-current="page"' : ''}>${icon(i)}<span>${label}</span>${view === id ? '<span class="nav-mark"></span>' : ''}</button>`).join('')}</nav>
      <div class="sidebar-bottom"><div class="local-note">${icon('shield')}<div>오직 나의 기록<span>로그인 없이, 이 기기에 저장</span></div></div><button class="install-link" data-action="install">${icon('phone')}홈 화면에 추가${icon('arrow')}</button><div class="version">GYMNOTE <span>VERSION 1.0</span></div></div>
    </aside>
    <main class="workspace"><header class="page-header"><div><div class="eyebrow">YOUR WORK. YOUR PROGRESS.</div><h1>${title}<span class="title-dot">.</span></h1></div><div class="save-status ${status === 'failed' ? 'error' : ''}" role="status">${icon(status === 'failed' ? 'cloud' : 'check')}<span id="save-label">${saveLabel()}</span></div></header>
    <div id="storage-error" class="error-banner" role="alert" ${failure ? '' : 'hidden'}>${esc(failure)}${failure ? ' <button data-action="retry">다시 시도</button>' : ''}</div>
    ${view === 'log' ? renderLog() : view === 'history' ? renderHistory() : renderBackup()}
    <footer class="workspace-footer"><span>한 세트씩, 어제보다 앞으로.</span><span>MAKE EVERY REP COUNT.</span></footer></main>
    <nav class="mobile-nav" aria-label="모바일 주 메뉴">${navItems.map(([id,label,i]) => `<button class="${view === id ? 'active' : ''}" data-view="${id}" ${view === id ? 'aria-current="page"' : ''}>${icon(i)}<span>${id === 'backup' ? '백업' : label}</span></button>`).join('')}</nav></div>`;
}
function renderLog() {
  const day = currentDay();
  const dayLabel = selectedDate === dateKey() ? '오늘' : '이날';
  return `<section class="date-strip" aria-label="기록 날짜"><div class="date-heading"><span class="calendar-icon">${icon('calendar')}</span><div><span class="year-label">${selectedDate.slice(0,4)}</span><h2>${longDate(selectedDate)}${selectedDate === dateKey() ? '<span class="today-badge">오늘</span>' : ''}</h2></div></div><div class="date-controls"><button class="icon-button" data-action="prev-day" aria-label="이전 날짜">${icon('chevron','rotate')}</button><label class="date-picker" aria-label="기록할 날짜 선택"><input type="date" id="selected-date" aria-label="기록할 날짜" value="${selectedDate}" min="1900-01-01" max="2100-12-31">${icon('calendar')}</label><button class="icon-button" data-action="next-day" aria-label="다음 날짜">${icon('chevron')}</button><button class="text-button" data-action="today">오늘</button></div></section>
    <div class="journal-layout"><div class="journal"><div class="section-heading"><h2>${dayLabel}의 운동 <span class="count">${day.exercises.length.toString().padStart(2,'0')}</span></h2><span class="muted">중량 · 횟수 · 세트</span></div>
    <div class="exercise-list">${day.exercises.length ? day.exercises.map(renderExercise).join('') : `<div class="empty-workout"><div class="empty-symbol">${icon('barbell')}</div><span class="eyebrow">A FRESH START</span><h3>오늘의 첫 세트를 기록해 볼까요?</h3><p>운동을 추가하고 중량과 횟수를 입력하세요.<br>작은 기록이 꾸준한 변화를 만들어요.</p><button class="primary-button" data-action="add-exercise" ${canEdit() ? '' : 'disabled'}>${icon('plus')}첫 운동 추가하기</button></div>`}</div>
    ${day.exercises.length ? `<button class="add-exercise-button" data-action="add-exercise" ${canEdit() && day.exercises.length < 14 ? '' : 'disabled'}>${icon('plus')}운동 추가하기<span>${day.exercises.length}/14</span></button>` : ''}
    <div class="record-tip">${icon('shield')}<p>입력한 기록은 자동으로 저장돼요.<br class="mobile-only"> 기기를 바꾸기 전, 백업을 잊지 마세요.</p></div></div>
    <aside class="summary-column"><section class="volume-card"><div class="volume-card-top"><span>TOTAL VOLUME</span>${icon('chart')}</div><div class="volume-number"><strong id="day-volume">${number(dayVolume(day))}</strong><span>kg</span></div><p>${dayLabel} 들어 올린 무게</p><div class="volume-divider"></div><div class="volume-stats"><div><span>운동 종류</span><strong>${day.exercises.length}<small>개</small></strong></div><div><span>기록한 세트</span><strong><b id="completed-sets">${completedSets(day)}</b><small>세트</small></strong></div></div><div class="volume-formula">세트별 중량 × 반복 횟수의 합</div></section>
    ${renderWeek()}<div class="mini-note"><span class="mini-note-index">01 / NOTE</span><p>어제의 나를 넘는 건,<br>오늘의 작은 기록.</p><span class="note-line"></span></div></aside></div>`;
}
function renderExercise(e, index) {
  const info = exerciseById(e.id);
  return `<section class="exercise-card" data-exercise="${e.id}"><div class="exercise-card-header"><span class="exercise-index">${String(index+1).padStart(2,'0')}</span><div class="exercise-title"><span class="category-label">${info.category}</span><h3>${info.name}</h3></div><button class="icon-button subtle" data-action="delete-exercise" data-id="${e.id}" aria-label="${info.name} 삭제">${icon('trash')}</button></div>
    <div class="set-grid set-labels"><span>세트</span><span>중량 <small>kg</small></span><span>반복 <small>회</small></span><span class="set-volume-label">볼륨 <small>kg</small></span><span></span></div>
    ${e.sets.map((s, i) => `<div class="set-grid set-row"><span class="set-index">${i+1}</span><input type="number" inputmode="decimal" min="0" max="2000" step="0.01" placeholder="0" value="${esc(s.weight)}" data-field="weight" data-id="${e.id}" data-set="${i}" aria-label="${info.name} ${i+1}세트 중량 kg" ${canEdit() ? '' : 'disabled'}><input type="number" inputmode="numeric" min="1" max="999" step="1" placeholder="0" value="${esc(s.reps)}" data-field="reps" data-id="${e.id}" data-set="${i}" aria-label="${info.name} ${i+1}세트 반복 횟수" ${canEdit() ? '' : 'disabled'}><span class="set-volume" data-set-volume="${e.id}-${i}">${completeSet(s) ? number(setVolume(s)) : '—'}</span><button class="icon-button subtle remove-set" data-action="delete-set" data-id="${e.id}" data-set="${i}" aria-label="${info.name} ${i+1}세트 삭제" ${e.sets.length === 1 ? 'disabled' : ''}>${icon('close')}</button></div>`).join('')}
    <div class="exercise-card-footer"><button class="text-button" data-action="add-set" data-id="${e.id}" ${e.sets.length >= 100 ? 'disabled' : ''}>${icon('plus')}세트 추가</button><span>운동 볼륨 <strong data-exercise-volume="${e.id}">${number(exerciseVolume(e))}</strong> kg</span></div></section>`;
}
function renderWeek() {
  const start = shiftDate(selectedDate, -((parseDate(selectedDate).getDay()+6)%7));
  const week = Array.from({length:7}, (_,i) => { const key = shiftDate(start,i); return {date:key,volume:dayVolume(days.find(d=>d.date===key)||blankDay(key)),count:completedSets(days.find(d=>d.date===key)||blankDay(key))}; });
  const max = Math.max(...week.map(d=>d.volume),1);
  return `<section class="week-card" id="week-card"><div class="section-heading"><h3>이번 주의 움직임</h3><span class="week-count">${week.filter(d=>d.count>0).length}<small> / 7일</small></span></div><div class="week-chart">${week.map((d,i)=>`<button class="week-day ${d.date===selectedDate?'selected':''}" data-date="${d.date}" aria-label="${longDate(d.date)}, 볼륨 ${number(d.volume)} kg"><span class="bar-track"><span class="bar" style="height:${d.volume?Math.max(8,d.volume/max*100):3}%"></span></span><span>${['월','화','수','목','금','토','일'][i]}</span></button>`).join('')}</div><div class="week-caption"><span>${start.slice(5).replace('-','.')} — ${shiftDate(start,6).slice(5).replace('-','.')}</span><span>일별 운동 볼륨</span></div></section>`;
}
function renderHistory() {
  const first = parseDate(`${historyMonth}-01`), offset = (first.getDay()+6)%7;
  const count = new Date(first.getFullYear(),first.getMonth()+1,0).getDate();
  const records = days.filter(d=>d.date.startsWith(historyMonth)&&d.exercises.length).sort((a,b)=>b.date.localeCompare(a.date));
  return `<div class="history-stats"><div><span>이달 운동한 날</span><strong>${records.filter(d=>completedSets(d)>0).length}<small>일</small></strong></div><div><span>이달 총 볼륨</span><strong>${number(records.reduce((n,d)=>n+dayVolume(d),0))}<small>kg</small></strong></div><div><span>기록한 세트</span><strong>${records.reduce((n,d)=>n+completedSets(d),0)}<small>세트</small></strong></div></div>
    <div class="history-layout"><section class="panel calendar-panel"><div class="section-heading"><h2>${first.getFullYear()}년 ${first.getMonth()+1}월</h2><div class="calendar-controls"><button class="icon-button" data-action="prev-month" aria-label="이전 달">${icon('chevron','rotate')}</button><label class="month-picker"><input type="month" id="history-month" aria-label="조회할 월" min="1900-01" max="2100-12" value="${historyMonth}">${icon('calendar')}</label><button class="icon-button" data-action="next-month" aria-label="다음 달">${icon('chevron')}</button></div></div><div class="calendar-grid">${['월','화','수','목','금','토','일'].map(d=>`<span class="weekday-label">${d}</span>`).join('')}${'<span></span>'.repeat(offset)}${Array.from({length:count},(_,i)=>{
      const date=`${historyMonth}-${String(i+1).padStart(2,'0')}`, record=days.find(d=>d.date===date), recorded=record&&completedSets(record)>0;
      return `<button class="calendar-day ${date===dateKey()?'is-today':''} ${recorded?'has-workout':''}" data-date="${date}" aria-label="${longDate(date)}${recorded?`, ${number(dayVolume(record))} kg`:record?.exercises.length?', 작성 중':', 기록 없음'}"><span>${i+1}</span>${recorded?'<span class="workout-dot"></span>':record?.exercises.length?'<span class="draft-dot"></span>':''}</button>`;
    }).join('')}</div><div class="calendar-legend"><span><i></i>운동 기록</span><span><i class="draft-dot"></i>작성 중</span><span>날짜를 눌러 기록 보기</span></div></section>
    <section class="history-records"><div class="section-heading"><h2>이달의 기록 <span class="count">${records.length.toString().padStart(2,'0')}</span></h2><span class="muted">최근 날짜순</span></div>${records.length?records.map(d=>`<button class="history-record" data-date="${d.date}"><div class="record-date"><strong>${parseDate(d.date).getDate()}</strong><span>${parseDate(d.date).toLocaleDateString('ko-KR',{weekday:'short'})}</span></div><div class="record-body"><strong>${[...new Set(d.exercises.map(e=>exerciseById(e.id).category))].join(' · ')}</strong><span>${d.exercises.length}개 운동 · ${completedSets(d)}세트${completedSets(d)<totalSets(d)?' · 작성 중':''}</span></div><div class="record-volume"><strong>${number(dayVolume(d))}</strong><span>kg</span></div>${icon('chevron')}</button>`).join(''):`<div class="history-empty">${icon('calendar')}<h3>아직 기록이 없는 달이에요.</h3><p>운동한 날짜를 선택해<br>첫 기록을 남겨 보세요.</p><button class="secondary-button" data-action="today">오늘 기록하기${icon('arrow')}</button></div>`}</section></div>`;
}
function renderBackup() {
  const selected = inRange(days,backupFrom,backupTo), volume = selected.reduce((n,d)=>n+dayVolume(d),0);
  return `<div class="backup-intro"><p>꾸준히 쌓아온 기록, 오래 간직하세요.</p><span>기간을 선택해 파일로 저장하거나 클라우드 드라이브에 보관할 수 있어요.</span></div><div class="backup-layout"><section class="panel export-panel"><div class="section-heading"><h2>기록 내보내기</h2><span class="panel-icon">${icon('cloud')}</span></div><fieldset class="date-range"><legend>내보낼 기간</legend><label>시작일<input type="date" id="backup-from" min="1900-01-01" max="2100-12-31" value="${backupFrom}"></label><span>—</span><label>종료일<input type="date" id="backup-to" min="1900-01-01" max="2100-12-31" value="${backupTo}"></label></fieldset><div class="range-shortcuts"><button data-action="range-month">이번 달</button><button data-action="range-30">최근 30일</button><button data-action="range-all">전체 기간</button></div>
    <div class="export-summary">${backupFrom>backupTo?'<span class="range-error">시작일이 종료일보다 늦어요.</span>':`<span><strong>${selected.length}일</strong>의 기록</span><span><strong>${number(volume)}</strong> kg</span>`}</div>
    <fieldset class="format-field"><legend>파일 형식</legend><label class="format-option ${backupFormat==='json'?'selected':''}"><input type="radio" name="backup-format" value="json" ${backupFormat==='json'?'checked':''}><span><strong>백업 파일 <small>JSON</small></strong><span>다른 기기에서 기록을 복원할 수 있어요.</span></span>${icon('check')}</label><label class="format-option ${backupFormat==='csv'?'selected':''}"><input type="radio" name="backup-format" value="csv" ${backupFormat==='csv'?'checked':''}><span><strong>스프레드시트 <small>CSV</small></strong><span>Excel, Google Sheets에서 확인해요.</span></span>${icon('check')}</label></fieldset>
    <div class="export-actions"><button class="primary-button" data-action="download" ${selected.length&&backupFrom<=backupTo?'':'disabled'}>${icon('download')}파일 다운로드</button><button class="secondary-button" data-action="share" ${selected.length&&backupFrom<=backupTo?'':'disabled'}>${icon('cloud')}공유하여 저장</button></div><p class="export-help">‘공유하여 저장’에서 Google Drive 등 설치된 앱을 선택하세요. 파일 공유를 지원하지 않으면 다운로드 후 직접 업로드할 수 있어요.</p></section>
    <aside class="backup-side"><section class="panel restore-panel"><span class="panel-icon">${icon('history')}</span><h2>기록 복원하기</h2><p>저장해 둔 GYMNOTE 백업 파일을<br>불러와 이어서 기록하세요.</p><input type="file" id="restore-file" accept=".json,application/json" hidden><button class="secondary-button" data-action="restore" ${canEdit()?'':'disabled'}>JSON 백업 불러오기${icon('arrow')}</button><span class="muted">CSV 파일은 복원할 수 없어요.</span></section><div class="storage-info">${icon('shield')}<h3>내 기록은 어디에 저장되나요?</h3><p>기록은 현재 기기의 이 브라우저에 저장돼요. 브라우저 데이터를 삭제하거나 기기를 바꾸면 기록이 사라질 수 있으니, 주기적으로 백업해 주세요.</p><p>클라우드 저장은 직접 파일을 내보내는 방식이며 자동 동기화되지 않아요.</p><button class="text-button" data-action="install">${icon('phone')}홈 화면에 추가하기</button></div></aside></div>`;
}
function showDialog(html) {
  dialog.innerHTML = html;
  if (!dialog.open) dialog.showModal();
}
const dialogHead = (eyebrow,title) => `<div class="dialog-header"><div><span class="eyebrow">${eyebrow}</span><h2 id="dialog-title">${title}</h2></div><button class="icon-button" data-action="close-dialog" aria-label="닫기">${icon('close')}</button></div>`;
function showPicker() {
  category = '전체'; search = '';
  showDialog(`${dialogHead('BUILD YOUR WORKOUT','어떤 운동을 하셨나요?')}<label class="search-box">${icon('search')}<input id="exercise-search" type="search" placeholder="운동 이름 검색" aria-label="운동 이름 검색"></label><div class="category-tabs" aria-label="운동 부위">${CATEGORIES.map(c=>`<button data-category="${c}" class="${c===category?'active':''}" aria-pressed="${c===category}">${c}</button>`).join('')}</div><div class="picker-list" id="picker-list"></div><p class="dialog-footnote">운동을 선택하면 기록에 바로 추가돼요.</p>`);
  renderPickerList();
}
function renderPickerList() {
  const filtered = EXERCISES.filter(e=>(category==='전체'||e.category===category)&&e.name.replaceAll(' ','').includes(search.replaceAll(' ','')));
  document.querySelector('#picker-list').innerHTML = filtered.length ? filtered.map(e=> {const added = currentDay().exercises.some(a=>a.id===e.id);return `<button class="picker-item" data-pick="${e.id}" ${added?'disabled':''}><span class="picker-icon">${icon('barbell')}</span><span><small>${e.category}</small><strong>${e.name}</strong></span>${added?'<span class="added-tag">추가됨</span>':icon('plus')}</button>`;}).join('') : '<div class="small-empty">찾는 운동이 없어요. 다른 이름으로 검색해 주세요.</div>';
}
function changeDay(date) { if (!validDate(date)) return; selectedDate = date; view = 'log'; render(); }
function persistCurrent() {
  if (!canEdit()) return;
  const day = currentDay(); day.updatedAt = new Date().toISOString();
  if (!days.some(d=>d.date===day.date)) days.push(day);
  const snapshot = structuredClone(day);
  dirtyDates.add(day.date);
  pendingWrites++; updateSaveStatus();
  writeQueue = writeQueue.then(()=>saveDays([snapshot])).then(()=>{if(days.find(d=>d.date===snapshot.date)?.updatedAt===snapshot.updatedAt)dirtyDates.delete(snapshot.date);}).catch(()=>{
    dirtyDates.add(snapshot.date);
    status='failed'; failure='기기에 저장하지 못했어요. 입력한 내용은 화면에 남아 있어요. 저장 공간을 확인하고 다시 시도해 주세요.';
  }).finally(()=>{ pendingWrites--; updateSaveStatus(); });
}
function updateSaveStatus() {
  const label = document.querySelector('#save-label'); if(label) label.textContent=saveLabel();
  const banner=document.querySelector('#storage-error');
  if(banner && failure) {banner.hidden=false;banner.innerHTML=`${esc(failure)} <button data-action="retry">다시 시도</button>`;}
  document.querySelector('.save-status')?.classList.toggle('error',status==='failed');
  if(status==='failed')document.querySelectorAll('[data-field]').forEach(el=>el.disabled=true);
}
function updateTotals() {
  const day = currentDay();
  document.querySelector('#day-volume').textContent=number(dayVolume(day));
  document.querySelector('#completed-sets').textContent=completedSets(day);
  for(const e of day.exercises) {
    document.querySelector(`[data-exercise-volume="${e.id}"]`).textContent=number(exerciseVolume(e));
    e.sets.forEach((s,i)=>document.querySelector(`[data-set-volume="${e.id}-${i}"]`).textContent=completeSet(s)?number(setVolume(s)):'—');
  }
  document.querySelector('#week-card').outerHTML=renderWeek();
}
async function removeExercise(id) {
  const info = exerciseById(id);
  showDialog(`${dialogHead('EDIT WORKOUT','운동 기록을 삭제할까요?')}<p class="dialog-copy">${info.name}의 모든 세트가 삭제돼요.</p><div class="dialog-actions"><button class="secondary-button" data-action="close-dialog">취소</button><button class="danger-button" data-action="confirm-delete" data-id="${id}">삭제하기</button></div>`);
}
document.addEventListener('click', async (event) => {
  const button=event.target.closest('button, [data-action], [data-date]'); if (!button || button.disabled) return;
  const invalid = document.querySelector('[data-field][aria-invalid="true"]');
  if(invalid){event.preventDefault();invalid.reportValidity();invalid.focus();notify('중량과 반복 횟수의 입력 범위를 확인해 주세요.');return;}
  if(button.dataset.view) {view=button.dataset.view;render();return;}
  if(button.dataset.date) {changeDay(button.dataset.date);return;}
  if(button.dataset.category) {category=button.dataset.category;document.querySelectorAll('[data-category]').forEach(el=>{el.classList.toggle('active',el.dataset.category===category);el.setAttribute('aria-pressed',String(el.dataset.category===category));});renderPickerList();return;}
  if(button.dataset.pick && canEdit()) {
    const day=currentDay(); if(day.exercises.some(e=>e.id===button.dataset.pick)) return;
    day.exercises.push({id:button.dataset.pick,sets:[newSet(),newSet(),newSet()]});
    if(!days.some(d=>d.date===day.date)) days.push(day);
    persistCurrent();dialog.close();render();document.querySelector(`[data-field="weight"][data-id="${button.dataset.pick}"]`)?.focus();return;
  }
  const action=button.dataset.action, id=button.dataset.id, day=currentDay(), exercise=day.exercises.find(e=>e.id===id);
  if(['add-exercise','delete-exercise','confirm-delete','add-set','delete-set'].includes(action)&&!canEdit()) return;
  switch(action) {
    case 'home': event.preventDefault();view='log';render();break;
    case 'prev-day':changeDay(shiftDate(selectedDate,-1));break;
    case 'next-day':changeDay(shiftDate(selectedDate,1));break;
    case 'today':changeDay(dateKey());break;
    case 'add-exercise':showPicker();break;
    case 'close-dialog':dialog.close();break;
    case 'delete-exercise':removeExercise(id);break;
    case 'confirm-delete':day.exercises=day.exercises.filter(e=>e.id!==id);persistCurrent();dialog.close();render();notify('운동 기록을 삭제했어요.');break;
    case 'add-set':if(exercise&&exercise.sets.length<100){exercise.sets.push({...exercise.sets.at(-1)});persistCurrent();render();document.querySelector(`[data-id="${id}"][data-set="${exercise.sets.length-1}"][data-field="weight"]`)?.focus();}break;
    case 'delete-set':if(exercise&&exercise.sets.length>1){exercise.sets.splice(Number(button.dataset.set),1);persistCurrent();render();}break;
    case 'install':showInstall();break;
    case 'retry':await retryStorage();break;
    default:await extraAction(action,button);
  }
});
document.addEventListener('input', event=>{
  const input=event.target;
  if(input.id==='exercise-search'){search=input.value;renderPickerList();return;}
  if(!input.dataset.field||!canEdit()) return;
  const value=input.value, field=input.dataset.field;
  const valid=!input.validity.badInput && (value==='' || (field==='weight'?validWeight(value):validReps(value)));
  input.setCustomValidity(valid?'':field==='weight'?'0~2,000 kg, 소수점 둘째 자리까지 입력해 주세요.':'1~999 사이의 정수를 입력해 주세요.');
  input.setAttribute('aria-invalid',String(!valid));
  if(!valid){input.reportValidity();updateSaveStatus();return;}
  const s=currentDay().exercises.find(e=>e.id===input.dataset.id)?.sets[Number(input.dataset.set)];
  if(s){s[field]=value;persistCurrent();updateTotals();}
});
document.addEventListener('change', event=>{
  const invalid=document.querySelector('[data-field][aria-invalid="true"]');
  if(invalid&&event.target.id==='selected-date'){event.target.value=selectedDate;invalid.reportValidity();return;}
  if(event.target.id==='selected-date') changeDay(event.target.value);
  extraChange(event);
});
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
async function extraAction(action) {
  switch(action) {
    case 'prev-month':case 'next-month': {
      const d=parseDate(`${historyMonth}-01`);d.setMonth(d.getMonth()+(action==='prev-month'?-1:1));
      if(validDate(dateKey(d))){historyMonth=dateKey(d).slice(0,7);render();}break;
    }
    case 'range-month':backupFrom=`${dateKey().slice(0,7)}-01`;backupTo=dateKey();render();break;
    case 'range-30':backupFrom=shiftDate(dateKey(),-29);backupTo=dateKey();render();break;
    case 'range-all':{const dates=days.filter(d=>d.exercises.length).map(d=>d.date).sort();backupFrom=dates[0]||dateKey();backupTo=dates.at(-1)||dateKey();render();break;}
    case 'download':try{downloadFile(exportFile());notify('파일을 다운로드했어요.');}catch(e){notify(e.message);}break;
    case 'share': {
      try {
        const file=exportFile();
        if(!navigator.canShare?.({files:[file]})) {
          showDialog(`${dialogHead('SAVE YOUR RECORDS','파일로 저장한 뒤 업로드하세요')}<p class="dialog-copy">이 브라우저는 파일 공유를 지원하지 않아요. 파일을 다운로드한 뒤 Google Drive의 ‘파일 업로드’로 보관해 주세요.</p><div class="dialog-actions"><button class="primary-button" data-action="download-and-close">${icon('download')}파일 다운로드</button></div>`);return;
        }
        await navigator.share({files:[file],title:'GYMNOTE 운동 기록'});
        notify('선택한 앱에서 파일 저장 여부를 확인해 주세요.');
      }catch(e){if(e.name!=='AbortError')notify('공유를 완료하지 못했어요. 파일 다운로드를 이용해 주세요.');}break;
    }
    case 'download-and-close':try{downloadFile(exportFile());dialog.close();notify('파일을 다운로드했어요.');}catch(e){notify(e.message);}break;
    case 'restore':document.querySelector('#restore-file').click();break;
    case 'confirm-restore': {
      if(!stagedImport?.length||!canEdit())return;
      const incoming=structuredClone(stagedImport);stagedImport=null;
      const confirm=document.querySelector('[data-action="confirm-restore"]');confirm.disabled=true;confirm.textContent='복원 중…';
      try {
        await writeQueue;if(status==='failed')throw new Error('현재 기록의 저장을 먼저 완료해 주세요.');
        const restored=incoming.map(d=>({...d,updatedAt:new Date().toISOString()}));await saveDays(restored);
        for(const day of restored){const i=days.findIndex(d=>d.date===day.date);if(i<0)days.push(day);else days[i]=day;}
        dialog.close();render();notify(`${restored.length}일의 기록을 복원했어요.`);
      }catch(e){dialog.close();notify(e.message||'복원하지 못했어요. 기존 기록은 유지돼요.');}break;
    }
    case 'prompt-install':if(installPrompt){await installPrompt.prompt();installPrompt=null;dialog.close();}break;
  }
}
function extraChange(event) {
  const input=event.target;
  if(input.id==='history-month'&&validDate(`${input.value}-01`)){historyMonth=input.value;render();}
  if(input.id==='backup-from'||input.id==='backup-to'){
    if(!validDate(input.value)){input.setCustomValidity('올바른 날짜를 입력해 주세요.');input.reportValidity();return;}
    input.setCustomValidity('');if(input.id==='backup-from')backupFrom=input.value;else backupTo=input.value;render();
  }
  if(input.name==='backup-format'){backupFormat=input.value;render();}
  if(input.id==='restore-file')prepareRestore(input.files?.[0]);
}
function exportFile() {
  if([...document.querySelectorAll('#backup-from, #backup-to')].some(input=>!input.checkValidity()))throw new Error('시작일과 종료일을 올바르게 입력해 주세요.');
  if(!validDate(backupFrom)||!validDate(backupTo)||backupFrom>backupTo)throw new Error('내보낼 기간을 확인해 주세요.');
  if(!inRange(days,backupFrom,backupTo).length)throw new Error('선택한 기간에 기록이 없어요.');
  const json=backupFormat==='json';
  return new File([json?makeBackup(days,backupFrom,backupTo):makeCsv(days,backupFrom,backupTo)],`gymnote_${backupFrom}_${backupTo}.${json?'json':'csv'}`,{type:json?'application/json':'text/csv;charset=utf-8'});
}
function downloadFile(file) {
  const url=URL.createObjectURL(file), link=document.createElement('a');
  link.href=url;link.download=file.name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
async function prepareRestore(file) {
  if(!file)return;
  try {
    if(file.size>5*1024*1024)throw new Error('5 MB 이하의 백업 파일을 선택해 주세요.');
    stagedImport=readBackup(await file.text());if(!stagedImport.length)throw new Error('백업 파일에 기록이 없어요.');
    const overlaps=stagedImport.filter(d=>days.some(existing=>existing.date===d.date&&existing.exercises.length)).length;
    showDialog(`${dialogHead('RESTORE YOUR PROGRESS','백업 기록을 불러올까요?')}<p class="dialog-copy"><strong>${stagedImport.length}일</strong>의 운동 기록을 복원해요.${overlaps?`<br><br>이미 기록이 있는 <strong>${overlaps}일은 백업 내용으로 덮어써요.</strong> 현재 기록을 먼저 내보내면 안전하게 보관할 수 있어요.`:' 기존의 다른 날짜 기록은 그대로 유지돼요.'}</p><div class="dialog-actions"><button class="secondary-button" data-action="close-dialog">취소</button><button class="primary-button" data-action="confirm-restore">${overlaps?'덮어쓰고 복원':'복원하기'}</button></div>`);
  }catch(e){stagedImport=null;notify(e.message);}
  const input=document.querySelector('#restore-file');if(input)input.value='';
}
function showInstall() {showDialog(`${dialogHead('TAKE GYMNOTE WITH YOU','홈 화면에서 바로 시작하세요')}${installPrompt?'<button class="primary-button" data-action="prompt-install">앱 설치하기</button>':''}<div class="install-steps"><p><strong>iPhone · iPad</strong>Safari에서 이 페이지를 열고 공유 메뉴의 ‘홈 화면에 추가’를 선택하세요.</p><p><strong>Android</strong>Chrome 메뉴에서 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택하세요.</p></div><p class="dialog-footnote">설치한 앱을 처음 온라인으로 연 뒤에는 오프라인에서도 기록할 수 있어요. 설치한 앱과 일반 브라우저의 저장 공간은 기기에 따라 다를 수 있으니, 기존 기록은 백업해서 복원해 주세요.</p>`);}
async function retryStorage() {
  try {if(status==='loading')return;await writeQueue;await openDatabase();if(dirtyDates.size)await saveDays(days.filter(d=>dirtyDates.has(d.date)));days=await loadDays();dirtyDates.clear();status='ready';failure='';render();notify('기록을 확인하고 저장했어요.');}catch{notify('저장소에 접근할 수 없어요. 브라우저의 저장 공간과 권한을 확인해 주세요.');}
}
render();
try {days=await openDatabase();status='ready';render();}
catch {status='failed';failure='기록을 불러올 수 없어요. 브라우저의 저장 공간과 권한을 확인해 주세요. 기존 기록은 변경하지 않았어요.';render();}

window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});
window.addEventListener('beforeunload',event=>{if(pendingWrites||dirtyDates.size||document.querySelector('[aria-invalid="true"]')){event.preventDefault();event.returnValue='';}});
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>notify('오프라인 준비를 완료하지 못했어요. 온라인 상태에서 다시 열어 주세요.'));
if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});
registerWorkoutTools({
  getDay:date=>days.find(d=>d.date===date)||blankDay(date),
  getDays:()=>days,
  navigate:date=>{if(document.querySelector('[aria-invalid="true"]'))throw new Error('Resolve invalid input first');changeDay(date);},
  async addExercise(date,exercise){
    if(!canEdit()||document.querySelector('[aria-invalid="true"]'))throw new Error('Storage or input needs attention');
    await writeQueue;
    if(!canEdit())throw new Error('Storage needs attention');
    const day=structuredClone(days.find(d=>d.date===date)||blankDay(date));
    if(day.exercises.some(e=>e.id===exercise.id))throw new Error('Exercise already exists');
    day.exercises.push(exercise);day.updatedAt=new Date().toISOString();
    await saveDays([day]);
    const index=days.findIndex(d=>d.date===date);if(index<0)days.push(day);else days[index]=day;
    changeDay(date);return {date,exercise:exercise.id,totalVolumeKg:dayVolume(day),saved:true};
  }
});
