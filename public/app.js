const state = {
  year:         new Date().getFullYear(),
  month:        new Date().getMonth() + 1,
  monthRecords: {},
  selectedDate: null,
  record: { urine_times: [], poop_times: [], is_hospital: false, is_litter_change: false, notes: '' }
};

// ── 월별 클라이언트 캐시 ───────────────────────────────────
const monthCache = {};  // { 'YYYY-M': monthRecords 객체 }

const today = new Date().toISOString().slice(0, 10);

// ── 달력 로드 (캐시 우선) ─────────────────────────────────
async function loadMonth() {
  const cacheKey = `${state.year}-${state.month}`;

  if (monthCache[cacheKey]) {
    state.monthRecords = monthCache[cacheKey];
    renderCalendar();
    return;
  }

  try {
    const res = await fetch(`/api/records/${state.year}/${state.month}`);
    if (!res.ok) throw new Error(`API 오류: ${res.status} ${await res.text()}`);
    const records = await res.json();
    state.monthRecords = {};
    records.forEach(r => { state.monthRecords[r.date] = r; });
    monthCache[cacheKey] = state.monthRecords;
  } catch (e) {
    console.error('달력 데이터 로드 실패:', e);
  }
  renderCalendar();
}

// ── 달력 렌더링 ────────────────────────────────────────────
function renderCalendar() {
  document.getElementById('current-month').textContent =
    `${state.year}년 ${state.month}월`;

  const container = document.getElementById('calendar-days');
  container.innerHTML = '';

  const firstDay    = new Date(state.year, state.month - 1, 1).getDay();
  const daysInMonth = new Date(state.year, state.month, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'day-cell empty';
    container.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = formatDate(state.year, state.month, d);
    container.appendChild(buildDayCell(d, dateStr));
  }
}

function buildDayCell(d, dateStr) {
  const r    = state.monthRecords[dateStr];
  const cell = document.createElement('div');
  cell.className = 'day-cell';
  cell.dataset.date = dateStr;

  const uCount   = r?.urine_times?.length || 0;
  const pCount   = r?.poop_times?.length  || 0;
  const hasNotes = !!r?.notes?.trim();

  if (r?.is_hospital)                        cell.classList.add('hospital-day');
  else if (r?.is_litter_change)              cell.classList.add('litter-day');
  else if (hasNotes)                         cell.classList.add('has-notes');
  else if (r && (uCount > 0 || pCount > 0)) cell.classList.add('has-record');
  if (dateStr === today)              cell.classList.add('today');
  if (dateStr === state.selectedDate) cell.classList.add('selected');

  const numEl = document.createElement('div');
  numEl.className = 'day-num';
  numEl.textContent = d;
  cell.appendChild(numEl);

  const inds = document.createElement('div');
  inds.className = 'day-indicators';
  if (r?.is_hospital)      inds.innerHTML += `<span class="ind-hospital">🏥</span>`;
  if (r?.is_litter_change) inds.innerHTML += `<span class="ind-litter">🧹</span>`;
  if (uCount > 0)          inds.innerHTML += `<span class="ind-count">💧${uCount}</span>`;
  if (pCount > 0)          inds.innerHTML += `<span class="ind-count">💩${pCount}</span>`;
  if (hasNotes)            inds.innerHTML += `<span class="ind-notes">📝</span>`;
  cell.appendChild(inds);

  cell.addEventListener('click', () => selectDay(dateStr));
  return cell;
}

// ── 날짜 선택 (API 호출 없이 캐시 사용) ───────────────────
function selectDay(dateStr) {
  state.selectedDate = dateStr;

  document.querySelectorAll('.day-cell.selected')
    .forEach(el => el.classList.remove('selected'));
  const cell = document.querySelector(`.day-cell[data-date="${dateStr}"]`);
  if (cell) cell.classList.add('selected');

  // 이미 로드된 월 데이터 사용 — API 호출 없음
  const cached = state.monthRecords[dateStr];
  state.record = {
    urine_times:      cached?.urine_times ? [...cached.urine_times] : [],
    poop_times:       cached?.poop_times  ? [...cached.poop_times]  : [],
    is_hospital:      !!cached?.is_hospital,
    is_litter_change: !!cached?.is_litter_change,
    notes:            cached?.notes || ''
  };

  renderDetail();
  openPanel();
}

