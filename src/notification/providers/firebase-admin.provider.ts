import * as admin from 'firebase-admin';
export const firebaseAdminProvider = {
  provide: 'FIREBASE_ADMIN',
  useFactory: () => {
    const projectId = process.env.FIREBASE_PROJECT_ID;

    if (!projectId) {
      console.error('FIREBASE_PROJECT_ID is not set in environment variables');
      throw new Error('FIREBASE_PROJECT_ID is required');
    }

    console.log(
      `Initializing Firebase Admin SDK with Project ID: ${projectId}`,
    );

    const defaultApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: projectId,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
    return { defaultApp };
  },
};
