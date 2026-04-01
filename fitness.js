// ==================== CONSTANTS & DATA LAYER ====================

const KEYS = { WORKOUTS: 'ft_workouts' };
const TODAY = new Date().toISOString().slice(0, 10);

const MUSCLE_GROUPS = ['Chest', 'Legs', 'Abs', 'Arms', 'Back'];

const MUSCLE_COLORS = {
  Chest: { bg: 'rgba(29,185,84,0.18)',   color: '#1db954' }, // green (accent)
  Legs:  { bg: 'rgba(167,139,250,0.18)', color: '#a78bfa' }, // violet
  Abs:   { bg: 'rgba(163,230,53,0.18)',  color: '#a3e635' }, // lime
  Arms:  { bg: 'rgba(96,165,250,0.18)',  color: '#60a5fa' }, // blue
  Back:  { bg: 'rgba(94,234,212,0.18)',  color: '#5eead4' }, // mint
};

const SESSION_ICONS = {
  warmup:     { emoji: '🔥', label: 'Warm-up' },
  stretching: { emoji: '🤸', label: 'Stretching' },
};

function loadData(key) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}
function saveData(key, data)  { localStorage.setItem(key, JSON.stringify(data)); }
function getWorkouts()        { return loadData(KEYS.WORKOUTS); }
function saveWorkouts(data)   { saveData(KEYS.WORKOUTS, data); }

// ==================== STATE ====================

const state = {
  // Modal
  modalDate:        TODAY,
  modalName:        '',
  modalWarmup:      false,
  modalStretching:  false,
  modalExercises:   [],
  editingWorkoutId: null,

  // History UI
  expandedWorkouts: new Set(),
  selectedWorkouts: new Set(),

  // Inline exercise edit
  inlineEdit:     null,
  inlineEditData: null,

  // Filters
  filter: {
    dateFrom:     '',         // YYYY-MM-DD
    dateTo:       '',         // YYYY-MM-DD
    muscleGroups: new Set(),
  },
  filterOpen: false,
};

// Filter panel DOM references (set once in buildFilterPanel)
let _filterDateFrom = null;
let _filterDateTo   = null;
let _filterChips    = {};

// ==================== UTILITIES ====================

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[m - 1]} ${d}, ${y}`;
}

function toDisplayDate(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}-${m}-${y}`;
}

function parseDDMMYYYY(str) {
  const match = str.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  const date = new Date(+y, +m - 1, +d);
  if (date.getFullYear() !== +y || date.getMonth() !== +m - 1 || date.getDate() !== +d) return null;
  return `${y}-${m}-${d}`;
}

