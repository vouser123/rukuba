// program.js — exercise editor page (/program route), Phase 3b: roles editing + patient dosage
import { useCallback } from 'react';
import Head from 'next/head';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { useProgramPageData } from '../hooks/useProgramPageData';
import { useProgramDataSnapshot } from '../hooks/useProgramDataSnapshot';
import { useProgramWorkspaceState } from '../hooks/useProgramWorkspaceState';
import { useProgramMutationUi } from '../hooks/useProgramMutationUi';
import { useProgramMutationActions } from '../hooks/useProgramMutationActions';
import { useProgramOfflineQueue } from '../hooks/useProgramOfflineQueue';
import { useProgramVocabActions } from '../hooks/useProgramVocabActions';
import { useToast } from '../hooks/useToast';
import AuthForm from '../components/AuthForm';
import NavMenu from '../components/NavMenu';
import ProgramExerciseSelector from '../components/ProgramExerciseSelector';
import ExerciseForm from '../components/ExerciseForm';
import DosageModal from '../components/DosageModal';
import ExerciseRolesWorkspace from '../components/ExerciseRolesWorkspace';
import ProgramDosageWorkspace from '../components/ProgramDosageWorkspace';
import ProgramVocabEditor from '../components/ProgramVocabEditor';
import Toast from '../components/Toast';
import { getProgramMutationLabel } from '../lib/program-offline';
import styles from './program.module.css';

