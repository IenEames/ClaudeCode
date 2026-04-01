// ==================== CONSTANTS & DATA LAYER ====================

const KEYS = { WORKOUTS: 'ft_workouts' };
const TODAY = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

function loadData(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveData(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
function getWorkouts()       { return loadData(KEYS.WORKOUTS); }
function saveWorkouts(data)  { saveData(KEYS.WORKOUTS, data); }

// ==================== STATE ====================

const state = {
  // Modal
  modalDate:        TODAY,   // YYYY-MM-DD
  modalExercises:   [],      // [{ id, name, type, sets, reps, minutes }]
  editingWorkoutId: null,    // null = adding new | string = editing existing

  // History UI
  expandedWorkouts: new Set(),   // workout IDs currently expanded
  selectedWorkouts: new Set(),   // workout IDs checked for bulk ops

  // Inline exercise edit
  inlineEdit:     null,          // { workoutId, exIdx } | null
  inlineEditData: null,          // { name, type, sets, reps, minutes } — mutable
};

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

// YYYY-MM-DD → DD-MM-YYYY
function toDisplayDate(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}-${m}-${y}`;
}

// DD-MM-YYYY → YYYY-MM-DD, or null if invalid
function parseDDMMYYYY(str) {
  const match = str.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  const date = new Date(+y, +m - 1, +d);
  if (
    date.getFullYear() !== +y ||
    date.getMonth()    !== +m - 1 ||
    date.getDate()     !== +d
  ) return null;
  return `${y}-${m}-${d}`;
}

// ISO timestamp → "3:45 PM"
function formatTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
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

// ==================== WORKOUT HISTORY ====================

function renderWorkoutHistory() {
  const workouts = getWorkouts();
  const container = document.getElementById('workout-history');
  container.innerHTML = '';

  if (workouts.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No workouts logged yet. Click "+ Add Workout" to get started.';
    container.appendChild(empty);
    updateBulkBar();
    return;
  }

  // Sort by timestamp desc (fall back to date for legacy entries without timestamp)
  const sorted = [...workouts].sort((a, b) => {
    const tsA = a.timestamp || (a.date + 'T00:00:00.000Z');
    const tsB = b.timestamp || (b.date + 'T00:00:00.000Z');
    return tsB.localeCompare(tsA);
  });

  // Group by date, preserving sorted order
  const dateOrder = [];
  const groups = {};
  for (const w of sorted) {
    if (!groups[w.date]) {
      groups[w.date] = [];
      dateOrder.push(w.date);
    }
    groups[w.date].push(w);
  }

  dateOrder.forEach(date => {
    const header = document.createElement('div');
    header.className = 'date-header';
    header.textContent = formatDateDisplay(date);
    container.appendChild(header);

    groups[date].forEach(workout => {
      container.appendChild(buildWorkoutCard(workout));
    });
  });

  updateBulkBar();
}

function buildWorkoutCard(workout) {
  const isExpanded = state.expandedWorkouts.has(workout.id);
  const isSelected = state.selectedWorkouts.has(workout.id);
  const exCount    = workout.exercises.length;

  const card = document.createElement('div');
  card.className = 'workout-card' + (isSelected ? ' is-selected' : '');

  // ── Header ────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'workout-card-header';

  // Checkbox
  const checkbox = document.createElement('input');
  checkbox.type    = 'checkbox';
  checkbox.className = 'workout-checkbox';
  checkbox.checked = isSelected;
  checkbox.addEventListener('change', () => {
    if (checkbox.checked) {
      state.selectedWorkouts.add(workout.id);
      card.classList.add('is-selected');
    } else {
      state.selectedWorkouts.delete(workout.id);
      card.classList.remove('is-selected');
    }
    updateBulkBar();
  });

  // Summary text
  const summary = document.createElement('div');
  summary.className = 'workout-summary';

  const countEl = document.createElement('span');
  countEl.className = 'workout-ex-count';
  countEl.textContent = `${exCount} exercise${exCount !== 1 ? 's' : ''}`;
  summary.appendChild(countEl);

  const timeStr = formatTime(workout.timestamp);
  if (timeStr) {
    const timeEl = document.createElement('span');
    timeEl.className = 'workout-time';
    timeEl.textContent = timeStr;
    summary.appendChild(timeEl);
  }

  // Action buttons
  const actions = document.createElement('div');
  actions.className = 'workout-card-actions';

  const expandBtn = document.createElement('button');
  expandBtn.className = 'btn-icon-action expand-btn' + (isExpanded ? ' open' : '');
  expandBtn.title = isExpanded ? 'Collapse' : 'Expand';
  expandBtn.textContent = isExpanded ? '▲' : '▼';
  expandBtn.addEventListener('click', () => {
    if (state.expandedWorkouts.has(workout.id)) {
      state.expandedWorkouts.delete(workout.id);
      // Cancel any inline edit inside this workout
      if (state.inlineEdit && state.inlineEdit.workoutId === workout.id) {
        state.inlineEdit = null;
        state.inlineEditData = null;
      }
    } else {
      state.expandedWorkouts.add(workout.id);
    }
    renderWorkoutHistory();
  });

  const editBtn = document.createElement('button');
  editBtn.className = 'btn-icon-action';
  editBtn.title = 'Edit workout';
  editBtn.textContent = '✏';
  editBtn.addEventListener('click', () => openEditModal(workout));

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn-icon-action danger';
  deleteBtn.title = 'Delete workout';
  deleteBtn.textContent = '✕';
  deleteBtn.addEventListener('click', () => deleteWorkout(workout.id));

  actions.appendChild(expandBtn);
  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);

  header.appendChild(checkbox);
  header.appendChild(summary);
  header.appendChild(actions);
  card.appendChild(header);

  // ── Body (exercises, shown when expanded) ────────
  if (isExpanded) {
    const body = document.createElement('div');
    body.className = 'workout-card-body';

    workout.exercises.forEach((ex, exIdx) => {
      const isInlineEdit =
        state.inlineEdit &&
        state.inlineEdit.workoutId === workout.id &&
        state.inlineEdit.exIdx === exIdx;

      body.appendChild(
        isInlineEdit
          ? buildInlineEditForm(workout, exIdx)
          : buildExerciseRow(workout, ex, exIdx)
      );
    });

    card.appendChild(body);
  }

  return card;
}

function buildExerciseRow(workout, ex, exIdx) {
  const row = document.createElement('div');
  row.className = 'exercise-row';

  const name = document.createElement('span');
  name.className = 'ex-name';
  name.textContent = ex.name;

  const detail = document.createElement('span');
  detail.className = 'ex-detail';
  if (ex.type === 'reps') {
    detail.textContent = `${ex.sets} × ${ex.reps} reps`;
  } else {
    const mins = ex.minutes != null ? ex.minutes : Math.round((ex.duration || 0) / 60);
    detail.textContent = `${mins} min`;
  }

  const rowActions = document.createElement('div');
  rowActions.className = 'exercise-row-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'btn-icon-action';
  editBtn.title = 'Edit exercise';
  editBtn.textContent = '✏';
  editBtn.addEventListener('click', () => {
    state.inlineEdit = { workoutId: workout.id, exIdx };
    state.inlineEditData = {
      name:    ex.name,
      type:    ex.type,
      sets:    ex.sets    != null ? String(ex.sets)    : '',
      reps:    ex.reps    != null ? String(ex.reps)    : '',
      minutes: ex.minutes != null ? String(ex.minutes) : (ex.type === 'time' ? String(Math.round((ex.duration || 0) / 60)) : ''),
    };
    renderWorkoutHistory();
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn-icon-action danger';
  deleteBtn.title = 'Delete exercise';
  deleteBtn.textContent = '✕';
  deleteBtn.addEventListener('click', () => deleteExercise(workout.id, exIdx));

  rowActions.appendChild(editBtn);
  rowActions.appendChild(deleteBtn);

  row.appendChild(name);
  row.appendChild(detail);
  row.appendChild(rowActions);
  return row;
}

function buildInlineEditForm(workout, exIdx) {
  const data = state.inlineEditData;

  const form = document.createElement('div');
  form.className = 'inline-edit-form';

  // Name
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'inline-name-input';
  nameInput.placeholder = 'Exercise name';
  nameInput.value = data.name;
  nameInput.addEventListener('input', () => { data.name = nameInput.value; });
  form.appendChild(nameInput);

  // Type toggle
  const typeToggle = document.createElement('div');
  typeToggle.className = 'type-toggle';

  const repsBtn = document.createElement('button');
  repsBtn.className = 'type-btn' + (data.type === 'reps' ? ' active' : '');
  repsBtn.textContent = 'Reps';
  repsBtn.type = 'button';

  const timeBtn = document.createElement('button');
  timeBtn.className = 'type-btn' + (data.type === 'time' ? ' active' : '');
  timeBtn.textContent = 'Time';
  timeBtn.type = 'button';

  // Reps fields
  const repsWrap = document.createElement('div');
  repsWrap.className = 'fields-row';

  const setsGroup = document.createElement('div');
  setsGroup.className = 'num-input-wrap';
  const setsLbl = document.createElement('label');
  setsLbl.textContent = 'Sets';
  const setsInp = document.createElement('input');
  setsInp.type = 'number'; setsInp.min = '1'; setsInp.placeholder = '0';
  setsInp.value = data.sets;
  setsInp.addEventListener('input', () => { data.sets = setsInp.value; });
  setsGroup.appendChild(setsLbl); setsGroup.appendChild(setsInp);

  const inlineSep = document.createElement('span');
  inlineSep.className = 'fields-separator';
  inlineSep.textContent = '×';

  const repsGroup = document.createElement('div');
  repsGroup.className = 'num-input-wrap';
  const repsLbl = document.createElement('label');
  repsLbl.textContent = 'Reps';
  const repsInp = document.createElement('input');
  repsInp.type = 'number'; repsInp.min = '1'; repsInp.placeholder = '0';
  repsInp.value = data.reps;
  repsInp.addEventListener('input', () => { data.reps = repsInp.value; });
  repsGroup.appendChild(repsLbl); repsGroup.appendChild(repsInp);

  repsWrap.appendChild(setsGroup);
  repsWrap.appendChild(inlineSep);
  repsWrap.appendChild(repsGroup);

  // Time fields
  const timeWrap = document.createElement('div');
  timeWrap.className = 'fields-row';

  const minsGroup = document.createElement('div');
  minsGroup.className = 'num-input-wrap';
  const minsLbl = document.createElement('label');
  minsLbl.textContent = 'Minutes';
  const minsInp = document.createElement('input');
  minsInp.type = 'number'; minsInp.min = '1'; minsInp.placeholder = '0';
  minsInp.value = data.minutes;
  minsInp.addEventListener('input', () => { data.minutes = minsInp.value; });
  minsGroup.appendChild(minsLbl); minsGroup.appendChild(minsInp);
  timeWrap.appendChild(minsGroup);

  // Wire type toggle to show/hide field sets
  repsWrap.classList.toggle('hidden', data.type !== 'reps');
  timeWrap.classList.toggle('hidden', data.type !== 'time');

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

  typeToggle.appendChild(repsBtn);
  typeToggle.appendChild(timeBtn);
  form.appendChild(typeToggle);
  form.appendChild(repsWrap);
  form.appendChild(timeWrap);

  // Error
  const errEl = document.createElement('span');
  errEl.className = 'ex-error';
  form.appendChild(errEl);

  // Footer
  const footer = document.createElement('div');
  footer.className = 'inline-edit-footer';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn-ghost';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.type = 'button';
  cancelBtn.addEventListener('click', () => {
    state.inlineEdit = null;
    state.inlineEditData = null;
    renderWorkoutHistory();
  });

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn-primary';
  saveBtn.textContent = 'Save';
  saveBtn.type = 'button';
  saveBtn.addEventListener('click', () => saveInlineEdit(workout.id, exIdx, errEl));

  footer.appendChild(cancelBtn);
  footer.appendChild(saveBtn);
  form.appendChild(footer);

  return form;
}

// ==================== INLINE EXERCISE EDIT ====================

function saveInlineEdit(workoutId, exIdx, errEl) {
  const data = state.inlineEditData;

  if (!data.name.trim()) {
    errEl.textContent = 'Exercise name is required.';
    return;
  }
  if (data.type === 'reps') {
    if (!isPositiveInt(data.sets))  { errEl.textContent = 'Sets must be a positive integer.';  return; }
    if (!isPositiveInt(data.reps))  { errEl.textContent = 'Reps must be a positive integer.';  return; }
  } else {
    if (!isPositiveInt(data.minutes)) { errEl.textContent = 'Minutes must be a positive integer.'; return; }
  }

  const workouts = getWorkouts();
  const workout  = workouts.find(w => w.id === workoutId);
  if (!workout) return;

  workout.exercises[exIdx] = data.type === 'reps'
    ? { name: data.name.trim(), type: 'reps', sets: parseInt(data.sets), reps: parseInt(data.reps), duration: 0 }
    : { name: data.name.trim(), type: 'time', sets: 1, reps: 0, minutes: parseInt(data.minutes), duration: parseInt(data.minutes) * 60 };

  saveWorkouts(workouts);
  state.inlineEdit = null;
  state.inlineEditData = null;
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
    state.inlineEdit = null;
    state.inlineEditData = null;
  }
  renderWorkoutHistory();
  showToast('Workout deleted.');
}

function deleteExercise(workoutId, exIdx) {
  const workouts = getWorkouts();
  const workout  = workouts.find(w => w.id === workoutId);
  if (!workout) return;

  workout.exercises.splice(exIdx, 1);

  // If no exercises remain, remove the whole record
  if (workout.exercises.length === 0) {
    const filtered = workouts.filter(w => w.id !== workoutId);
    saveWorkouts(filtered);
    state.expandedWorkouts.delete(workoutId);
    state.selectedWorkouts.delete(workoutId);
  } else {
    saveWorkouts(workouts);
  }

  if (state.inlineEdit && state.inlineEdit.workoutId === workoutId && state.inlineEdit.exIdx === exIdx) {
    state.inlineEdit = null;
    state.inlineEditData = null;
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
    document.getElementById('bulk-count').textContent =
      `${count} workout${count !== 1 ? 's' : ''} selected`;
  } else {
    bar.classList.add('hidden');
  }
}

function bulkDelete() {
  const count    = state.selectedWorkouts.size;
  const workouts = getWorkouts().filter(w => !state.selectedWorkouts.has(w.id));
  saveWorkouts(workouts);
  state.selectedWorkouts.forEach(id => {
    state.expandedWorkouts.delete(id);
    if (state.inlineEdit && state.inlineEdit.workoutId === id) {
      state.inlineEdit = null;
      state.inlineEditData = null;
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

function openModal() {
  state.editingWorkoutId = null;
  state.modalDate        = TODAY;
  state.modalExercises   = [];

  document.getElementById('modal-title').textContent     = 'Add Workout';
  document.getElementById('modal-date-text').value       = toDisplayDate(TODAY);
  document.getElementById('modal-date-text').classList.remove('error');
  document.getElementById('modal-date-picker').value     = TODAY;
  document.getElementById('date-error').textContent      = '';
  document.getElementById('modal-overlay').classList.remove('hidden');

  renderModalExercises();
}

function openEditModal(workout) {
  state.editingWorkoutId = workout.id;
  state.modalDate        = workout.date;
  state.modalExercises   = workout.exercises.map(ex => ({
    id:      generateId(),
    name:    ex.name,
    type:    ex.type,
    sets:    ex.sets    != null ? String(ex.sets)    : '',
    reps:    ex.reps    != null ? String(ex.reps)    : '',
    minutes: ex.minutes != null
      ? String(ex.minutes)
      : (ex.type === 'time' ? String(Math.round((ex.duration || 0) / 60)) : ''),
  }));

  document.getElementById('modal-title').textContent     = 'Edit Workout';
  document.getElementById('modal-date-text').value       = toDisplayDate(workout.date);
  document.getElementById('modal-date-text').classList.remove('error');
  document.getElementById('modal-date-picker').value     = workout.date;
  document.getElementById('date-error').textContent      = '';
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
    nameInput.type = 'text';
    nameInput.placeholder = 'Exercise name';
    nameInput.value = ex.name;
    nameInput.addEventListener('input', () => {
      state.modalExercises[i].name = nameInput.value;
      clearExError(card);
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-remove-ex';
    removeBtn.title = 'Remove exercise';
    removeBtn.textContent = '✕';
    removeBtn.type = 'button';
    removeBtn.addEventListener('click', () => {
      state.modalExercises.splice(i, 1);
      renderModalExercises();
    });

    cardHeader.appendChild(nameInput);
    cardHeader.appendChild(removeBtn);
    card.appendChild(cardHeader);

    const typeToggle = document.createElement('div');
    typeToggle.className = 'type-toggle';

    const repsBtn = document.createElement('button');
    repsBtn.className = 'type-btn' + (ex.type === 'reps' ? ' active' : '');
    repsBtn.textContent = 'Reps';
    repsBtn.type = 'button';

    const timeBtn = document.createElement('button');
    timeBtn.className = 'type-btn' + (ex.type === 'time' ? ' active' : '');
    timeBtn.textContent = 'Time';
    timeBtn.type = 'button';

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

    typeToggle.appendChild(repsBtn);
    typeToggle.appendChild(timeBtn);
    card.appendChild(typeToggle);
    card.appendChild(repsFields);
    card.appendChild(timeFields);

    const errSpan = document.createElement('span');
    errSpan.className = 'ex-error';
    card.appendChild(errSpan);

    container.appendChild(card);
  });
}

function buildRepsFields(i, ex) {
  const wrap = document.createElement('div');
  wrap.className = 'fields-row';

  const setsWrap = document.createElement('div');
  setsWrap.className = 'num-input-wrap';
  const setsLabel = document.createElement('label');
  setsLabel.textContent = 'Sets';
  const setsInput = document.createElement('input');
  setsInput.type = 'number'; setsInput.min = '1'; setsInput.placeholder = '0';
  setsInput.value = ex.sets;
  setsInput.addEventListener('input', () => { state.modalExercises[i].sets = setsInput.value; });
  setsWrap.appendChild(setsLabel); setsWrap.appendChild(setsInput);

  const sep = document.createElement('span');
  sep.className = 'fields-separator';
  sep.textContent = '×';

  const repsWrap = document.createElement('div');
  repsWrap.className = 'num-input-wrap';
  const repsLabel = document.createElement('label');
  repsLabel.textContent = 'Reps';
  const repsInput = document.createElement('input');
  repsInput.type = 'number'; repsInput.min = '1'; repsInput.placeholder = '0';
  repsInput.value = ex.reps;
  repsInput.addEventListener('input', () => { state.modalExercises[i].reps = repsInput.value; });
  repsWrap.appendChild(repsLabel); repsWrap.appendChild(repsInput);

  wrap.appendChild(setsWrap); wrap.appendChild(sep); wrap.appendChild(repsWrap);
  return wrap;
}

function buildTimeFields(i, ex) {
  const wrap = document.createElement('div');
  wrap.className = 'fields-row';

  const minsWrap = document.createElement('div');
  minsWrap.className = 'num-input-wrap';
  const minsLabel = document.createElement('label');
  minsLabel.textContent = 'Minutes';
  const minsInput = document.createElement('input');
  minsInput.type = 'number'; minsInput.min = '1'; minsInput.placeholder = '0';
  minsInput.value = ex.minutes;
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
  dateError.textContent = '';
  dateTextEl.classList.remove('error');

  const parsedDate = parseDDMMYYYY(dateTextEl.value);
  if (parsedDate) {
    state.modalDate = parsedDate;
  } else {
    dateError.textContent = 'Please enter a valid date in DD-MM-YYYY format.';
    dateTextEl.classList.add('error');
    valid = false;
  }

  if (state.modalExercises.length === 0) {
    showToast('Add at least one exercise.', 'error');
    return;
  }

  const cards = document.querySelectorAll('#modal-exercises .exercise-card');

  state.modalExercises.forEach((ex, i) => {
    const card = cards[i];
    if (!card) return;
    clearExError(card);

    if (!ex.name.trim()) {
      setExError(card, 'Exercise name is required.');
      valid = false;
      return;
    }
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
      ? { name: ex.name.trim(), type: 'reps', sets: parseInt(ex.sets), reps: parseInt(ex.reps), duration: 0 }
      : { name: ex.name.trim(), type: 'time', sets: 1, reps: 0, minutes: parseInt(ex.minutes), duration: parseInt(ex.minutes) * 60 }
  );

  const workouts = getWorkouts();

  if (state.editingWorkoutId) {
    const idx = workouts.findIndex(w => w.id === state.editingWorkoutId);
    if (idx >= 0) {
      workouts[idx] = { ...workouts[idx], date: state.modalDate, exercises };
    }
    saveWorkouts(workouts);
    closeModal();
    renderWorkoutHistory();
    showToast('Workout updated.');
  } else {
    workouts.push({
      id:        generateId(),
      date:      state.modalDate,
      timestamp: new Date().toISOString(),
      exercises,
    });
    saveWorkouts(workouts);
    closeModal();
    renderWorkoutHistory();
    showToast('Workout saved!');
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

  const dateTextEl   = document.getElementById('modal-date-text');
  const datePickerEl = document.getElementById('modal-date-picker');
  const dateError    = document.getElementById('date-error');

  dateTextEl.addEventListener('blur', () => {
    const parsed = parseDDMMYYYY(dateTextEl.value);
    if (parsed) {
      state.modalDate = parsed;
      datePickerEl.value = parsed;
      dateTextEl.classList.remove('error');
      dateError.textContent = '';
    } else if (dateTextEl.value.trim()) {
      dateTextEl.classList.add('error');
      dateError.textContent = 'Enter a valid date in DD-MM-YYYY format.';
    }
  });

  dateTextEl.addEventListener('input', () => {
    dateTextEl.classList.remove('error');
    dateError.textContent = '';
  });

  document.getElementById('btn-calendar-icon').addEventListener('click', () => {
    if (datePickerEl.showPicker) { datePickerEl.showPicker(); } else { datePickerEl.click(); }
  });

  datePickerEl.addEventListener('change', () => {
    if (datePickerEl.value) {
      state.modalDate = datePickerEl.value;
      dateTextEl.value = toDisplayDate(datePickerEl.value);
      dateTextEl.classList.remove('error');
      dateError.textContent = '';
    }
  });

  document.getElementById('btn-add-exercise').addEventListener('click', () => {
    state.modalExercises.push({ id: generateId(), name: '', type: 'reps', sets: '', reps: '', minutes: '' });
    renderModalExercises();
  });

  document.getElementById('btn-save-workout').addEventListener('click', validateAndSave);

  // Bulk bar
  document.getElementById('btn-bulk-delete').addEventListener('click', bulkDelete);
  document.getElementById('btn-bulk-clear').addEventListener('click', clearSelection);
}

// ==================== INIT ====================

function init() {
  document.getElementById('header-date').textContent = formatDateDisplay(TODAY);
  bindAllEvents();
  renderWorkoutHistory();
}

document.addEventListener('DOMContentLoaded', init);
