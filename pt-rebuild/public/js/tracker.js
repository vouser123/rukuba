/**
 * PT Tracker - Patient Exercise Logger
 *
 * Clean, minimal, iOS-safe implementation.
 * Uses pointerup events (not click) for iOS PWA reliability.
 */

import { offlineManager } from './offline.js';

const SUPABASE_URL = 'https://zvgoaxdpkgfxklotqwpz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_pdyqh56HqQQ6OfHl3GG11A_W6IxqqWp';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// App state
let currentUser = null;
let currentExercise = null;
let currentSets = [];
let repCount = 0;

/**
 * Initialize app
 */
async function init() {
  await offlineManager.init();

  // Check auth state
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    await onLogin();
  }

  bindEvents();
  updateSyncStatus();
  setInterval(updateSyncStatus, 5000); // Update queue count every 5s
}

/**
 * Bind iOS-safe event handlers (pointerup, not click)
 */
function bindEvents() {
  document.addEventListener('pointerup', async (e) => {
    const action = e.target.dataset.action;
    if (!action) return;

    // Prevent multi-tap (iOS issue)
    if (e.target.disabled) return;

    switch (action) {
      case 'show-login':
        showLoginForm();
        break;
      case 'login':
        await handleLogin();
        break;
      case 'logout':
        await handleLogout();
        break;
      case 'sync':
        await handleSync();
        break;
      case 'select-exercise':
        selectExercise(e.target.dataset.exerciseId);
        break;
      case 'increment':
        repCount++;
        updateCounter();
        break;
      case 'decrement':
        if (repCount > 0) {
          repCount--;
          updateCounter();
        }
        break;
      case 'finish-set':
        finishSet();
        break;
      case 'finish-exercise':
        await finishExercise();
        break;
      case 'cancel':
        cancelExercise();
        break;
      case 'show-picker':
        showPicker();
        break;
      case 'show-history':
        await showHistory();
        break;
      case 'close-history':
        hideHistory();
        break;
      case 'toggle-menu':
        toggleMenu();
        break;
      case 'reload-app':
        window.location.reload();
        break;
      case 'close-menu':
        closeMenu();
        break;
    }
  });

  // Search filter
  const searchInput = document.getElementById('exercise-search');
  searchInput?.addEventListener('input', filterExercises);
}

/**
 * Show login form (mounts inputs to prevent iOS autofill)
 */
function showLoginForm() {
  document.getElementById('show-login-btn').style.display = 'none';
  document.getElementById('login-form').style.display = 'block';
  document.getElementById('email').focus(); // iOS keyboard activation
}

/**
 * Handle login
 */
async function handleLogin() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('login-error');

  if (!email || !password) {
    errorEl.textContent = 'Email and password required';
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    errorEl.textContent = error.message;
    return;
  }

  currentUser = data.user;
  await onLogin();
}

/**
 * After successful login
 */
async function onLogin() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('tracker-screen').style.display = 'block';

  // Hydrate cache from server
  await offlineManager.hydrateCache(
    (await supabase.auth.getSession()).data.session.access_token,
    currentUser.id
  );

  await loadExercises();
  showPicker();
}

/**
 * Handle logout
 */
