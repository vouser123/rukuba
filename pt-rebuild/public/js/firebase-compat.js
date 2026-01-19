/**
 * Firebase-to-Supabase Compatibility Layer
 *
 * This module provides a Firebase-compatible API that uses Supabase underneath.
 * Allows existing Firebase-based apps to work with Supabase without code changes.
 *
 * Data is ALWAYS stored in Supabase (PostgreSQL cloud database).
 * LocalStorage is ONLY used as a temporary cache - can be wiped without data loss.
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Initialize Supabase client
const SUPABASE_URL = 'https://zvgoaxdpkgfxklotqwpz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_pdyqh56HqQQ6OfHl3GG11A_W6IxqqWp';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Firebase Auth compatibility
 */
export class FirebaseAuth {
  constructor() {
    this.currentUser = null;
    this._authStateCallbacks = [];

    // Check current session on init
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        this.currentUser = {
          uid: session.user.id,
          email: session.user.email
        };
        this._notifyAuthStateChanged(this.currentUser);
      }
    });

    // Listen for auth changes
    supabase.auth.onAuthStateChange((event, session) => {
      this.currentUser = session?.user ? {
        uid: session.user.id,
        email: session.user.email
      } : null;
      this._notifyAuthStateChanged(this.currentUser);
    });
  }

  /**
   * Sign in with email and password
   */
  async signInWithEmailAndPassword(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw new Error(error.message);

    this.currentUser = {
      uid: data.user.id,
      email: data.user.email
    };

    return { user: this.currentUser };
  }

  /**
   * Sign out
   */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);

    this.currentUser = null;
    return;
  }

  /**
   * Register auth state change callback
   */
  onAuthStateChanged(callback) {
    this._authStateCallbacks.push(callback);

    // Immediately call with current state
    callback(this.currentUser);

    // Return unsubscribe function
    return () => {
      const index = this._authStateCallbacks.indexOf(callback);
      if (index > -1) {
        this._authStateCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Notify all auth state callbacks
   */
  _notifyAuthStateChanged(user) {
    this._authStateCallbacks.forEach(callback => callback(user));
  }
}

/**
 * Firebase Firestore compatibility
 */
export class FirebaseFirestore {
  constructor() {
    this.auth = new FirebaseAuth();
  }

  /**
   * Get a document reference
   */
  doc(path) {
    return new DocumentReference(path);
  }

  /**
   * Get a collection reference
   */
  collection(path) {
    return new CollectionReference(path);
  }
}

/**
 * Document Reference (mimics Firebase DocumentReference)
 */
class DocumentReference {
  constructor(path) {
    this.path = path;
    this._parsePathComponents();
  }

  _parsePathComponents() {
    const parts = this.path.split('/');

    // Handle different path patterns
    if (parts.length === 2) {
      // Simple: exerciseLibrary/{id}
      this.table = parts[0];
      this.id = parts[1];
    } else if (parts.length === 4) {
      // Nested: users/{uid}/sessions/{sessionId}
      this.table = parts[2]; // 'sessions'
      this.id = parts[3];     // sessionId
      this.userId = parts[1]; // uid
    } else if (parts.length === 3 && parts[1] === '{uid}') {
      // Template: users/{uid}/current
      this.table = parts[2];
      this.userId = null; // Will be filled at runtime
    }
  }

  /**
   * Set document data (upsert)
   */
  async setDoc(data, options = {}) {
    const userId = this.userId || (await this._getCurrentUserId());

    // Map Firebase collection names to Supabase tables
    const tableMap = {
      'exerciseLibrary': 'exercises',
      'sessions': 'patient_activity_logs',
      'current': 'patient_programs'
    };

    const table = tableMap[this.table] || this.table;

    // Transform data to match Supabase schema
    const transformedData = await this._transformToSupabase(table, data, userId);

    const { error } = await supabase
      .from(table)
      .upsert(transformedData, {
        onConflict: options.merge ? undefined : 'id'
      });

    if (error) throw new Error(error.message);
  }

  /**
   * Get document data
   */
  async getDoc() {
    const userId = this.userId || (await this._getCurrentUserId());

    const tableMap = {
      'exerciseLibrary': 'exercises',
      'sessions': 'patient_activity_logs',
      'current': 'patient_programs'
    };

    const table = tableMap[this.table] || this.table;

    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('id', this.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      throw new Error(error.message);
    }

    return {
      exists: () => !!data,
      data: () => data ? this._transformFromSupabase(table, data) : null,
      id: this.id
    };
  }

  /**
   * Delete document
   */
  async deleteDoc() {
    const tableMap = {
      'exerciseLibrary': 'exercises',
      'sessions': 'patient_activity_logs',
      'current': 'patient_programs'
    };

    const table = tableMap[this.table] || this.table;

    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', this.id);

    if (error) throw new Error(error.message);
  }

  /**
   * Get current user ID from Supabase auth
   */
  async _getCurrentUserId() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Not authenticated');

    // Get internal user ID from auth_id
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', session.user.id)
      .single();

    return data?.id;
  }

  /**
   * Transform Firebase data structure to Supabase schema
   */
  async _transformToSupabase(table, data, userId) {
    if (table === 'exercises') {
      return {
        id: data.id || this.id,
        canonical_name: data.name || data.canonical_name,
        description: data.description || '',
        pt_category: data.category || data.pt_category || 'other',
        pattern: data.pattern || 'both',
        archived: data.archived || false
      };
    }

    if (table === 'patient_activity_logs') {
      return {
        id: data.sessionId || this.id,
        patient_id: userId,
        exercise_id: data.exerciseId,
        exercise_name: data.exerciseName,
        client_mutation_id: data.sessionId || this.id,
        activity_type: data.type || 'reps',
        notes: data.notes || null,
        performed_at: data.timestamp || new Date().toISOString()
      };
    }

    if (table === 'patient_programs') {
      return {
        patient_id: userId,
        exercise_id: this.id,
        dosage_type: data.type || 'reps',
        sets: data.sets,
        reps_per_set: data.reps,
        seconds_per_rep: data.hold,
        seconds_per_set: data.duration,
        distance_feet: data.distance
      };
    }

    return data;
  }

  /**
   * Transform Supabase data to Firebase structure
   */
  _transformFromSupabase(table, data) {
    if (table === 'exercises') {
      return {
        id: data.id,
        name: data.canonical_name,
        description: data.description,
        category: data.pt_category,
        pattern: data.pattern,
        archived: data.archived
      };
    }

    if (table === 'patient_programs') {
      return {
        type: data.dosage_type,
        sets: data.sets,
        reps: data.reps_per_set,
        hold: data.seconds_per_rep,
        duration: data.seconds_per_set,
        distance: data.distance_feet
      };
    }

    return data;
  }
}

/**
 * Collection Reference (mimics Firebase CollectionReference)
 */
class CollectionReference {
  constructor(path) {
    this.path = path;
    this._parsePathComponents();
  }

  _parsePathComponents() {
    const parts = this.path.split('/');

    if (parts.length === 1) {
      this.table = parts[0];
    } else if (parts.length === 3) {
      this.table = parts[2];
      this.userId = parts[1];
    }
  }

  /**
   * Get all documents in collection
   */
  async getDocs() {
    const tableMap = {
      'exerciseLibrary': 'exercises',
      'sessions': 'patient_activity_logs',
      'current': 'patient_programs'
    };

    const table = tableMap[this.table] || this.table;

    let query = supabase.from(table).select('*');

    // Filter by user if this is a user subcollection
    if (this.userId) {
      const userId = await this._getCurrentUserId();
      query = query.eq('patient_id', userId);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    return {
      docs: (data || []).map(doc => ({
        id: doc.id,
        data: () => new DocumentReference(this.path + '/' + doc.id)._transformFromSupabase(table, doc),
        exists: true
      })),
      empty: !data || data.length === 0,
      size: data?.length || 0
    };
  }

  /**
   * Add document to collection
   */
  async addDoc(data) {
    const tableMap = {
      'exerciseLibrary': 'exercises',
      'sessions': 'patient_activity_logs',
      'current': 'patient_programs'
    };

    const table = tableMap[this.table] || this.table;
    const userId = this.userId ? await this._getCurrentUserId() : null;

    const transformedData = await new DocumentReference(this.path + '/temp')._transformToSupabase(table, data, userId);

    const { data: inserted, error } = await supabase
      .from(table)
      .insert(transformedData)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return {
      id: inserted.id
    };
  }

  async _getCurrentUserId() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Not authenticated');

    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', session.user.id)
      .single();

    return data?.id;
  }
}

/**
 * Initialize Firebase-compatible app
 */
export function initializeApp(config) {
  return {
    name: '[DEFAULT]',
    options: config
  };
}

/**
 * Get Firestore instance
 */
export function getFirestore(app) {
  return new FirebaseFirestore();
}

/**
 * Get Auth instance
 */
export function getAuth(app) {
  return new FirebaseAuth();
}

/**
 * Export Firestore functions
 */
export const doc = (db, path) => db.doc(path);
export const collection = (db, path) => db.collection(path);
export const setDoc = (docRef, data, options) => docRef.setDoc(data, options);
export const getDoc = (docRef) => docRef.getDoc();
export const getDocs = (collectionRef) => collectionRef.getDocs();
export const deleteDoc = (docRef) => docRef.deleteDoc();
export const addDoc = (collectionRef, data) => collectionRef.addDoc(data);

/**
 * Export Auth functions
 */
export const signInWithEmailAndPassword = (auth, email, password) => auth.signInWithEmailAndPassword(email, password);
export const signOut = (auth) => auth.signOut();
export const onAuthStateChanged = (auth, callback) => auth.onAuthStateChanged(callback);
