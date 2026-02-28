import { initializeApp, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";

dotenv.config();

// Initialize Firebase Admin SDK
if (getApps().length === 0) {
    // When running locally, GOOGLE_APPLICATION_CREDENTIALS should be set
    // In GCP Cloud Run, `applicationDefault()` automatically picks up the service account
    initializeApp({
        credential: applicationDefault(),
        projectId: process.env.GOOGLE_CLOUD_PROJECT || "project-845acc0c-c9fe-448e-9d0"
    });
}

// Since you named the database 'trust' instead of leaving it as default
export const db = getFirestore(getApps()[0], "trust");
export const agentsCollection = db.collection("agents");