async function handleLogout() {
  await supabase.auth.signOut();
  currentUser = null;
  document.getElementById('tracker-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'block';
  document.getElementById('login-form').style.display = 'none';
  document.getElementById('show-login-btn').style.display = 'block';
}

/**
 * Handle manual sync
 */
async function handleSync() {
  const btn = document.getElementById('sync-btn');
  btn.disabled = true;
  btn.textContent = 'Syncing...';

  const token = (await supabase.auth.getSession()).data.session.access_token;

  const result = await offlineManager.manualSync(token, currentUser.id, (status) => {
    btn.textContent = status;
  });

  if (result.success) {
    btn.textContent = `✓ Synced (${result.processed} items)`;
    setTimeout(() => {
      updateSyncStatus();
      btn.disabled = false;
    }, 2000);
  } else {
    btn.textContent = `✗ Failed: ${result.error}`;
    btn.disabled = false;
  }
}

/**
 * Update sync status bar
 */
async function updateSyncStatus() {
  const onlineEl = document.getElementById('online-status');
  const queueEl = document.getElementById('queue-count');

  onlineEl.textContent = navigator.onLine ? '●' : '○';
  onlineEl.style.color = navigator.onLine ? '#4CAF50' : '#999';

  const count = await offlineManager.getQueueCount();
  queueEl.textContent = `${count} pending`;
}

/**
 * Load exercises from cache
 */
async function loadExercises() {
  const exercises = await offlineManager.getCachedExercises();
  const programs = await offlineManager.getCachedPrograms(currentUser.id);

  console.log('loadExercises called:', {
    exercisesCount: exercises?.length,
    programsCount: programs?.length,
    programsType: typeof programs,
    programsIsArray: Array.isArray(programs),
    firstProgram: programs?.[0]
  });

  const list = document.getElementById('exercise-list');
  list.innerHTML = '';

  // Check if programs is valid array before iterating
  if (!Array.isArray(programs) || programs.length === 0) {
    console.error('Programs invalid or empty:', programs);
    list.innerHTML = '<li style="padding: 20px; text-align: center; color: #666;">No exercises assigned. Contact your therapist.</li>';
    return;
  }

  // Show only assigned exercises (with dosage)
  programs.forEach(program => {
    // Use nested exercise data if available, otherwise lookup from exercises array
    const exercise = program.exercises || exercises.find(ex => ex.id === program.exercise_id);
    if (!exercise) return;

    const li = document.createElement('li');
    li.dataset.action = 'select-exercise';
    li.dataset.exerciseId = exercise.id;
    li.dataset.exerciseName = exercise.canonical_name;
    li.dataset.dosageType = program.dosage_type;
    li.dataset.sets = program.sets;
    li.dataset.reps = program.reps_per_set || '';
    li.dataset.seconds = program.seconds_per_set || '';

    let dosageText = `${program.sets} sets`;
    if (program.reps_per_set) dosageText += ` × ${program.reps_per_set} reps`;
    if (program.seconds_per_set) dosageText += ` × ${program.seconds_per_set}s`;

    li.innerHTML = `
      <strong>${exercise.canonical_name}</strong>
      <span>${dosageText}</span>
    `;
    list.appendChild(li);
  });
}

/**
 * Filter exercises by search
 */
function filterExercises() {
  const query = document.getElementById('exercise-search').value.toLowerCase();
  const items = document.querySelectorAll('#exercise-list li');

  items.forEach(item => {
    const name = item.dataset.exerciseName.toLowerCase();
    item.style.display = name.includes(query) ? 'block' : 'none';
  });
}

/**
 * Select exercise to start logging
 */
function selectExercise(exerciseId) {
  const item = document.querySelector(`[data-exercise-id="${exerciseId}"]`);

  currentExercise = {
    id: exerciseId,
    name: item.dataset.exerciseName,
    dosage_type: item.dataset.dosageType,
    sets: parseInt(item.dataset.sets) || 3,
    reps: parseInt(item.dataset.reps) || 0,
    seconds: parseInt(item.dataset.seconds) || 0
  };

  currentSets = [];
  repCount = 0;

  document.getElementById('exercise-name').textContent = currentExercise.name;

  let dosageText = `${currentExercise.sets} sets`;
  if (currentExercise.reps) dosageText += ` × ${currentExercise.reps} reps`;
  if (currentExercise.seconds) dosageText += ` × ${currentExercise.seconds}s`;
  document.getElementById('exercise-dosage').textContent = dosageText;

  document.getElementById('current-set').textContent = '1';
  document.getElementById('completed-sets-list').innerHTML = '';

  updateCounter();

  document.getElementById('exercise-picker').style.display = 'none';
  document.getElementById('session-logger').style.display = 'block';
}

/**
 * Update rep counter display
 */
function updateCounter() {
  document.getElementById('rep-count').textContent = repCount;
}

/**
 * Finish current set
 */
function finishSet() {
  if (repCount === 0) return;

  currentSets.push({
    set_number: currentSets.length + 1,
    reps: currentExercise.dosage_type === 'reps' || currentExercise.dosage_type === 'hold' ? repCount : null,
    seconds: currentExercise.dosage_type === 'duration' || currentExercise.dosage_type === 'hold' ? currentExercise.seconds : null,
    distance_feet: currentExercise.dosage_type === 'distance' ? repCount : null,
    side: 'both',
    performed_at: new Date().toISOString()
  });

  // Add to completed list
  const list = document.getElementById('completed-sets-list');
  const li = document.createElement('li');
  li.textContent = `Set ${currentSets.length}: ${repCount} ${currentExercise.dosage_type === 'distance' ? 'feet' : 'reps'}`;
  list.appendChild(li);

  // Reset for next set
  repCount = 0;
  updateCounter();
  document.getElementById('current-set').textContent = currentSets.length + 1;
}

/**
 * Finish exercise (save to queue and CLEAR state)
 */
async function finishExercise() {
  if (currentSets.length === 0) {
    alert('Please complete at least one set');
    return;
  }

  // Generate client mutation ID (UUID)
  const clientMutationId = crypto.randomUUID();

  const payload = {
    exercise_id: currentExercise.id,
    exercise_name: currentExercise.name,
    activity_type: currentExercise.dosage_type,
    notes: null,
    performed_at: new Date().toISOString(),
    client_mutation_id: clientMutationId,
    sets: currentSets
  };

  await offlineManager.addToQueue('create_activity_log', payload);

  alert(`Exercise logged! (${currentSets.length} sets)`);

  // CRITICAL: Clear state to prevent accidental double-save
  currentExercise = null;
  currentSets = [];
  repCount = 0;

  updateSyncStatus();
  showPicker();
}

/**
 * Cancel exercise (clear state without saving)
 */
function cancelExercise() {
  if (currentSets.length > 0 && !confirm('Discard completed sets?')) {
    return;
  }

  currentExercise = null;
  currentSets = [];
  repCount = 0;

  showPicker();
}

/**
 * Show exercise picker
 */
function showPicker() {
  document.getElementById('session-logger').style.display = 'none';
  document.getElementById('history-view').style.display = 'none';
  document.getElementById('exercise-picker').style.display = 'block';
}

/**
 * Show session history
 */
async function showHistory() {
  const logs = await offlineManager.getCachedLogs(currentUser.id);

  const list = document.getElementById('history-list');
  list.innerHTML = '';

  logs.slice(0, 20).forEach(log => {
    const li = document.createElement('li');
    const date = new Date(log.performed_at).toLocaleDateString();
    li.innerHTML = `
      <strong>${log.exercise_name}</strong>
      <span>${date} - ${log.sets?.length || 0} sets</span>
    `;
    list.appendChild(li);
  });

  document.getElementById('exercise-picker').style.display = 'none';
  document.getElementById('session-logger').style.display = 'none';
  document.getElementById('history-view').style.display = 'block';
}

/**
 * Hide history
 */
function hideHistory() {
  document.getElementById('history-view').style.display = 'none';
  document.getElementById('exercise-picker').style.display = 'block';
}

/**
 * Toggle hamburger menu
 */
function toggleMenu() {
  const menu = document.getElementById('menu-dropdown');
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

/**
 * Close hamburger menu
 */
function closeMenu() {
  document.getElementById('menu-dropdown').style.display = 'none';
}

// Initialize on load
init();
