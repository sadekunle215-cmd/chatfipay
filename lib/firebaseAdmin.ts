import * as admin from 'firebase-admin';

function getApp() {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : null;
  return admin.initializeApp(
    serviceAccount ? { credential: admin.credential.cert(serviceAccount) } : undefined
  );
}

const app = getApp();

export const db = admin.firestore(app);
export const auth = admin.auth(app);
export default admin;
