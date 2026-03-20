// program.js — exercise editor page (/program route), Phase 3b: roles editing + patient dosage

import { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import AuthForm from '../components/AuthForm';
import NavMenu from '../components/NavMenu';
import ExerciseForm from '../components/ExerciseForm';
import DosageModal from '../components/DosageModal';
import NativeSelect from '../components/NativeSelect';
import ProgramRolesSection from '../components/ProgramRolesSection';
import ProgramVocabEditor from '../components/ProgramVocabEditor';
import Toast from '../components/Toast';
import { useProgramMutationActions } from '../hooks/useProgramMutationActions';
import { useProgramOfflineQueue } from '../hooks/useProgramOfflineQueue';
import { useToast } from '../hooks/useToast';
import { offlineCache } from '../lib/offline-cache';
import { emptyReferenceData } from '../lib/program-optimistic';
import {
  fetchExercises, fetchVocabularies, fetchReferenceData, fetchPrograms,
} from '../lib/pt-editor';
import { fetchUsers, resolvePatientScopedUserContext } from '../lib/users';
import styles from './program.module.css';

/**
 * Filter exercises by name search and archived visibility.
 * Deprecated exercises are always hidden (they are soft-removed, not archived).
 */
function applyFilters(exercises, search, showArchived) {
  return exercises.filter(ex => {
    if (ex.lifecycle?.status === 'deprecated') return false;
    if (!showArchived && ex.archived) return false;
    if (search && !ex.canonical_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
}

/**
 * Format a program record into a compact dosage summary string.
 * Examples: "3 × 10", "3 × 30s", "3 × 20 ft"
 */
function formatDosageSummary(program) {
  if (!program) return null;
  const { sets, reps_per_set, seconds_per_rep, distance_feet } = program;
  if (!sets) return null;
  if (distance_feet) return `${sets} × ${distance_feet} ft`;
  if (seconds_per_rep) return `${sets} × ${seconds_per_rep}s`;
  if (reps_per_set) return `${sets} × ${reps_per_set}`;
  return `${sets} set${sets !== 1 ? 's' : ''}`;
}

export default function ProgramPage() {
  const { session, loading: authLoading, signIn } = useAuth();

  const [exercises, setExercises] = useState([]);
  const [referenceData, setReferenceData] = useState(emptyReferenceData());
  const [vocabularies, setVocabularies] = useState({});
  // programs keyed by exercise_id for O(1) lookup
  const [programs, setPrograms] = useState({});
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [roleSearch, setRoleSearch] = useState('');
  const [dosageSearch, setDosageSearch] = useState('');
  // null = no form shown; 'new' = new exercise form; exercise object = edit form
  const [activeExercise, setActiveExercise] = useState(null);
  const [roleExerciseId, setRoleExerciseId] = useState('');
  const [dosageExerciseId, setDosageExerciseId] = useState('');
  // null = modal closed; { exercise, program } = modal open
  const [dosageTarget, setDosageTarget] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [offlineNotice, setOfflineNotice] = useState(null);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [vocabSaving, setVocabSaving] = useState(false);
  const [programPatientId, setProgramPatientId] = useState(null);
  const [programPatientName, setProgramPatientName] = useState('');
  const {
    showToast,
    toastMessage,
    toastType,
    toastVisible,
  } = useToast();

  const exercisesRef = useRef([]);
  const referenceDataRef = useRef(emptyReferenceData());
  const vocabulariesRef = useRef({});
  const programsRef = useRef({});
  const activeExerciseRef = useRef(null);

  useEffect(() => {
    exercisesRef.current = exercises;
    referenceDataRef.current = referenceData;
    vocabulariesRef.current = vocabularies;
    programsRef.current = programs;
    activeExerciseRef.current = activeExercise;
  }, [exercises, referenceData, vocabularies, programs, activeExercise]);

  useEffect(() => {
    if (!activeExercise || activeExercise === 'new') return;
    const refreshedExercise = exercises.find((exercise) => exercise.id === activeExercise.id);
    if (refreshedExercise && refreshedExercise !== activeExercise) {
      setActiveExercise(refreshedExercise);
    }
  }, [activeExercise, exercises]);

  const persistProgramSnapshot = useCallback(async (snapshot) => {
    await offlineCache.init();
    await Promise.all([
      offlineCache.cacheExercises(snapshot.exercises),
      offlineCache.cacheProgramVocabularies(snapshot.vocabularies),
      offlineCache.cacheProgramReferenceData(snapshot.referenceData),
      offlineCache.cachePrograms(Object.values(snapshot.programs ?? {})),
    ]);
  }, []);

  const commitProgramSnapshot = useCallback((snapshot) => {
    exercisesRef.current = snapshot.exercises;
    referenceDataRef.current = snapshot.referenceData;
    vocabulariesRef.current = snapshot.vocabularies;
    programsRef.current = snapshot.programs;
    activeExerciseRef.current = snapshot.activeExercise;

    setExercises(snapshot.exercises);
    setReferenceData(snapshot.referenceData);
    setVocabularies(snapshot.vocabularies);
    setPrograms(snapshot.programs);
    setActiveExercise(snapshot.activeExercise);

    persistProgramSnapshot(snapshot).catch(() => {});
  }, [persistProgramSnapshot]);

  function applyBootstrap({
    exercises: exList,
    vocabularies: vocab,
    referenceData: refData,
    programs: progMap,
    programPatientId: nextProgramPatientId,
    programPatientName: nextProgramPatientName,
  }, notice = null) {
    setExercises(exList);
    setVocabularies(vocab);
    setReferenceData(refData);
    setPrograms(progMap);
    setProgramPatientId(nextProgramPatientId);
    setProgramPatientName(nextProgramPatientName);
    setLoadError(null);
    setOfflineNotice(notice);
  }

  /** Load all exercises, vocabularies, reference data, and patient programs. */
  const loadData = useCallback(async (accessToken, authUserId) => {
    try {
      await offlineCache.init();
      const usersData = await fetchUsers(accessToken);
      await offlineCache.cacheUsers(usersData);

      const { patientUser, patientDisplayName } = resolvePatientScopedUserContext(usersData, authUserId);
      const [exList, vocab, refData, progMap] = await Promise.all([
        fetchExercises(accessToken),
        fetchVocabularies(accessToken),
        fetchReferenceData(accessToken),
        fetchPrograms(accessToken, patientUser.id),
      ]);

      await Promise.all([
        offlineCache.cacheExercises(exList),
        offlineCache.cacheProgramVocabularies(vocab),
        offlineCache.cacheProgramReferenceData(refData),
        offlineCache.cachePrograms(Object.values(progMap ?? {})),
      ]);

      const nextData = {
        exercises: exList,
        vocabularies: vocab,
        referenceData: refData,
        programs: progMap,
        programPatientId: patientUser.id,
        programPatientName: patientDisplayName,
      };
      applyBootstrap(nextData, null);
      return nextData;
    } catch (err) {
      try {
        await offlineCache.init();
        const [cachedUsers, cachedExercises, cachedVocabularies, cachedReferenceData, cachedPrograms] = await Promise.all([
          offlineCache.getCachedUsers(),
          offlineCache.getCachedExercises(),
          offlineCache.getCachedProgramVocabularies(),
          offlineCache.getCachedProgramReferenceData(),
          offlineCache.getCachedPrograms(),
        ]);
        const { patientUser, patientDisplayName } = resolvePatientScopedUserContext(cachedUsers, authUserId);

        const cachedProgramMap = Object.fromEntries((cachedPrograms ?? []).map((program) => [program.exercise_id, program]));
        const hasCachedBootstrap =
          (cachedExercises?.length ?? 0) > 0 ||
          Object.keys(cachedVocabularies ?? {}).length > 0 ||
          (cachedReferenceData?.equipment?.length ?? 0) > 0 ||
          (cachedReferenceData?.muscles?.length ?? 0) > 0 ||
          (cachedReferenceData?.formParameters?.length ?? 0) > 0 ||
          Object.keys(cachedProgramMap).length > 0;

        if (!hasCachedBootstrap) {
          throw err;
        }

        const nextData = {
          exercises: cachedExercises ?? [],
          vocabularies: cachedVocabularies ?? {},
          referenceData: cachedReferenceData ?? { equipment: [], muscles: [], formParameters: [] },
          programs: cachedProgramMap,
          programPatientId: patientUser.id,
          programPatientName: patientDisplayName,
        };
        applyBootstrap(nextData, 'Offline - showing cached editor data.');
        return nextData;
      } catch {
        setProgramPatientId(null);
        setProgramPatientName('');
        setOfflineNotice(null);
        setLoadError(err.message);
        return null;
      }
    }
  }, []);

  useEffect(() => {
    if (session) loadData(session.access_token, session.user.id);
  }, [session, loadData]);

  const {
    mutationQueue,
    queueError,
    queueLoaded,
    queueSyncing,
    enqueueMutation,
    persistQueue,
    syncProgramMutations,
  } = useProgramOfflineQueue({
    session,
    programPatientId,
    loadData,
    showToast,
    commitSnapshot: commitProgramSnapshot,
  });

  function getCurrentSnapshot() {
    return {
      exercises: exercisesRef.current,
      referenceData: referenceDataRef.current,
      vocabularies: vocabulariesRef.current,
      programs: programsRef.current,
      activeExercise: activeExerciseRef.current,
    };
  }

  function handleCancel() {
    setActiveExercise(null);
  }

  function handleSelectExercise(exerciseId) {
    const ex = exercises.find(x => x.id === exerciseId);
    setActiveExercise(ex ?? null);
  }


  const filtered = session ? applyFilters(exercises, search, showArchived) : [];
  const roleExerciseOptions = session
    ? exercises.filter((ex) => {
      if (ex.lifecycle?.status === 'deprecated') return false;
      if (roleSearch && !ex.canonical_name.toLowerCase().includes(roleSearch.toLowerCase())) return false;
      return true;
    })
    : [];
  const dosageExerciseOptions = session
    ? exercises.filter((ex) => {
      if (ex.lifecycle?.status === 'deprecated') return false;
      if (dosageSearch && !ex.canonical_name.toLowerCase().includes(dosageSearch.toLowerCase())) return false;
      return true;
    })
    : [];
  // Pass null to ExerciseForm for new exercise; pass exercise object for edit
  const formExercise = activeExercise === 'new' ? null : activeExercise;
  const roleExercise = exercises.find((exercise) => exercise.id === roleExerciseId) ?? null;
  const dosageExercise = exercises.find((exercise) => exercise.id === dosageExerciseId) ?? null;
  const selectedProgram = dosageExercise ? (programs[dosageExercise.id] ?? null) : null;
  const dosageSummary = formatDosageSummary(selectedProgram);

  const {
    handleSaved,
    handleDosageSave,
    handleAddRole: handleAddRoleMutation,
    handleDeleteRole: handleDeleteRoleMutation,
    handleAddVocabTerm: handleAddVocabTermMutation,
    handleUpdateVocabTerm: handleUpdateVocabTermMutation,
    handleDeleteVocabTerm: handleDeleteVocabTermMutation,
  } = useProgramMutationActions({
    session,
    selectedExercise: roleExercise,
    programPatientId,
    dosageTarget,
    mutationQueue,
    enqueueMutation,
    persistQueue,
    commitSnapshot: commitProgramSnapshot,
    showToast,
    getSnapshot: getCurrentSnapshot,
    setDosageTarget,
  });

  async function handleExerciseSaved(wasNew, savedExerciseId, payload) {
    const result = await handleSaved(wasNew, savedExerciseId, payload);
    if (result?.exerciseId) {
      setRoleExerciseId(result.exerciseId);
      setDosageExerciseId(result.exerciseId);
    }
    return result;
  }

  async function handleAddRole(roleData) {
    setRolesLoading(true);
    try {
      await handleAddRoleMutation(roleData);
    } finally {
      setRolesLoading(false);
    }
  }

  async function handleDeleteRole(roleId) {
    setRolesLoading(true);
    try {
      await handleDeleteRoleMutation(roleId);
    } finally {
      setRolesLoading(false);
    }
  }

  async function handleAddVocabTerm(payload) {
    setVocabSaving(true);
    try {
      await handleAddVocabTermMutation(payload);
    } finally {
      setVocabSaving(false);
    }
  }

  async function handleUpdateVocabTerm(payload) {
    setVocabSaving(true);
    try {
      await handleUpdateVocabTermMutation(payload);
    } finally {
      setVocabSaving(false);
    }
  }

  async function handleDeleteVocabTerm(payload) {
    setVocabSaving(true);
    try {
      await handleDeleteVocabTermMutation(payload);
    } finally {
      setVocabSaving(false);
    }
  }

  if (!session && !authLoading) {
    return (
      <>
        <Head>
          <title>PT Editor - Exercise Library Manager</title>
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
          <link rel="manifest" href="/manifest.json" />
        </Head>
        <AuthForm onSignIn={signIn} />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>PT Editor - Exercise Library Manager</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="manifest" href="/manifest.json" />
      </Head>

      {session && (
        <NavMenu
          user={session.user}
          isAdmin={true}
          onSignOut={() => supabase.auth.signOut()}
          currentPage="pt_editor"
          actions={[]}
          onAction={() => {}}
        />
      )}

      <main className={styles.main}>
        {loadError && <p className={styles.errorBanner}>{loadError}</p>}
        {offlineNotice && <p className={styles.offlineNotice}>{offlineNotice}</p>}
        {queueLoaded && mutationQueue.length > 0 && (
          <div className={queueError ? styles.queueBannerError : styles.queueBanner}>
            <p className={styles.queueBannerText}>
              {queueError
                ? `${mutationQueue.length} program change${mutationQueue.length === 1 ? '' : 's'} waiting to sync. ${queueError}`
                : queueSyncing
                  ? `Syncing ${mutationQueue.length} pending program change${mutationQueue.length === 1 ? '' : 's'}…`
                  : `${mutationQueue.length} program change${mutationQueue.length === 1 ? '' : 's'} queued for sync.`}
            </p>
            {!queueSyncing && (
              <button type="button" className={styles.queueRetryButton} onPointerUp={() => syncProgramMutations()}>
                Retry sync
              </button>
            )}
          </div>
        )}
        <Toast message={toastMessage} type={toastType} visible={toastVisible} />

        <div className={styles.header}>
          <h1 className={styles.title}>PT Editor</h1>
          <button
            className={styles.btnPrimary}
            onPointerUp={() => setActiveExercise('new')}
          >
            ➕ New
          </button>
        </div>

        <div className={styles.selectorPanel}>
          <h2 className={styles.sectionTitle}>Select Exercise to Edit</h2>
          <input
            className={styles.searchInput}
            type="search"
            placeholder="Search exercises…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <label className={styles.archiveToggle}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={e => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
          <NativeSelect
            className={styles.exerciseSelect}
            value={activeExercise?.id ?? ''}
            onChange={handleSelectExercise}
            placeholder="-- Add New Exercise (leave blank) --"
            options={filtered.map((ex) => ({
              value: ex.id,
              label: `${ex.archived ? '[archived] ' : ''}${ex.canonical_name}`,
            }))}
          />
        </div>

        {activeExercise !== null && (
          <ExerciseForm
            exercise={formExercise}
            exercises={exercises}
            referenceData={referenceData}
            vocabularies={vocabularies}
            accessToken={session?.access_token}
            onSubmitExercise={handleExerciseSaved}
            onCancel={handleCancel}
          />
        )}

        <section className={styles.workspaceSection}>
          <h2 className={styles.sectionTitle}>Assign Roles to Exercises</h2>
          <p className={styles.sectionDescription}>
            <strong>Roles</strong> define how an exercise contributes to different movement capacities in different body regions.
          </p>
          <div className={styles.selectorStack}>
            <input
              className={styles.searchInput}
              type="search"
              placeholder="Search exercises…"
              value={roleSearch}
              onChange={(event) => setRoleSearch(event.target.value)}
            />
            <NativeSelect
              className={styles.exerciseSelect}
              value={roleExerciseId}
              onChange={setRoleExerciseId}
              placeholder="-- Choose an exercise --"
              options={roleExerciseOptions.map((ex) => ({
                value: ex.id,
                label: `${ex.archived ? '[archived] ' : ''}${ex.canonical_name}`,
              }))}
            />
          </div>
          <ProgramRolesSection
            exercise={roleExercise}
            roles={roleExercise?.roles ?? []}
            rolesLoading={rolesLoading}
            vocabularies={vocabularies}
            onAddRole={handleAddRole}
            onDeleteRole={handleDeleteRole}
          />
        </section>

        <section className={styles.workspaceSection}>
          <h2 className={styles.sectionTitle}>Manage Patient Dosages</h2>
          <p className={styles.sectionDescription}>
            <strong>Dosages</strong> are the prescribed sets, reps, and parameters for each exercise.
          </p>
          {programPatientName && (
            <p className={styles.patientContextBanner}>
              Patient context for dosage: <strong>{programPatientName}</strong>
            </p>
          )}
          <div className={styles.selectorStack}>
            <input
              className={styles.searchInput}
              type="search"
              placeholder="Search exercises…"
              value={dosageSearch}
              onChange={(event) => setDosageSearch(event.target.value)}
            />
            <NativeSelect
              className={styles.exerciseSelect}
              value={dosageExerciseId}
              onChange={setDosageExerciseId}
              placeholder="-- Choose an exercise --"
              options={dosageExerciseOptions.map((ex) => ({
                value: ex.id,
                label: `${ex.archived ? '[archived] ' : ''}${ex.canonical_name}`,
              }))}
            />
          </div>
          {dosageExercise ? (
            <div className={styles.dosageCard}>
              <p className={styles.dosageName}>{dosageExercise.canonical_name}</p>
              <p className={styles.dosageSummary}>
                {dosageSummary ? `Current dosage: ${dosageSummary}` : 'No dosage assigned yet.'}
              </p>
              <button
                className={styles.btnDosage}
                onPointerUp={() => setDosageTarget({ exercise: dosageExercise, program: selectedProgram })}
              >
                {dosageSummary ? 'Edit dosage' : 'Set dosage'}
              </button>
            </div>
          ) : (
            <p className={styles.emptyState}>Select an exercise to manage dosage.</p>
          )}
        </section>

        <section className={styles.workspaceSection}>
          <details className={styles.vocabDetails}>
            <summary className={styles.vocabSummary}>Manage Vocabulary</summary>
            <p className={styles.sectionDescription}>
              Controlled vocabularies define the valid codes used by the editor and shared role selectors.
            </p>
            <ProgramVocabEditor
              vocabularies={vocabularies}
              onAddTerm={handleAddVocabTerm}
              onUpdateTerm={handleUpdateVocabTerm}
              onDeleteTerm={handleDeleteVocabTerm}
              saving={vocabSaving}
            />
          </details>
        </section>

        {/* DosageModal — rendered outside ExerciseForm to keep it reusable */}
        {dosageTarget && (
          <DosageModal
            exercise={dosageTarget.exercise}
            program={dosageTarget.program}
            onSave={handleDosageSave}
            onClose={() => setDosageTarget(null)}
          />
        )}
      </main>
    </>
  );
}