// ── 상세 패널 렌더링 ───────────────────────────────────────
function renderDetail() {
  const r = state.record;
  const [y, m, d] = state.selectedDate.split('-');
  const dateObj = new Date(+y, +m - 1, +d);
  const days  = ['일', '월', '화', '수', '목', '금', '토'];
  const label = `${+m}월 ${+d}일 (${days[dateObj.getDay()]})`;

  document.getElementById('detail-date-title').textContent = label;
  document.getElementById('urine-val').textContent = r.urine_times.length;
  document.getElementById('poop-val').textContent  = r.poop_times.length;
  document.getElementById('hospital-check').checked      = r.is_hospital;
  document.getElementById('litter-change-check').checked = r.is_litter_change;
  document.getElementById('notes-input').value           = r.notes;
  document.getElementById('save-status').textContent = '';

  renderTimes('urine');
  renderTimes('poop');

  document.getElementById('detail-placeholder').style.display = 'none';
  document.getElementById('detail-content').classList.add('visible');
}

// ── 시간 목록 렌더링 ──────────────────────────────────────
function renderTimes(type) {
  const times  = state.record[`${type}_times`];
  const listEl = document.getElementById(`${type}-times`);
  listEl.innerHTML = '';
  times.forEach(iso => {
    const chip = document.createElement('span');
    chip.className   = 'time-chip';
    chip.textContent = formatTime(iso);
    listEl.appendChild(chip);
  });
}

// ── 패널 열기/닫기 ────────────────────────────────────────
function openPanel() {
  document.getElementById('detail-section').classList.add('open');
  if (window.innerWidth <= 720) {
    document.getElementById('overlay').classList.add('visible');
  }
}

function closePanel() {
  document.getElementById('detail-section').classList.remove('open');
  document.getElementById('overlay').classList.remove('visible');

  if (window.innerWidth > 720) {
    document.getElementById('detail-placeholder').style.display = '';
    document.getElementById('detail-content').classList.remove('visible');
    state.selectedDate = null;
    document.querySelectorAll('.day-cell.selected')
      .forEach(el => el.classList.remove('selected'));
  }
}

// ── 저장 (낙관적 업데이트 — UI 먼저, 저장은 백그라운드) ──
function saveRecord() {
  const payload = {
    urine_times:      state.record.urine_times,
    poop_times:       state.record.poop_times,
    is_hospital:      document.getElementById('hospital-check').checked,
    is_litter_change: document.getElementById('litter-change-check').checked,
    notes:            document.getElementById('notes-input').value.trim()
  };

  // 즉시 UI 업데이트
  state.record.is_hospital      = payload.is_hospital;
  state.record.is_litter_change = payload.is_litter_change;
  state.record.notes            = payload.notes;
  state.monthRecords[state.selectedDate] = { ...state.record, date: state.selectedDate };
  renderCalendar();

  const statusEl = document.getElementById('save-status');
  statusEl.textContent = '✓ 저장됨';
  setTimeout(() => { statusEl.textContent = ''; }, 2000);

  // 백그라운드에서 서버에 저장
  fetch(`/api/records/${state.selectedDate}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload)
  }).catch(e => {
    console.error('저장 실패:', e);
    statusEl.textContent = '⚠️ 저장 실패';
  });
}

// ── 카운트 버튼 ────────────────────────────────────────────
document.querySelectorAll('.btn-count').forEach(btn => {
  btn.addEventListener('click', () => {
    const type  = btn.dataset.type;
    const key   = `${type}_times`;
    const valEl = document.getElementById(`${type}-val`);

    if (btn.classList.contains('plus')) {
      state.record[key].push(new Date().toISOString());
    } else {
      if (state.record[key].length > 0) state.record[key].pop();
    }

    valEl.textContent = state.record[key].length;
    renderTimes(type);
  });
});

// ── 빠른 태그 ──────────────────────────────────────────────
document.querySelectorAll('.tag-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const ta  = document.getElementById('notes-input');
    const tag = btn.dataset.tag;
    ta.value  = ta.value ? `${ta.value}\n${tag}` : tag;
    ta.focus();
  });
});

// ── 월 이동 ───────────────────────────────────────────────
document.getElementById('btn-prev').addEventListener('click', () => {
  state.month--;
  if (state.month < 1) { state.month = 12; state.year--; }
  state.selectedDate = null;
  closePanel();
  loadMonth();
});
document.getElementById('btn-next').addEventListener('click', () => {
  state.month++;
  if (state.month > 12) { state.month = 1; state.year++; }
  state.selectedDate = null;
  closePanel();
  loadMonth();
});

// ── 기타 이벤트 ───────────────────────────────────────────
document.getElementById('btn-save').addEventListener('click', saveRecord);
document.getElementById('btn-close').addEventListener('click', closePanel);
document.getElementById('overlay').addEventListener('click', closePanel);

// ── 유틸 ──────────────────────────────────────────────────
function formatDate(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function formatTime(iso) {
  const d    = new Date(iso);
  const h    = d.getHours();
  const min  = String(d.getMinutes()).padStart(2, '0');
  const ampm = h < 12 ? '오전' : '오후';
  const h12  = h % 12 || 12;
  return `${ampm} ${h12}:${min}`;
}

// ── 초기화 ────────────────────────────────────────────────
loadMonth();