export default function ProgramPage() {
  const { session, loading: authLoading, signIn, signOut } = useAuth();
  const {
    exercises,
    referenceData,
    vocabularies,
    programs,
    loadError,
    offlineNotice,
    currentUserRole,
    accessError,
    programPatientId,
    programPatientName,
    loadData,
    setProgramDataSnapshot,
  } = useProgramPageData({ session });
  const { commitProgramData } = useProgramDataSnapshot({ setProgramDataSnapshot });
  const workspace = useProgramWorkspaceState({
    exercises,
    programs,
    enabled: Boolean(session),
  });
  const {
    search,
    showArchived,
    roleSearch,
    dosageSearch,
    activeExercise,
    roleExerciseId,
    dosageExerciseId,
    dosageTarget,
    filtered,
    roleExerciseOptions,
    dosageExerciseOptions,
    formExercise,
    roleExercise,
    dosageExercise,
    selectedProgram,
    setSearch,
    setShowArchived,
    setRoleSearch,
    setDosageSearch,
    setActiveExercise,
    setRoleExerciseId,
    setDosageExerciseId,
    setDosageTarget,
    handleCancel,
    handleSelectExercise,
  } = workspace;
  const {
    showToast,
    toastMessage,
    toastType,
    toastVisible,
  } = useToast();

  const getCurrentSnapshot = useCallback(() => ({
    exercises,
    referenceData,
    vocabularies,
    programs,
    activeExercise,
  }), [activeExercise, exercises, programs, referenceData, vocabularies]);

  const commitSnapshot = useCallback((snapshot) => {
    commitProgramData(snapshot);
    setActiveExercise(snapshot.activeExercise);
  }, [commitProgramData, setActiveExercise]);

  const {
    mutationQueue,
    queueSummary,
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
    commitSnapshot,
  });

  const {
    handleSaved,
    handleDosageSave,
    handleAddRole: handleAddRoleMutation,
    handleDeleteRole: handleDeleteRoleMutation,
  } = useProgramMutationActions({
    session,
    selectedExercise: roleExercise,
    programPatientId,
    dosageTarget,
    mutationQueue,
    enqueueMutation,
    persistQueue,
    commitSnapshot,
    showToast,
    getSnapshot: getCurrentSnapshot,
    setDosageTarget,
  });
  const {
    handleAddVocabTerm: handleAddVocabTermMutation,
    handleUpdateVocabTerm: handleUpdateVocabTermMutation,
    handleDeleteVocabTerm: handleDeleteVocabTermMutation,
  } = useProgramVocabActions({
    session,
    enqueueMutation,
    getSnapshot: getCurrentSnapshot,
  });
  const {
    rolesLoading,
    vocabSaving,
    handleExerciseSaved,
    handleAddRole,
    handleDeleteRole,
    handleAddVocabTerm,
    handleUpdateVocabTerm,
    handleDeleteVocabTerm,
  } = useProgramMutationUi({
    handleSaved,
    handleAddRoleMutation,
    handleDeleteRoleMutation,
    handleAddVocabTermMutation,
    handleUpdateVocabTermMutation,
    handleDeleteVocabTermMutation,
    setRoleExerciseId,
    setDosageExerciseId,
  });

  if (!session && !authLoading) {
    return (
      <>
        <Head>
          <title>PT Editor - Exercise Library Manager</title>
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
          <link rel="manifest" href="/manifest-tracker.json" />
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
        <link rel="manifest" href="/manifest-tracker.json" />
      </Head>

      {session && (
        <NavMenu
          user={session.user}
          isAdmin={currentUserRole === 'therapist' || currentUserRole === 'admin'}
          onSignOut={() => signOut?.() ?? supabase.auth.signOut()}
          currentPage="pt_editor"
          actions={[]}
          onAction={() => {}}
        />
      )}

      <main className={styles.main}>
        {accessError ? <p className={styles.errorBanner}>{accessError}</p> : null}
        {loadError ? <p className={styles.errorBanner}>{loadError}</p> : null}
        {offlineNotice ? <p className={styles.offlineNotice}>{offlineNotice}</p> : null}
        {accessError ? null : (
          <>
            {queueLoaded && mutationQueue.length > 0 && (
              <div className={queueError ? styles.queueBannerError : styles.queueBanner}>
                <p className={styles.queueBannerText}>
                  {queueError
                    ? `${queueSummary.failedCount} failed ${getProgramMutationLabel(queueSummary.firstFailed)} change${queueSummary.failedCount === 1 ? '' : 's'} need attention.${queueSummary.pendingCount > 0 ? ` ${queueSummary.pendingCount} more change${queueSummary.pendingCount === 1 ? '' : 's'} are still queued.` : ''} ${queueError}`
                    : queueSyncing
                      ? `Syncing ${queueSummary.pendingCount} pending program change${queueSummary.pendingCount === 1 ? '' : 's'}…`
                      : `${queueSummary.pendingCount} program change${queueSummary.pendingCount === 1 ? '' : 's'} queued for sync.`}
                </p>
                {queueError && (
                  <p className={styles.queueRecoveryHint}>
                    Open the affected item and save again to replace the failed queued change, or retry sync after the blocking issue is fixed.
                  </p>
                )}
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
              <button className={styles.btnPrimary} onPointerUp={() => setActiveExercise('new')}>
                ➕ New
              </button>
            </div>

            <ProgramExerciseSelector
              search={search}
              onSearchChange={setSearch}
              showArchived={showArchived}
              onShowArchivedChange={setShowArchived}
              activeExerciseId={activeExercise?.id ?? ''}
              onExerciseChange={handleSelectExercise}
              exerciseOptions={filtered}
            />

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

            <ExerciseRolesWorkspace
              roleSearch={roleSearch}
              onRoleSearchChange={setRoleSearch}
              roleExerciseId={roleExerciseId}
              onRoleExerciseChange={setRoleExerciseId}
              roleExerciseOptions={roleExerciseOptions}
              roleExercise={roleExercise}
              rolesLoading={rolesLoading}
              vocabularies={vocabularies}
              onAddRole={handleAddRole}
              onDeleteRole={handleDeleteRole}
            />

            <ProgramDosageWorkspace
              programPatientName={programPatientName}
              dosageSearch={dosageSearch}
              onDosageSearchChange={setDosageSearch}
              dosageExerciseId={dosageExerciseId}
              onDosageExerciseChange={setDosageExerciseId}
              dosageExerciseOptions={dosageExerciseOptions}
              dosageExercise={dosageExercise}
              selectedProgram={selectedProgram}
              onEditDosage={() => setDosageTarget({ exercise: dosageExercise, program: selectedProgram })}
            />

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

            {dosageTarget && (
              <DosageModal
                exercise={dosageTarget.exercise}
                program={dosageTarget.program}
                onSave={handleDosageSave}
                onClose={() => setDosageTarget(null)}
              />
            )}
          </>
        )}
      </main>
    </>
  );
}
