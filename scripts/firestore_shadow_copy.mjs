import fs from 'fs';
import path from 'path';
import process from 'process';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function getDateStamp() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

const credentialPath = getArgValue('--credential') || process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credentialPath) {
  console.error('Missing credentials. Provide --credential /path/to/serviceAccount.json or set GOOGLE_APPLICATION_CREDENTIALS.');
  process.exit(1);
}

const resolvedCredentialPath = path.resolve(credentialPath);
if (!fs.existsSync(resolvedCredentialPath)) {
  console.error(`Credential file not found: ${resolvedCredentialPath}`);
  process.exit(1);
}

const dateStamp = getArgValue('--date') || getDateStamp();
const dryRun = process.argv.includes('--dry-run');

const serviceAccount = JSON.parse(fs.readFileSync(resolvedCredentialPath, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();

const sharedSource = 'pt_shared';
const sharedTarget = `pt_shared_shadow_${dateStamp}`;
const runtimeTarget = `pt_runtime_shadow_${dateStamp}`;

async function copyCollection(sourceCollection, targetCollection) {
  const snapshot = await db.collection(sourceCollection).get();
  if (snapshot.empty) {
    console.log(`[Shadow] No documents in ${sourceCollection}`);
    return;
  }

  const batch = db.batch();
  snapshot.forEach((docSnap) => {
    const targetRef = db.collection(targetCollection).doc(docSnap.id);
    const data = docSnap.data();
    const payload = {
      ...data,
      _shadow_metadata: {
        source: `${sourceCollection}/${docSnap.id}`,
        copiedAt: new Date().toISOString()
      }
    };
    batch.set(targetRef, payload);
  });

  if (dryRun) {
    console.log(`[Shadow][Dry Run] Would copy ${snapshot.size} docs from ${sourceCollection} to ${targetCollection}`);
    return;
  }

  await batch.commit();
  console.log(`[Shadow] Copied ${snapshot.size} docs from ${sourceCollection} to ${targetCollection}`);
}

async function copyUserRuntime(targetCollection) {
  const usersSnap = await db.collection('users').get();
  if (usersSnap.empty) {
    console.log('[Shadow] No users found');
    return;
  }

  let copied = 0;
  for (const userDoc of usersSnap.docs) {
    const runtimeRef = db.doc(`users/${userDoc.id}/pt_runtime/state`);
    const runtimeSnap = await runtimeRef.get();
    if (!runtimeSnap.exists) {
      continue;
    }

    const targetRef = db.collection(targetCollection).doc(userDoc.id);
    const data = runtimeSnap.data();
    const payload = {
      ...data,
      _shadow_metadata: {
        source: `users/${userDoc.id}/pt_runtime/state`,
        copiedAt: new Date().toISOString()
      }
    };

    if (dryRun) {
      copied += 1;
      continue;
    }

    await targetRef.set(payload);
    copied += 1;
  }

  if (dryRun) {
    console.log(`[Shadow][Dry Run] Would copy ${copied} pt_runtime docs to ${targetCollection}`);
    return;
  }

  console.log(`[Shadow] Copied ${copied} pt_runtime docs to ${targetCollection}`);
}

async function run() {
  console.log(`[Shadow] Starting copy for ${dateStamp} (dry run: ${dryRun})`);
  await copyCollection(sharedSource, sharedTarget);
  await copyUserRuntime(runtimeTarget);
  console.log('[Shadow] Done.');
}

run().catch((error) => {
  console.error('[Shadow] Failed:', error);
  process.exit(1);
});
