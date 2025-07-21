// @ts-nocheck
// Note: Using @ts-nocheck because the Google API scripts are loaded from a CDN at runtime.
// TypeScript doesn't know about the `gapi` or `google` global objects without
// more complex type declaration setup, which is overkill for this project.

import type { AppData } from '../types';

// --- CONFIGURATION CONSTANTS ---
// These values are now pulled from Vite's environment variables.
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const API_KEY = import.meta.env.VITE_API_KEY;
// The permissions (scopes) our application requests from the user.
// `drive.appdata` gives access to a special, hidden folder in the user's Google Drive that only our app can see.
// `fitness.activity.write` allows creating workout sessions in Google Fit.
// `fitness.body.write` allows logging body weight and other stats to Google Fit.
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/fitness.activity.write https://www.googleapis.com/auth/fitness.body.write';
// These are "Discovery Documents" that tell the GAPI client how to interact with the Drive and Fitness APIs.
const DISCOVERY_DOCS = [
    "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
    "https://www.googleapis.com/discovery/v1/apis/fitness/v1/rest"
];
// The filename for our data backup in the user's appData folder.
const FILENAME = 'workout-tracker-data.json';


// --- STATE & HELPERS ---

// Check if the API keys have been properly configured.
const isApiKeySet = API_KEY && API_KEY !== 'YOUR_GCP_API_KEY_HERE';
const isClientIdSet = CLIENT_ID && CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID_HERE.apps.googleusercontent.com';

// Global variables to hold the initialized Google clients.
let tokenClient;
let gapiInitialized = false;

/**
 * A helper function to dynamically load a script from a URL.
 * @param src The URL of the script to load.
 * @returns A promise that resolves when the script has loaded or rejects on error.
 */
const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // If the script already exists, resolve immediately.
    if (document.querySelector(`script[src="${src}"]`)) {
      return resolve();
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.body.appendChild(script);
  });
};


// --- GOOGLE API INITIALIZATION (TWO-PHASE PROCESS) ---

// This service manages a complex two-phase initialization for Google's services.
// Phase 1: Google Sign-In (GSI). Handles authentication. Only needs a Client ID.
// Phase 2: Google APIs (GAPI). Handles API calls (Drive, Fit). Needs an API Key and an access token from GSI.

// --- PHASE 1: Initialize Google Sign-In (GSI) Client ---
// This promise is initiated as soon as the module is loaded.
const gsiPromise = loadScript('https://accounts.google.com/gsi/client').then(() => {
    if (isClientIdSet) {
        // `initTokenClient` creates a client that can request an access token from the user.
        // The callback is set dynamically when `signIn` is called.
        tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: '',
        });
    } else {
        console.warn("Google Client ID is missing or is a placeholder. Sign-in features will be disabled.");
    }
}).catch(err => {
    console.error("Fatal error loading Google Sign-In script:", err);
});

/**
 * The entry point called from `App.tsx` to ensure the GSI client is ready.
 * @param callback A function to call once the GSI client has been initialized.
 */
export const initGoogleClient = (callback: () => void) => {
    gsiPromise.then(callback);
};


// --- PHASE 2: Initialize Google API (GAPI) Client ---
// This part is loaded LAZILY and ON-DEMAND only when a feature (like sync) needs it.
let gapiPromise: Promise<void> | null = null;

/**
 * Ensures the GAPI client is loaded and initialized.
 * This function is idempotent; it will only run the initialization process once.
 * @returns A promise that resolves when GAPI is ready.
 */
const ensureGapiInitialized = () => {
    if (!gapiPromise) {
        gapiPromise = (async () => {
            if (!isApiKeySet) {
                // The gapiCallWrapper will handle throwing a user-friendly error.
                return;
            }
            try {
                // Load the main GAPI script.
                await loadScript('https://apis.google.com/js/api.js');
                // Load the 'client' library within GAPI.
                await new Promise<void>((resolve) => window.gapi.load('client', resolve));
                // Initialize the client with our API key and discovery docs.
                await window.gapi.client.init({
                    apiKey: API_KEY,
                    discoveryDocs: DISCOVERY_DOCS,
                });
                gapiInitialized = true;
            } catch (err) {
                console.error("Error initializing Google APIs (Drive, Fit). Sync will fail.", err);
                gapiInitialized = false;
                // This error will be caught and re-thrown by the gapiCallWrapper.
                throw new Error("Failed to initialize Google APIs. Check the browser console for details.");
            }
        })();
    }
    return gapiPromise;
};


// --- API CALL WRAPPER ---
/**
 * A crucial wrapper function for any GAPI call (Drive, Fit).
 * It ensures GAPI is initialized and the user is signed in before making the call.
 * This centralizes the initialization and authentication checks.
 * @param apiCall The async function to execute (e.g., a fetch call to the Drive API).
 * @returns The result of the `apiCall`.
 * @throws An error if GAPI is not configured, not initialized, or the user is not signed in.
 */
