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
  modalDate:      TODAY,  // YYYY-MM-DD
  modalExercises: [],     // [{ id, name, type, sets, reps, minutes }]
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
    return;
  }

  // Sort by timestamp desc (fall back to date for legacy entries without timestamp)
  const sorted = [...workouts].sort((a, b) => {
    const tsA = a.timestamp || (a.date + 'T00:00:00.000Z');
    const tsB = b.timestamp || (b.date + 'T00:00:00.000Z');
    return tsB.localeCompare(tsA);
  });

  // Group by date, preserving timestamp-sorted order
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
      workout.exercises.forEach(ex => {
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
          // minutes field for new entries; fall back to duration (seconds) for legacy
          const mins = ex.minutes != null ? ex.minutes : Math.round((ex.duration || 0) / 60);
          detail.textContent = `${mins} min`;
        }

        row.appendChild(name);
        row.appendChild(detail);
        container.appendChild(row);
      });
    });
  });
}

// ==================== MODAL ====================

function openModal() {
  state.modalDate = TODAY;
  state.modalExercises = [];

  document.getElementById('modal-date-text').value = toDisplayDate(TODAY);
  document.getElementById('modal-date-text').classList.remove('error');
  document.getElementById('modal-date-picker').value = TODAY;
  document.getElementById('date-error').textContent = '';
  document.getElementById('modal-overlay').classList.remove('hidden');

  renderModalExercises();
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

function renderModalExercises() {
  const container = document.getElementById('modal-exercises');
  container.innerHTML = '';

  state.modalExercises.forEach((ex, i) => {
    const card = document.createElement('div');
    card.className = 'exercise-card';

    // Header: name input + remove button
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

    // Type toggle
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
      repsBtn.classList.add('active');
      timeBtn.classList.remove('active');
      repsFields.classList.remove('hidden');
      timeFields.classList.add('hidden');
      clearExError(card);
    });

    timeBtn.addEventListener('click', () => {
      state.modalExercises[i].type = 'time';
      timeBtn.classList.add('active');
      repsBtn.classList.remove('active');
      timeFields.classList.remove('hidden');
      repsFields.classList.add('hidden');
      clearExError(card);
    });

    typeToggle.appendChild(repsBtn);
    typeToggle.appendChild(timeBtn);
    card.appendChild(typeToggle);
    card.appendChild(repsFields);
    card.appendChild(timeFields);

    // Error message
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
  setsInput.type = 'number';
  setsInput.min = '1';
  setsInput.placeholder = '0';
  setsInput.value = ex.sets;
  setsInput.addEventListener('input', () => {
    state.modalExercises[i].sets = setsInput.value;
  });
  setsWrap.appendChild(setsLabel);
  setsWrap.appendChild(setsInput);

  const sep = document.createElement('span');
  sep.className = 'fields-separator';
  sep.textContent = '×';

  const repsWrap = document.createElement('div');
  repsWrap.className = 'num-input-wrap';
  const repsLabel = document.createElement('label');
  repsLabel.textContent = 'Reps';
  const repsInput = document.createElement('input');
  repsInput.type = 'number';
  repsInput.min = '1';
  repsInput.placeholder = '0';
  repsInput.value = ex.reps;
  repsInput.addEventListener('input', () => {
    state.modalExercises[i].reps = repsInput.value;
  });
  repsWrap.appendChild(repsLabel);
  repsWrap.appendChild(repsInput);

  wrap.appendChild(setsWrap);
  wrap.appendChild(sep);
  wrap.appendChild(repsWrap);
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
  minsInput.type = 'number';
  minsInput.min = '1';
  minsInput.placeholder = '0';
  minsInput.value = ex.minutes;
  minsInput.addEventListener('input', () => {
    state.modalExercises[i].minutes = minsInput.value;
  });
  minsWrap.appendChild(minsLabel);
  minsWrap.appendChild(minsInput);

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

  // Always re-parse from text field at save time
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
      if (!isPositiveInt(ex.sets)) {
        setExError(card, 'Sets must be a positive integer.');
        valid = false;
        return;
      }
      if (!isPositiveInt(ex.reps)) {
        setExError(card, 'Reps must be a positive integer.');
        valid = false;
        return;
      }
    } else {
      if (!isPositiveInt(ex.minutes)) {
        setExError(card, 'Minutes must be a positive integer.');
        valid = false;
        return;
      }
    }
  });

  if (!valid) return;

  const exercises = state.modalExercises.map(ex => {
    if (ex.type === 'reps') {
      return {
        name:     ex.name.trim(),
        type:     'reps',
        sets:     parseInt(ex.sets),
        reps:     parseInt(ex.reps),
        duration: 0,
      };
    } else {
      return {
        name:     ex.name.trim(),
        type:     'time',
        sets:     1,
        reps:     0,
        minutes:  parseInt(ex.minutes),
        duration: parseInt(ex.minutes) * 60,
      };
    }
  });

  const workouts = getWorkouts();
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

// ==================== EVENT BINDING ====================

function bindAllEvents() {
  document.getElementById('btn-add-workout').addEventListener('click', openModal);

  document.getElementById('btn-modal-close').addEventListener('click', closeModal);
  document.getElementById('btn-modal-cancel').addEventListener('click', closeModal);

  // Click outside modal to close
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Date text input
  const dateTextEl  = document.getElementById('modal-date-text');
  const datePickerEl = document.getElementById('modal-date-picker');
  const dateError   = document.getElementById('date-error');

  dateTextEl.addEventListener('blur', () => {
    const parsed = parseDDMMYYYY(dateTextEl.value);
    if (parsed) {
      state.modalDate = parsed;
      datePickerEl.value = parsed;
      dateTextEl.classList.remove('error');
      dateError.textContent = '';
    } else if (dateTextEl.value.trim()) {
      // Only show error if user actually typed something
      dateTextEl.classList.add('error');
      dateError.textContent = 'Enter a valid date in DD-MM-YYYY format.';
    }
  });

  dateTextEl.addEventListener('input', () => {
    // Clear error while typing
    dateTextEl.classList.remove('error');
    dateError.textContent = '';
  });

  // Calendar icon opens native date picker
  document.getElementById('btn-calendar-icon').addEventListener('click', () => {
    if (datePickerEl.showPicker) {
      datePickerEl.showPicker();
    } else {
      datePickerEl.click();
    }
  });

  // Sync native picker → text input
  datePickerEl.addEventListener('change', () => {
    if (datePickerEl.value) {
      state.modalDate = datePickerEl.value;
      dateTextEl.value = toDisplayDate(datePickerEl.value);
      dateTextEl.classList.remove('error');
      dateError.textContent = '';
    }
  });

  document.getElementById('btn-add-exercise').addEventListener('click', () => {
    state.modalExercises.push({
      id:      generateId(),
      name:    '',
      type:    'reps',
      sets:    '',
      reps:    '',
      minutes: '',
    });
    renderModalExercises();
  });

  document.getElementById('btn-save-workout').addEventListener('click', validateAndSave);
}

// ==================== INIT ====================

function init() {
  document.getElementById('header-date').textContent = formatDateDisplay(TODAY);
  bindAllEvents();
  renderWorkoutHistory();
}

document.addEventListener('DOMContentLoaded', init);
