import fs from 'fs';
import path from 'path';
import { cert, getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { env } from '../config/env';

type FirebaseServiceAccount = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

const parseServiceAccount = () => {
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON) as FirebaseServiceAccount;
  }

  if (env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const keyPath = path.isAbsolute(env.FIREBASE_SERVICE_ACCOUNT_PATH)
      ? env.FIREBASE_SERVICE_ACCOUNT_PATH
      : path.resolve(process.cwd(), env.FIREBASE_SERVICE_ACCOUNT_PATH);
    return JSON.parse(fs.readFileSync(keyPath, 'utf8')) as FirebaseServiceAccount;
  }

  return null;
};

export const getFirebaseMessaging = () => {
  if (!getApps().length) {
    const serviceAccount = parseServiceAccount();
    initializeApp(
      serviceAccount
        ? {
            credential: cert({
              projectId: serviceAccount.project_id ?? env.FIREBASE_PROJECT_ID,
              clientEmail: serviceAccount.client_email,
              privateKey: serviceAccount.private_key?.replace(/\\n/g, '\n'),
            }),
            projectId: serviceAccount.project_id ?? env.FIREBASE_PROJECT_ID,
          }
        : {
            credential: applicationDefault(),
            projectId: env.FIREBASE_PROJECT_ID,
          },
    );
  }

  return getMessaging();
};

export const isFirebasePushConfigured = () =>
  Boolean(env.FIREBASE_PROJECT_ID && (env.FIREBASE_SERVICE_ACCOUNT_JSON || env.FIREBASE_SERVICE_ACCOUNT_PATH));
