const state = {
  year:         new Date().getFullYear(),
  month:        new Date().getMonth() + 1,
  monthRecords: {},
  selectedDate: null,
  record: { urine_times: [], poop_times: [], is_hospital: false, is_litter_change: false, is_ear_clean: false, is_teeth_brush: false, weight: null, notes: '' }
};

// ── 월별 클라이언트 캐시 ───────────────────────────────────
const monthCache = {};  // { 'YYYY-M': monthRecords 객체 }

const _now  = new Date();
const today = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}-${String(_now.getDate()).padStart(2,'0')}`;

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

  const uCount      = r?.urine_times?.length || 0;
  const pCount      = r?.poop_times?.length  || 0;
  const hasNotes    = !!r?.notes?.trim();
  const isBirthday  = state.month === 10 && d === 27;
  const isHomeDay   = state.month ===  1 && d ===  7;

  if (isBirthday)                            cell.classList.add('birthday-day');
  else if (isHomeDay)                        cell.classList.add('home-day');
  else if (r?.is_hospital)                   cell.classList.add('hospital-day');
  else if (r?.is_litter_change)              cell.classList.add('litter-day');
  else if (r?.is_ear_clean)                  cell.classList.add('ear-clean-day');
  else if (r?.is_teeth_brush)                cell.classList.add('teeth-brush-day');
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
  if (isBirthday)          inds.innerHTML += `<span class="ind-birthday">🎂</span>`;
  if (isHomeDay)           inds.innerHTML += `<span class="ind-home">🏠</span>`;
  if (r?.is_hospital)      inds.innerHTML += `<span class="ind-hospital">🏥</span>`;
  if (r?.is_litter_change) inds.innerHTML += `<span class="ind-litter">🧹</span>`;
  if (r?.is_ear_clean)     inds.innerHTML += `<span class="ind-ear">👂</span>`;
  if (r?.is_teeth_brush)   inds.innerHTML += `<span class="ind-teeth">🪥</span>`;
  if (uCount > 0)          inds.innerHTML += `<span class="ind-count">💧${uCount}${uCount >= 3 ? '⭐' : ''}</span>`;
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
    is_ear_clean:     !!cached?.is_ear_clean,
    is_teeth_brush:   !!cached?.is_teeth_brush,
    weight:           cached?.weight ?? null,
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
  document.getElementById('ear-clean-check').checked     = r.is_ear_clean;
  document.getElementById('teeth-brush-check').checked   = r.is_teeth_brush;
  const weightInput = document.getElementById('weight-input');
  weightInput.value = r.weight != null ? String(r.weight) : '';
  updateWeightDisplay(r.weight);
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
    is_ear_clean:     document.getElementById('ear-clean-check').checked,
    is_teeth_brush:   document.getElementById('teeth-brush-check').checked,
    weight:           parseWeightInput(document.getElementById('weight-input').value),
    notes:            document.getElementById('notes-input').value.trim()
  };

  // 즉시 UI 업데이트
  state.record.is_hospital      = payload.is_hospital;
  state.record.is_litter_change = payload.is_litter_change;
  state.record.is_ear_clean     = payload.is_ear_clean;
  state.record.is_teeth_brush   = payload.is_teeth_brush;
  state.record.weight           = payload.weight;
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
  }).then(() => loadWeightChart()).catch(e => {
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

// ── 체중 유틸 ─────────────────────────────────────────────
function parseWeightInput(raw) {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  return Number(digits);
}

function updateWeightDisplay(rawVal) {
  const el = document.getElementById('weight-display');
  if (rawVal == null || rawVal === '') {
    el.textContent = '— kg';
    el.classList.remove('has-weight');
  } else {
    el.textContent = (Number(rawVal) / 10).toFixed(1) + ' kg';
    el.classList.add('has-weight');
  }
}

document.getElementById('weight-input').addEventListener('input', e => {
  e.target.value = e.target.value.replace(/\D/g, '');
  updateWeightDisplay(parseWeightInput(e.target.value));
});

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

// ── 체중 그래프 ───────────────────────────────────────────
const chartState = { days: 30, data: [] };

async function loadWeightChart() {
  const toDate   = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - chartState.days + 1);

  const from = formatDate(fromDate.getFullYear(), fromDate.getMonth() + 1, fromDate.getDate());
  const to   = formatDate(toDate.getFullYear(),   toDate.getMonth() + 1,   toDate.getDate());

  try {
    const res = await fetch(`/api/weights?from=${from}&to=${to}`);
    chartState.data = await res.json();
  } catch (e) {
    chartState.data = [];
    console.error('체중 데이터 로드 실패:', e);
  }
  drawWeightChart();
}

function drawWeightChart() {
  const svg     = document.getElementById('weight-svg');
  const emptyEl = document.getElementById('chart-empty');
  const wrap    = document.getElementById('chart-wrap');

  const W = wrap.getBoundingClientRect().width;
  if (!W) return;

  const H   = 200;
  const PAD = { t: 16, r: 16, b: 36, l: 48 };
  const cW  = W - PAD.l - PAD.r;
  const cH  = H - PAD.t - PAD.b;

  svg.setAttribute('width',   W);
  svg.setAttribute('height',  H);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  const data = chartState.data;
  if (data.length === 0) {
    svg.innerHTML = '';
    emptyEl.style.display = 'flex';
    return;
  }
  emptyEl.style.display = 'none';

  const pts = data.map(d => ({ date: d.date, kg: d.weight / 10 }));

  // Y 범위 — 데이터 기준으로 여유 있게
  const kgs    = pts.map(p => p.kg);
  const dMin   = Math.min(...kgs);
  const dMax   = Math.max(...kgs);
  const spread = Math.max(dMax - dMin, 0.5);
  const yPad   = Math.max(spread * 0.4, 0.5);
  const yMin   = Math.floor((dMin - yPad) * 2) / 2;
  const yMax   = Math.ceil( (dMax + yPad) * 2) / 2;
  const yRange = yMax - yMin;

  // X 범위 — 선택한 전체 기간
  const toDate2   = new Date();
  const fromDate2 = new Date();
  fromDate2.setDate(fromDate2.getDate() - chartState.days + 1);
  const span = chartState.days - 1 || 1;

  const xOf = dateStr => {
    const d = new Date(dateStr + 'T00:00:00');
    return PAD.l + (Math.round((d - fromDate2) / 86400000) / span) * cW;
  };
  const yOf = kg => PAD.t + cH - ((kg - yMin) / yRange) * cH;

  let html = `<defs>
    <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#FF8C42" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#FF8C42" stop-opacity="0.02"/>
    </linearGradient>
  </defs>`;

  // 수평 그리드 + Y 레이블
  const yStep = yRange <= 2.5 ? 0.5 : 1;
  for (let y = yMin; y <= yMax + 0.01; y += yStep) {
    const py = Math.round(yOf(y));
    html += `<line x1="${PAD.l}" y1="${py}" x2="${W - PAD.r}" y2="${py}" stroke="#EEEEEE" stroke-width="1"/>`;
    html += `<text x="${PAD.l - 6}" y="${py + 4}" text-anchor="end" font-size="11" fill="#AAAAAA">${y.toFixed(1)}</text>`;
  }

  // X 레이블
  const xInterval = chartState.days <= 30 ? 7 : chartState.days <= 60 ? 14 : 30;
  for (let i = 0; i <= span; i += xInterval) {
    const d = new Date(fromDate2);
    d.setDate(d.getDate() + i);
    const px    = Math.round(PAD.l + (i / span) * cW);
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    html += `<text x="${px}" y="${H - 6}" text-anchor="middle" font-size="11" fill="#AAAAAA">${label}</text>`;
  }

  // 경로 생성
  let linePath = '';
  pts.forEach((p, i) => {
    const px = xOf(p.date);
    const py = yOf(p.kg);
    linePath += i === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`;
  });

  // 채우기 영역
  if (pts.length >= 1) {
    const fX = xOf(pts[0].date);
    const lX = xOf(pts[pts.length - 1].date);
    html += `<path d="${linePath} L ${lX} ${PAD.t + cH} L ${fX} ${PAD.t + cH} Z" fill="url(#wg)"/>`;
  }

  // 선
  if (pts.length >= 2) {
    html += `<path d="${linePath}" fill="none" stroke="#FF8C42" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
  }

  // 점
  pts.forEach(p => {
    const px = xOf(p.date);
    const py = yOf(p.kg);
    html += `<circle cx="${px}" cy="${py}" r="5" fill="#FF8C42" stroke="white" stroke-width="2.5" `
          + `class="w-dot" data-date="${p.date}" data-kg="${p.kg}" style="cursor:pointer"/>`;
  });

  svg.innerHTML = html;

  // 툴팁
  const tooltip = document.getElementById('chart-tooltip');
  svg.querySelectorAll('.w-dot').forEach(dot => {
    dot.addEventListener('mouseenter', () => {
      const [, m, d] = dot.dataset.date.split('-');
      tooltip.textContent = `${+m}/${+d} · ${Number(dot.dataset.kg).toFixed(1)} kg`;
      tooltip.style.display = 'block';
    });
    dot.addEventListener('mousemove', e => {
      const rect = wrap.getBoundingClientRect();
      tooltip.style.left = (e.clientX - rect.left + 14) + 'px';
      tooltip.style.top  = (e.clientY - rect.top  - 40) + 'px';
    });
    dot.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
  });
}

// 기간 버튼
document.querySelectorAll('.period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    chartState.days = Number(btn.dataset.days);
    loadWeightChart();
  });
});

// 리사이즈 시 재렌더
let _chartResizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(_chartResizeTimer);
  _chartResizeTimer = setTimeout(drawWeightChart, 200);
});

// ── 코나 나이 표시 ────────────────────────────────────────
function calcElapsed(fromDate) {
  const now = new Date();
  let years  = now.getFullYear() - fromDate.getFullYear();
  let months = now.getMonth()    - fromDate.getMonth();
  let days   = now.getDate()     - fromDate.getDate();
  if (days < 0) {
    months--;
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  }
  if (months < 0) { years--; months += 12; }
  return { years, months, days };
}

function displayKonaAge() {
  const { years, months, days } = calcElapsed(new Date(2017, 9, 27));
  document.getElementById('kona-age').textContent =
    `🐾 세상에 온 지 ${years}년 ${months}개월 ${days}일째다냥~`;

  const h = calcElapsed(new Date(2018, 0, 7));
  document.getElementById('kona-home').textContent =
    `🏠 우리집에 온 지 ${h.years}년 ${h.months}개월 ${h.days}일째다냥~`;
}

// ── 초기화 ────────────────────────────────────────────────
displayKonaAge();
loadMonth();
loadWeightChart();