export const gapiCallWrapper = async <T>(apiCall: () => Promise<T>): Promise<T> => {
    await ensureGapiInitialized();
    if (!gapiInitialized) {
        throw new Error("Google API features are unavailable. Please ensure your Google Cloud Platform API Key is configured correctly in your environment variables (VITE_API_KEY).");
    }
    if (!window.gapi.client.getToken()) {
        throw new Error("You are not signed in. Please sign in to use cloud features.");
    }
    return apiCall();
};


// --- AUTHENTICATION FUNCTIONS ---
/**
 * Initiates the Google Sign-In flow for the user.
 * @param callback A function that receives `true` on success or `false` on failure/cancellation.
 */
export const signIn = async (callback: (success: boolean) => void) => {
    await gsiPromise; // Make sure the GSI client is ready.
    if (!tokenClient) {
        alert("Google Sign-In is not available. Please ensure your Google Client ID is configured correctly.");
        return callback(false);
    }

    // Set the callback for the token client. This will be executed after the user interacts with the Google popup.
    tokenClient.callback = (resp) => {
        if (resp.error) {
            console.error("Google Sign-In Error:", resp);
            // Don't show an alert if the user just closed the popup.
            if(resp.error !== 'popup_closed_by_user' && resp.error !== 'access_denied') {
                alert(`Google Sign-In failed: ${resp.error}`);
            }
            return callback(false);
        }
        
        // On successful sign-in, ensure GAPI is initialized and then pass the new token to it.
        // This authorizes GAPI to make API calls on the user's behalf.
        ensureGapiInitialized().then(() => {
            if (gapiInitialized) {
                window.gapi.client.setToken(resp);
            }
        });
        callback(true);
    };

    // Open the Google Sign-In popup.
    tokenClient.requestAccessToken({ prompt: 'consent' });
};

/**
 * Signs the user out and revokes the application's access token.
 */
export const signOut = async () => {
    await gsiPromise;
    if (gapiInitialized) {
        const token = window.gapi.client.getToken();
        if (token !== null) {
            return new Promise<void>((resolve) => {
                // Ask Google to revoke the token.
                window.google.accounts.oauth2.revoke(token.access_token, () => {
                    // Clear the token from the GAPI client.
                    window.gapi.client.setToken(null);
                    resolve();
                });
            });
        }
    }
};


// --- GOOGLE DRIVE FUNCTIONS ---

/**
 * Finds the ID of our application's data file in the user's appDataFolder.
 * @returns A promise that resolves to the file ID string, or `null` if not found.
 */
const getFileId = async (): Promise<string | null> => {
    const response = await window.gapi.client.drive.files.list({
        spaces: 'appDataFolder', // Search only in the special app data folder.
        fields: 'files(id, name)',
        pageSize: 10,
    });
    const files = response.result.files;
    const existingFile = files.find(file => file.name === FILENAME);
    return existingFile ? existingFile.id : null;
};

/**
 * Reads and parses the application data from the file in Google Drive.
 * @returns A promise that resolves to the `AppData` object, or `null` if the file doesn't exist.
 */
export const readDataFromDrive = (): Promise<AppData | null> => gapiCallWrapper(async () => {
    const fileId = await getFileId();
    if (!fileId) {
        return null; // File doesn't exist yet.
    }
    const response = await window.gapi.client.drive.files.get({
        fileId: fileId,
        alt: 'media', // This parameter requests the file content itself.
    });
    return JSON.parse(response.body) as AppData;
});

/**
 * Saves the application data to a file in the user's Google Drive appDataFolder.
 * This function will create the file if it doesn't exist, or update it if it does.
 * @param data The `AppData` object to save.
 */
export const saveDataToDrive = (data: AppData): Promise<void> => gapiCallWrapper(async () => {
    const fileId = await getFileId();

    // The Drive API's upload/update functionality requires a multipart request body.
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    // The first part of the body contains the file's metadata (like its name).
    const metadata = {
        'name': FILENAME,
        'mimeType': 'application/json',
    };

    // The second part contains the actual file content.
    const multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(data) +
        close_delim;

    // Use the low-level `gapi.client.request` to build the multipart request.
    await window.gapi.client.request({
        // If `fileId` exists, we PATCH (update) the existing file. Otherwise, we POST (create) a new one.
        'path': `/upload/drive/v3/files${fileId ? `/${fileId}` : ''}`,
        'method': fileId ? 'PATCH' : 'POST',
        'params': { 'uploadType': 'multipart' },
        'headers': { 'Content-Type': 'multipart/related; boundary="' + boundary + '"' },
        'body': multipartRequestBody,
    });
});