function formatTime(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function showToast(msg, type = 'success') {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const toast = document.createElement('div');
  toast.className = 'toast' + (type === 'error' ? ' error' : '');
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

function isPositiveInt(val) {
  const n = Number(val);
  return Number.isInteger(n) && n >= 1;
}

function getWorkoutMuscleGroups(workout) {
  const present = new Set(workout.exercises.map(ex => ex.muscleGroup).filter(Boolean));
  return MUSCLE_GROUPS.filter(g => present.has(g));
}

// ==================== FILTER ====================

function applyFilters(workouts) {
  const { dateFrom, dateTo, muscleGroups } = state.filter;
  return workouts.filter(w => {
    if (dateFrom && w.date < dateFrom) return false;
    if (dateTo   && w.date > dateTo)   return false;
    if (muscleGroups.size > 0) {
      const wGroups = new Set(w.exercises.map(ex => ex.muscleGroup).filter(Boolean));
      if (![...muscleGroups].some(g => wGroups.has(g))) return false;
    }
    return true;
  });
}

function countActiveFilters() {
  const { dateFrom, dateTo, muscleGroups } = state.filter;
  return (dateFrom ? 1 : 0) + (dateTo ? 1 : 0) + muscleGroups.size;
}

function updateFilterUI() {
  const count = countActiveFilters();
  const badge  = document.getElementById('filter-badge');
  const toggle = document.getElementById('btn-toggle-filter');

  if (count > 0) {
    badge.textContent = count;
    badge.classList.remove('hidden');
    toggle.classList.add('has-filters');
  } else {
    badge.classList.add('hidden');
    toggle.classList.remove('has-filters');
  }

  // Update chip active states
  MUSCLE_GROUPS.forEach(group => {
    const chip = _filterChips[group];
    if (!chip) return;
    const active = state.filter.muscleGroups.has(group);
    if (active) {
      chip.style.background   = MUSCLE_COLORS[group].bg;
      chip.style.color        = MUSCLE_COLORS[group].color;
      chip.style.borderColor  = MUSCLE_COLORS[group].color;
    } else {
      chip.style.background  = '';
      chip.style.color       = '';
      chip.style.borderColor = '';
    }
  });
}

function buildFilterPanel() {
  const panel = document.getElementById('filter-panel');
  panel.innerHTML = '';

  // ── Date range ───────────────────────────────────
  const dateGroup = document.createElement('div');
  dateGroup.className = 'filter-group';

  const dateLbl = document.createElement('span');
  dateLbl.className = 'filter-group-label';
  dateLbl.textContent = 'Date range';
  dateGroup.appendChild(dateLbl);

  const dateRow = document.createElement('div');
  dateRow.className = 'filter-date-row';

  _filterDateFrom = document.createElement('input');
  _filterDateFrom.type      = 'date';
  _filterDateFrom.className = 'filter-date-input';
  _filterDateFrom.title     = 'From date';
  _filterDateFrom.addEventListener('change', () => {
    state.filter.dateFrom = _filterDateFrom.value;
    updateFilterUI();
    renderWorkoutHistory();
  });

  const sep = document.createElement('span');
  sep.className   = 'filter-date-sep';
  sep.textContent = '→';

  _filterDateTo = document.createElement('input');
  _filterDateTo.type      = 'date';
  _filterDateTo.className = 'filter-date-input';
  _filterDateTo.title     = 'To date';
  _filterDateTo.addEventListener('change', () => {
    state.filter.dateTo = _filterDateTo.value;
    updateFilterUI();
    renderWorkoutHistory();
  });

  dateRow.appendChild(_filterDateFrom);
  dateRow.appendChild(sep);
  dateRow.appendChild(_filterDateTo);
  dateGroup.appendChild(dateRow);
  panel.appendChild(dateGroup);

  // ── Muscle groups ─────────────────────────────────
  const muscleGroup = document.createElement('div');
  muscleGroup.className = 'filter-group';

  const muscleLbl = document.createElement('span');
  muscleLbl.className = 'filter-group-label';
  muscleLbl.textContent = 'Muscle groups';
  muscleGroup.appendChild(muscleLbl);

  const chips = document.createElement('div');
  chips.className = 'muscle-chips';

  MUSCLE_GROUPS.forEach(group => {
    const chip = document.createElement('button');
    chip.className   = 'muscle-chip';
    chip.textContent = group;
    chip.type        = 'button';
    chip.addEventListener('click', () => {
      if (state.filter.muscleGroups.has(group)) {
        state.filter.muscleGroups.delete(group);
      } else {
        state.filter.muscleGroups.add(group);
      }
      updateFilterUI();
      renderWorkoutHistory();
    });
    _filterChips[group] = chip;
    chips.appendChild(chip);
  });

  muscleGroup.appendChild(chips);
  panel.appendChild(muscleGroup);

  // ── Clear button ──────────────────────────────────
  const clearBtn = document.createElement('button');
  clearBtn.className   = 'btn-clear-filters';
  clearBtn.textContent = 'Clear filters';
  clearBtn.type        = 'button';
  clearBtn.addEventListener('click', clearFilters);
  panel.appendChild(clearBtn);
}

function clearFilters() {
  state.filter.dateFrom = '';
  state.filter.dateTo   = '';
  state.filter.muscleGroups.clear();
  if (_filterDateFrom) _filterDateFrom.value = '';
  if (_filterDateTo)   _filterDateTo.value   = '';
  updateFilterUI();
  renderWorkoutHistory();
}

// ==================== WORKOUT HISTORY ====================

function renderWorkoutHistory() {
  const allWorkouts = getWorkouts();
  const workouts    = applyFilters(allWorkouts);
  const container   = document.getElementById('workout-history');
  container.innerHTML = '';

  if (allWorkouts.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No workouts logged yet. Click "+ Add Workout" to get started.';
    container.appendChild(empty);
    updateBulkBar();
    return;
  }

  if (workouts.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No workouts match your filters.';
    container.appendChild(empty);
    updateBulkBar();
    return;
  }

  const sorted = [...workouts].sort((a, b) => {
    const tsA = a.timestamp || (a.date + 'T00:00:00.000Z');
    const tsB = b.timestamp || (b.date + 'T00:00:00.000Z');
    return tsB.localeCompare(tsA);
  });

  const dateOrder = [];
  const groups    = {};
  for (const w of sorted) {
    if (!groups[w.date]) { groups[w.date] = []; dateOrder.push(w.date); }
    groups[w.date].push(w);
  }

  dateOrder.forEach(date => {
    const header = document.createElement('div');
    header.className = 'date-header';
    header.textContent = formatDateDisplay(date);
    container.appendChild(header);
    groups[date].forEach(workout => container.appendChild(buildWorkoutCard(workout)));
  });

  updateBulkBar();
}

function buildWorkoutCard(workout) {
  const isExpanded = state.expandedWorkouts.has(workout.id);
  const isSelected = state.selectedWorkouts.has(workout.id);
  const muscleTags = getWorkoutMuscleGroups(workout);

  const card = document.createElement('div');
  card.className = 'workout-card' + (isSelected ? ' is-selected' : '');

  // ── Header ───────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'workout-card-header';

  const checkbox = document.createElement('input');
  checkbox.type      = 'checkbox';
  checkbox.className = 'workout-checkbox';
  checkbox.checked   = isSelected;
  checkbox.addEventListener('change', () => {
    if (checkbox.checked) { state.selectedWorkouts.add(workout.id);    card.classList.add('is-selected'); }
    else                  { state.selectedWorkouts.delete(workout.id); card.classList.remove('is-selected'); }
    updateBulkBar();
  });

  // Workout info column: name + tags + session icons
  const workoutInfo = document.createElement('div');
  workoutInfo.className = 'workout-info';

  const nameEl = document.createElement('span');
  nameEl.className  = 'workout-name' + (workout.name ? '' : ' unnamed');
  nameEl.textContent = workout.name || 'Unnamed';
  workoutInfo.appendChild(nameEl);

  if (muscleTags.length > 0) {
    const tagsEl = document.createElement('div');
    tagsEl.className = 'muscle-tags';
    muscleTags.forEach(group => {
      const tag = document.createElement('span');
      tag.className        = 'muscle-tag';
      tag.style.background = MUSCLE_COLORS[group].bg;
      tag.style.color      = MUSCLE_COLORS[group].color;
      tag.textContent      = group;
      tagsEl.appendChild(tag);
    });
    workoutInfo.appendChild(tagsEl);
  }

  // Session icons (warm-up / stretching as circular emoji badges)
  const sessionKeys = [];
  if (workout.warmup)     sessionKeys.push('warmup');
  if (workout.stretching) sessionKeys.push('stretching');
  if (sessionKeys.length > 0) {
    const iconsRow = document.createElement('div');
    iconsRow.className = 'session-icons';
    sessionKeys.forEach(key => {
      const icon = document.createElement('span');
      icon.className   = 'session-icon';
      icon.textContent = SESSION_ICONS[key].emoji;
      icon.title       = SESSION_ICONS[key].label;
      iconsRow.appendChild(icon);
    });
    workoutInfo.appendChild(iconsRow);
  }

  // Expand button (green)
  const expandBtn = document.createElement('button');
  expandBtn.className   = 'btn-icon-action expand-btn';
  expandBtn.title       = isExpanded ? 'Collapse' : 'Expand';
  expandBtn.textContent = isExpanded ? '▲' : '▼';
  expandBtn.addEventListener('click', () => {
    if (state.expandedWorkouts.has(workout.id)) {
      state.expandedWorkouts.delete(workout.id);
      if (state.inlineEdit && state.inlineEdit.workoutId === workout.id) {
        state.inlineEdit = null; state.inlineEditData = null;
      }
    } else {
      state.expandedWorkouts.add(workout.id);
    }
    renderWorkoutHistory();
  });

  const editBtn = document.createElement('button');
  editBtn.className   = 'btn-icon-action';
  editBtn.title       = 'Edit workout';
  editBtn.textContent = '✏';
  editBtn.addEventListener('click', () => openEditModal(workout));

  const deleteBtn = document.createElement('button');
  deleteBtn.className   = 'btn-icon-action danger';
  deleteBtn.title       = 'Delete workout';
  deleteBtn.textContent = '✕';
  deleteBtn.addEventListener('click', () => deleteWorkout(workout.id));

  header.appendChild(checkbox);
  header.appendChild(workoutInfo);
  header.appendChild(expandBtn);
  header.appendChild(editBtn);
  header.appendChild(deleteBtn);
  card.appendChild(header);

  // ── Body ─────────────────────────────────────────
  if (isExpanded) {
    const body = document.createElement('div');
    body.className = 'workout-card-body';
    workout.exercises.forEach((ex, exIdx) => {
      const isInlineEdit =
        state.inlineEdit &&
        state.inlineEdit.workoutId === workout.id &&
        state.inlineEdit.exIdx === exIdx;
      body.appendChild(isInlineEdit ? buildInlineEditForm(workout, exIdx) : buildExerciseRow(workout, ex, exIdx));
    });
    card.appendChild(body);
  }

  return card;
}

function buildExerciseRow(workout, ex, exIdx) {
  const row = document.createElement('div');
  row.className = 'exercise-row';

  const name = document.createElement('span');
  name.className  = 'ex-name';
  name.textContent = ex.name;
  row.appendChild(name);

  if (ex.muscleGroup && MUSCLE_COLORS[ex.muscleGroup]) {
    const tag = document.createElement('span');
    tag.className        = 'muscle-tag';
    tag.style.background = MUSCLE_COLORS[ex.muscleGroup].bg;
    tag.style.color      = MUSCLE_COLORS[ex.muscleGroup].color;
    tag.textContent      = ex.muscleGroup;
    row.appendChild(tag);
  }

  const detail = document.createElement('span');
  detail.className = 'ex-detail';
  if (ex.type === 'reps') {
    detail.textContent = `${ex.sets} × ${ex.reps} reps`;
  } else {
    const mins = ex.minutes != null ? ex.minutes : Math.round((ex.duration || 0) / 60);
    detail.textContent = `${mins} min`;
  }
  row.appendChild(detail);

  const rowActions = document.createElement('div');
  rowActions.className = 'exercise-row-actions';

  const editBtn = document.createElement('button');
  editBtn.className   = 'btn-icon-action';
  editBtn.title       = 'Edit exercise';
  editBtn.textContent = '✏';
  editBtn.addEventListener('click', () => {
    state.inlineEdit = { workoutId: workout.id, exIdx };
    state.inlineEditData = {
      name:        ex.name,
      type:        ex.type,
      sets:        ex.sets    != null ? String(ex.sets)    : '',
      reps:        ex.reps    != null ? String(ex.reps)    : '',
      minutes:     ex.minutes != null ? String(ex.minutes) : (ex.type === 'time' ? String(Math.round((ex.duration || 0) / 60)) : ''),
      muscleGroup: ex.muscleGroup || '',
    };
    renderWorkoutHistory();
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.className   = 'btn-icon-action danger';
  deleteBtn.title       = 'Delete exercise';
  deleteBtn.textContent = '✕';
  deleteBtn.addEventListener('click', () => deleteExercise(workout.id, exIdx));

  rowActions.appendChild(editBtn);
  rowActions.appendChild(deleteBtn);
  row.appendChild(rowActions);
  return row;
}

function buildInlineEditForm(workout, exIdx) {
  const data = state.inlineEditData;
  const form = document.createElement('div');
  form.className = 'inline-edit-form';

  const nameInput = document.createElement('input');
  nameInput.type        = 'text';
  nameInput.className   = 'inline-name-input';
  nameInput.placeholder = 'Exercise name';
  nameInput.value       = data.name;
  nameInput.addEventListener('input', () => { data.name = nameInput.value; });
  form.appendChild(nameInput);

  const typeToggle = document.createElement('div');
  typeToggle.className = 'type-toggle';
  const repsBtn = document.createElement('button');
  repsBtn.className   = 'type-btn' + (data.type === 'reps' ? ' active' : '');
  repsBtn.textContent = 'Reps'; repsBtn.type = 'button';
  const timeBtn = document.createElement('button');
  timeBtn.className   = 'type-btn' + (data.type === 'time' ? ' active' : '');
  timeBtn.textContent = 'Time'; timeBtn.type = 'button';
  typeToggle.appendChild(repsBtn); typeToggle.appendChild(timeBtn);
  form.appendChild(typeToggle);

  const muscleSelect = buildMuscleSelect(data.muscleGroup, val => { data.muscleGroup = val; });
  form.appendChild(muscleSelect);

  const repsWrap = document.createElement('div');
  repsWrap.className = 'fields-row';
  const setsGroup = document.createElement('div'); setsGroup.className = 'num-input-wrap';
  const setsLbl = document.createElement('label'); setsLbl.textContent = 'Sets';
  const setsInp = document.createElement('input');
  setsInp.type = 'number'; setsInp.min = '1'; setsInp.placeholder = '0'; setsInp.value = data.sets;
  setsInp.addEventListener('input', () => { data.sets = setsInp.value; });
  setsGroup.appendChild(setsLbl); setsGroup.appendChild(setsInp);
  const inlineSep = document.createElement('span');
  inlineSep.className = 'fields-separator'; inlineSep.textContent = '×';
  const repsGroup = document.createElement('div'); repsGroup.className = 'num-input-wrap';
  const repsLbl = document.createElement('label'); repsLbl.textContent = 'Reps';
  const repsInp = document.createElement('input');
  repsInp.type = 'number'; repsInp.min = '1'; repsInp.placeholder = '0'; repsInp.value = data.reps;
  repsInp.addEventListener('input', () => { data.reps = repsInp.value; });
  repsGroup.appendChild(repsLbl); repsGroup.appendChild(repsInp);
  repsWrap.appendChild(setsGroup); repsWrap.appendChild(inlineSep); repsWrap.appendChild(repsGroup);

  const timeWrap = document.createElement('div');
  timeWrap.className = 'fields-row';
  const minsGroup = document.createElement('div'); minsGroup.className = 'num-input-wrap';
  const minsLbl = document.createElement('label'); minsLbl.textContent = 'Minutes';
  const minsInp = document.createElement('input');
  minsInp.type = 'number'; minsInp.min = '1'; minsInp.placeholder = '0'; minsInp.value = data.minutes;
  minsInp.addEventListener('input', () => { data.minutes = minsInp.value; });
  minsGroup.appendChild(minsLbl); minsGroup.appendChild(minsInp);
  timeWrap.appendChild(minsGroup);

  repsWrap.classList.toggle('hidden', data.type !== 'reps');
  timeWrap.classList.toggle('hidden', data.type !== 'time');

  const errEl = document.createElement('span');
  errEl.className = 'ex-error';

  repsBtn.addEventListener('click', () => {
    data.type = 'reps';
    repsBtn.classList.add('active'); timeBtn.classList.remove('active');
    repsWrap.classList.remove('hidden'); timeWrap.classList.add('hidden');
    errEl.textContent = '';
  });
  timeBtn.addEventListener('click', () => {
    data.type = 'time';
    timeBtn.classList.add('active'); repsBtn.classList.remove('active');
    timeWrap.classList.remove('hidden'); repsWrap.classList.add('hidden');
    errEl.textContent = '';
  });

  form.appendChild(repsWrap);
  form.appendChild(timeWrap);
  form.appendChild(errEl);

  const footer = document.createElement('div');
  footer.className = 'inline-edit-footer';
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn-ghost'; cancelBtn.textContent = 'Cancel'; cancelBtn.type = 'button';
  cancelBtn.addEventListener('click', () => {
    state.inlineEdit = null; state.inlineEditData = null; renderWorkoutHistory();
  });
  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn-primary'; saveBtn.textContent = 'Save'; saveBtn.type = 'button';
  saveBtn.addEventListener('click', () => saveInlineEdit(workout.id, exIdx, errEl));
  footer.appendChild(cancelBtn); footer.appendChild(saveBtn);
  form.appendChild(footer);
  return form;
}

function buildMuscleSelect(currentValue, onChange) {
  const select = document.createElement('select');
  select.className = 'select-input';
  const blank = document.createElement('option');
  blank.value = ''; blank.textContent = '— Muscle Group —';
  select.appendChild(blank);
  MUSCLE_GROUPS.forEach(group => {
    const opt = document.createElement('option');
    opt.value = group; opt.textContent = group;
    if (group === currentValue) opt.selected = true;
    select.appendChild(opt);
  });
  select.addEventListener('change', () => onChange(select.value));
  return select;
}

// ==================== INLINE EXERCISE EDIT ====================

function saveInlineEdit(workoutId, exIdx, errEl) {
  const data = state.inlineEditData;
  if (!data.name.trim())           { errEl.textContent = 'Exercise name is required.';       return; }
  if (data.type === 'reps') {
    if (!isPositiveInt(data.sets)) { errEl.textContent = 'Sets must be a positive integer.';  return; }
    if (!isPositiveInt(data.reps)) { errEl.textContent = 'Reps must be a positive integer.';  return; }
  } else {
    if (!isPositiveInt(data.minutes)) { errEl.textContent = 'Minutes must be a positive integer.'; return; }
  }
  const workouts = getWorkouts();
  const workout  = workouts.find(w => w.id === workoutId);
  if (!workout) return;
  workout.exercises[exIdx] = data.type === 'reps'
    ? { name: data.name.trim(), type: 'reps', sets: parseInt(data.sets), reps: parseInt(data.reps), duration: 0, muscleGroup: data.muscleGroup }
    : { name: data.name.trim(), type: 'time', sets: 1, reps: 0, minutes: parseInt(data.minutes), duration: parseInt(data.minutes) * 60, muscleGroup: data.muscleGroup };
  saveWorkouts(workouts);
  state.inlineEdit = null; state.inlineEditData = null;
  renderWorkoutHistory();
  showToast('Exercise updated.');
}

// ==================== DELETE OPERATIONS ====================

function deleteWorkout(workoutId) {
  const workouts = getWorkouts().filter(w => w.id !== workoutId);
  saveWorkouts(workouts);
  state.expandedWorkouts.delete(workoutId);
  state.selectedWorkouts.delete(workoutId);
  if (state.inlineEdit && state.inlineEdit.workoutId === workoutId) {
    state.inlineEdit = null; state.inlineEditData = null;
  }
  renderWorkoutHistory();
  showToast('Workout deleted.');
}

function deleteExercise(workoutId, exIdx) {
  const workouts = getWorkouts();
  const workout  = workouts.find(w => w.id === workoutId);
  if (!workout) return;
  workout.exercises.splice(exIdx, 1);
  if (workout.exercises.length === 0) {
    saveWorkouts(workouts.filter(w => w.id !== workoutId));
    state.expandedWorkouts.delete(workoutId);
    state.selectedWorkouts.delete(workoutId);
  } else {
    saveWorkouts(workouts);
  }
  if (state.inlineEdit && state.inlineEdit.workoutId === workoutId && state.inlineEdit.exIdx === exIdx) {
    state.inlineEdit = null; state.inlineEditData = null;
  }
  renderWorkoutHistory();
  showToast('Exercise deleted.');
}

// ==================== BULK OPERATIONS ====================

function updateBulkBar() {
  const bar   = document.getElementById('bulk-bar');
  const count = state.selectedWorkouts.size;
  if (count > 0) {
    bar.classList.remove('hidden');
    document.getElementById('bulk-count').textContent = `${count} workout${count !== 1 ? 's' : ''} selected`;
  } else {
    bar.classList.add('hidden');
  }
}

function bulkDelete() {
  const count = state.selectedWorkouts.size;
  const workouts = getWorkouts().filter(w => !state.selectedWorkouts.has(w.id));
  saveWorkouts(workouts);
  state.selectedWorkouts.forEach(id => {
    state.expandedWorkouts.delete(id);
    if (state.inlineEdit && state.inlineEdit.workoutId === id) {
      state.inlineEdit = null; state.inlineEditData = null;
    }
  });
  state.selectedWorkouts.clear();
  renderWorkoutHistory();
  showToast(`Deleted ${count} workout${count !== 1 ? 's' : ''}.`);
}

function clearSelection() {
  state.selectedWorkouts.clear();
  renderWorkoutHistory();
}

// ==================== MODAL (ADD / EDIT WORKOUT) ====================

function resetModalForm() {
  document.getElementById('modal-date-text').classList.remove('error');
  document.getElementById('date-error').textContent = '';
}

function openModal() {
  state.editingWorkoutId = null;
  state.modalDate        = TODAY;
  state.modalName        = '';
  state.modalWarmup      = false;
  state.modalStretching  = false;
  state.modalExercises   = [];

  document.getElementById('modal-title').textContent      = 'Add Workout';
  document.getElementById('modal-workout-name').value     = '';
  document.getElementById('modal-date-text').value        = toDisplayDate(TODAY);
  document.getElementById('modal-date-picker').value      = TODAY;
  document.getElementById('modal-warmup').checked         = false;
  document.getElementById('modal-stretching').checked     = false;
  document.getElementById('btn-delete-workout').classList.add('hidden');
  resetModalForm();
  document.getElementById('modal-overlay').classList.remove('hidden');
  renderModalExercises();
}

function openEditModal(workout) {
  state.editingWorkoutId = workout.id;
  state.modalDate        = workout.date;
  state.modalName        = workout.name || '';
  state.modalWarmup      = workout.warmup || false;
  state.modalStretching  = workout.stretching || false;
  state.modalExercises   = workout.exercises.map(ex => ({
    id:          generateId(),
    name:        ex.name,
    type:        ex.type,
    sets:        ex.sets    != null ? String(ex.sets)    : '',
    reps:        ex.reps    != null ? String(ex.reps)    : '',
    minutes:     ex.minutes != null ? String(ex.minutes) : (ex.type === 'time' ? String(Math.round((ex.duration || 0) / 60)) : ''),
    muscleGroup: ex.muscleGroup || '',
  }));

  document.getElementById('modal-title').textContent      = 'Edit Workout';
  document.getElementById('modal-workout-name').value     = state.modalName;
  document.getElementById('modal-date-text').value        = toDisplayDate(workout.date);
  document.getElementById('modal-date-picker').value      = workout.date;
  document.getElementById('modal-warmup').checked         = state.modalWarmup;
  document.getElementById('modal-stretching').checked     = state.modalStretching;
  document.getElementById('btn-delete-workout').classList.remove('hidden');
  resetModalForm();
  document.getElementById('modal-overlay').classList.remove('hidden');
  renderModalExercises();
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  state.editingWorkoutId = null;
}

function renderModalExercises() {
  const container = document.getElementById('modal-exercises');
  container.innerHTML = '';

  state.modalExercises.forEach((ex, i) => {
    const card = document.createElement('div');
    card.className = 'exercise-card';

    const cardHeader = document.createElement('div');
    cardHeader.className = 'exercise-card-header';
    const nameInput = document.createElement('input');
    nameInput.type = 'text'; nameInput.placeholder = 'Exercise name'; nameInput.value = ex.name;
    nameInput.addEventListener('input', () => { state.modalExercises[i].name = nameInput.value; clearExError(card); });
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-remove-ex'; removeBtn.title = 'Remove exercise';
    removeBtn.textContent = '✕'; removeBtn.type = 'button';
    removeBtn.addEventListener('click', () => { state.modalExercises.splice(i, 1); renderModalExercises(); });
    cardHeader.appendChild(nameInput); cardHeader.appendChild(removeBtn);
    card.appendChild(cardHeader);

    const typeToggle = document.createElement('div');
    typeToggle.className = 'type-toggle';
    const repsBtn = document.createElement('button');
    repsBtn.className = 'type-btn' + (ex.type === 'reps' ? ' active' : '');
    repsBtn.textContent = 'Reps'; repsBtn.type = 'button';
    const timeBtn = document.createElement('button');
    timeBtn.className = 'type-btn' + (ex.type === 'time' ? ' active' : '');
    timeBtn.textContent = 'Time'; timeBtn.type = 'button';
    typeToggle.appendChild(repsBtn); typeToggle.appendChild(timeBtn);
    card.appendChild(typeToggle);

    const muscleSelect = buildMuscleSelect(ex.muscleGroup, val => { state.modalExercises[i].muscleGroup = val; });
    card.appendChild(muscleSelect);

    const repsFields = buildRepsFields(i, ex);
    const timeFields = buildTimeFields(i, ex);
    repsFields.classList.toggle('hidden', ex.type !== 'reps');
    timeFields.classList.toggle('hidden', ex.type !== 'time');

    repsBtn.addEventListener('click', () => {
      state.modalExercises[i].type = 'reps';
      repsBtn.classList.add('active'); timeBtn.classList.remove('active');
      repsFields.classList.remove('hidden'); timeFields.classList.add('hidden');
      clearExError(card);
    });
    timeBtn.addEventListener('click', () => {
      state.modalExercises[i].type = 'time';
      timeBtn.classList.add('active'); repsBtn.classList.remove('active');
      timeFields.classList.remove('hidden'); repsFields.classList.add('hidden');
      clearExError(card);
    });

    card.appendChild(repsFields); card.appendChild(timeFields);
    const errSpan = document.createElement('span'); errSpan.className = 'ex-error';
    card.appendChild(errSpan);
    container.appendChild(card);
  });
}

function buildRepsFields(i, ex) {
  const wrap = document.createElement('div'); wrap.className = 'fields-row';
  const setsWrap = document.createElement('div'); setsWrap.className = 'num-input-wrap';
  const setsLabel = document.createElement('label'); setsLabel.textContent = 'Sets';
  const setsInput = document.createElement('input');
  setsInput.type = 'number'; setsInput.min = '1'; setsInput.placeholder = '0'; setsInput.value = ex.sets;
  setsInput.addEventListener('input', () => { state.modalExercises[i].sets = setsInput.value; });
  setsWrap.appendChild(setsLabel); setsWrap.appendChild(setsInput);
  const sep = document.createElement('span'); sep.className = 'fields-separator'; sep.textContent = '×';
  const repsWrap = document.createElement('div'); repsWrap.className = 'num-input-wrap';
  const repsLabel = document.createElement('label'); repsLabel.textContent = 'Reps';
  const repsInput = document.createElement('input');
  repsInput.type = 'number'; repsInput.min = '1'; repsInput.placeholder = '0'; repsInput.value = ex.reps;
  repsInput.addEventListener('input', () => { state.modalExercises[i].reps = repsInput.value; });
  repsWrap.appendChild(repsLabel); repsWrap.appendChild(repsInput);
  wrap.appendChild(setsWrap); wrap.appendChild(sep); wrap.appendChild(repsWrap);
  return wrap;
}

function buildTimeFields(i, ex) {
  const wrap = document.createElement('div'); wrap.className = 'fields-row';
  const minsWrap = document.createElement('div'); minsWrap.className = 'num-input-wrap';
  const minsLabel = document.createElement('label'); minsLabel.textContent = 'Minutes';
  const minsInput = document.createElement('input');
  minsInput.type = 'number'; minsInput.min = '1'; minsInput.placeholder = '0'; minsInput.value = ex.minutes;
  minsInput.addEventListener('input', () => { state.modalExercises[i].minutes = minsInput.value; });
  minsWrap.appendChild(minsLabel); minsWrap.appendChild(minsInput);
  wrap.appendChild(minsWrap);
  return wrap;
}

function clearExError(card) {
  card.classList.remove('has-error');
  const errSpan = card.querySelector('.ex-error');
  if (errSpan) errSpan.textContent = '';
}

function setExError(card, msg) {
  card.classList.add('has-error');
  const errSpan = card.querySelector('.ex-error');
  if (errSpan) errSpan.textContent = msg;
}

// ==================== VALIDATION & SAVE ====================

function validateAndSave() {
  let valid = true;
  const dateTextEl = document.getElementById('modal-date-text');
  const dateError  = document.getElementById('date-error');
  dateError.textContent = ''; dateTextEl.classList.remove('error');

  const parsedDate = parseDDMMYYYY(dateTextEl.value);
  if (parsedDate) {
    state.modalDate = parsedDate;
  } else {
    dateError.textContent = 'Please enter a valid date in DD-MM-YYYY format.';
    dateTextEl.classList.add('error'); valid = false;
  }

  if (state.modalExercises.length === 0) { showToast('Add at least one exercise.', 'error'); return; }

  const cards = document.querySelectorAll('#modal-exercises .exercise-card');
  state.modalExercises.forEach((ex, i) => {
    const card = cards[i]; if (!card) return;
    clearExError(card);
    if (!ex.name.trim()) { setExError(card, 'Exercise name is required.'); valid = false; return; }
    if (ex.type === 'reps') {
      if (!isPositiveInt(ex.sets)) { setExError(card, 'Sets must be a positive integer.');  valid = false; return; }
      if (!isPositiveInt(ex.reps)) { setExError(card, 'Reps must be a positive integer.');  valid = false; return; }
    } else {
      if (!isPositiveInt(ex.minutes)) { setExError(card, 'Minutes must be a positive integer.'); valid = false; return; }
    }
  });
  if (!valid) return;

  const exercises = state.modalExercises.map(ex =>
    ex.type === 'reps'
      ? { name: ex.name.trim(), type: 'reps', sets: parseInt(ex.sets), reps: parseInt(ex.reps), duration: 0, muscleGroup: ex.muscleGroup }
      : { name: ex.name.trim(), type: 'time', sets: 1, reps: 0, minutes: parseInt(ex.minutes), duration: parseInt(ex.minutes) * 60, muscleGroup: ex.muscleGroup }
  );

  const workoutName = document.getElementById('modal-workout-name').value.trim();
  const warmup      = document.getElementById('modal-warmup').checked;
  const stretching  = document.getElementById('modal-stretching').checked;
  const workouts    = getWorkouts();

  if (state.editingWorkoutId) {
    const idx = workouts.findIndex(w => w.id === state.editingWorkoutId);
    if (idx >= 0) workouts[idx] = { ...workouts[idx], name: workoutName, date: state.modalDate, warmup, stretching, exercises };
    saveWorkouts(workouts);
    closeModal(); renderWorkoutHistory(); showToast('Workout updated.');
  } else {
    workouts.push({ id: generateId(), name: workoutName, date: state.modalDate, timestamp: new Date().toISOString(), warmup, stretching, exercises });
    saveWorkouts(workouts);
    closeModal(); renderWorkoutHistory(); showToast('Workout saved!');
  }
}

// ==================== EVENT BINDING ====================

function bindAllEvents() {
  document.getElementById('btn-add-workout').addEventListener('click', openModal);
  document.getElementById('btn-modal-close').addEventListener('click', closeModal);
  document.getElementById('btn-modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });

  document.getElementById('btn-delete-workout').addEventListener('click', () => {
    if (state.editingWorkoutId) { deleteWorkout(state.editingWorkoutId); closeModal(); }
  });

  const dateTextEl   = document.getElementById('modal-date-text');
  const datePickerEl = document.getElementById('modal-date-picker');
  const dateError    = document.getElementById('date-error');

  dateTextEl.addEventListener('blur', () => {
    const parsed = parseDDMMYYYY(dateTextEl.value);
    if (parsed) {
      state.modalDate = parsed; datePickerEl.value = parsed;
      dateTextEl.classList.remove('error'); dateError.textContent = '';
    } else if (dateTextEl.value.trim()) {
      dateTextEl.classList.add('error'); dateError.textContent = 'Enter a valid date in DD-MM-YYYY format.';
    }
  });
  dateTextEl.addEventListener('input', () => { dateTextEl.classList.remove('error'); dateError.textContent = ''; });
  document.getElementById('btn-calendar-icon').addEventListener('click', () => {
    if (datePickerEl.showPicker) { datePickerEl.showPicker(); } else { datePickerEl.click(); }
  });
  datePickerEl.addEventListener('change', () => {
    if (datePickerEl.value) {
      state.modalDate = datePickerEl.value;
      dateTextEl.value = toDisplayDate(datePickerEl.value);
      dateTextEl.classList.remove('error'); dateError.textContent = '';
    }
  });

  document.getElementById('btn-add-exercise').addEventListener('click', () => {
    state.modalExercises.push({ id: generateId(), name: '', type: 'reps', sets: '', reps: '', minutes: '', muscleGroup: '' });
    renderModalExercises();
  });
  document.getElementById('btn-save-workout').addEventListener('click', validateAndSave);

  document.getElementById('btn-bulk-delete').addEventListener('click', bulkDelete);
  document.getElementById('btn-bulk-clear').addEventListener('click', clearSelection);

  // Filter toggle
  document.getElementById('btn-toggle-filter').addEventListener('click', () => {
    state.filterOpen = !state.filterOpen;
    document.getElementById('filter-panel').classList.toggle('hidden', !state.filterOpen);
  });
}

// ==================== INIT ====================

function init() {
  document.getElementById('header-date').textContent = formatDateDisplay(TODAY);
  buildFilterPanel();
  bindAllEvents();
  renderWorkoutHistory();
}

document.addEventListener('DOMContentLoaded', init);
