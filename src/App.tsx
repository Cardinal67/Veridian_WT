import React, { useState, useEffect, useCallback, useMemo } from 'react';
import WorkoutHistory from './components/WorkoutHistory';
import WorkoutLogger from './components/WorkoutLogger';
import Dashboard from './components/Dashboard';
import AiPlanner from './components/AiPlanner';
import Routines from './components/Routines';
import Settings from './components/Settings';
import HealthTracker from './components/HealthTracker';
import Login from './components/Login';
import SaveRoutineFromSessionModal from './components/SaveRoutineFromSessionModal';
import { Dumbbell, List, LayoutDashboard, Bot, Pencil, Settings as SettingsIcon, Cloud, CloudOff, RefreshCw, HeartPulse, ClipboardList, Download } from './components/Icons';
import type { AppData, WorkoutSession, WorkoutRoutine, Exercise, DefaultSettings, HealthStat, UserProfile } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { initGoogleClient, signIn, saveDataToDrive, readDataFromDrive } from './services/googleDriveService';
import { saveHealthStatToFit, saveWorkoutSessionToFit } from './services/googleFitService';
import { DEFAULT_SETTINGS } from './constants';

// --- Type Definitions specific to the App component ---

// Defines the possible views (pages) the user can navigate to.
type View = 'logger' | 'history' | 'dashboard' | 'ai' | 'routines' | 'settings' | 'health';
// Defines the possible states for the cloud synchronization UI.
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';
// Defines the modes for the authentication form (either logging in or registering).
type AuthMode = 'login' | 'register';


// --- Password Hashing Utilities ---
// These are async functions that run in the browser to handle offline password security.

/**
 * Hashes a password string using the browser's built-in SubtleCrypto API (SHA-256).
 * @param password The plain-text password to hash.
 * @returns A promise that resolves to the hex-encoded hash string.
 */
const hashPassword = async (password: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Verifies a plain-text password against a stored hash.
 * @param password The plain-text password to check.
 * @param hash The stored hash to compare against.
 * @returns A promise that resolves to `true` if the password matches the hash, otherwise `false`.
 */
const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
    const passwordHash = await hashPassword(password);
    return passwordHash === hash;
};

/**
 * Generates a random, human-readable 12-character security code for password recovery.
 * The character set excludes ambiguous characters like 'I', '1', 'O', '0'.
 * @returns A formatted security code string (e.g., "ABCD-EFGH-JKLM").
 */
const generateSecurityCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 12; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Format as XXXX-XXXX-XXXX for better readability.
    return `${result.slice(0, 4)}-${result.slice(4, 8)}-${result.slice(8, 12)}`;
};

/**
 * A modal component displayed after a new offline account is created.
 * It shows the user their unique security code and provides options to copy or download it.
 * This is critical for account recovery.
 */
const SecurityCodeModal: React.FC<{ username: string, code: string, onClose: () => void }> = ({ username, code, onClose }) => {
    // State to give feedback when the code is copied.
    const [copied, setCopied] = useState(false);
    
    // Copies the security code to the user's clipboard.
    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds.
    };

    // Creates a text file with the recovery info and triggers a download.
    const handleDownload = () => {
        const fileContent = `Veridian Workout Tracker - Account Recovery Code\n\nUsername: ${username}\nSecurity Code: ${code}\n\nPlease store this file in a safe place. You will need this code to reset your password if you forget it.`;
        const blob = new Blob([fileContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `veridian-workout-tracker-recovery-code-${username}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url); // Clean up the object URL.
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-brand-card rounded-xl border border-brand-border w-full max-w-md text-center p-6 space-y-4">
                <h2 className="text-2xl font-bold text-brand-primary">Account Created!</h2>
                <p className="text-brand-light">Welcome, <span className="font-bold">{username}</span>!</p>
                <p className="text-brand-muted">Below is your one-time security code. You will need this to reset your password. Please store it somewhere safe.</p>
                <div className="bg-brand-dark p-4 rounded-lg border border-brand-border">
                    <p className="text-2xl font-mono tracking-widest text-brand-secondary">{code}</p>
                </div>
                 <div className="flex gap-4">
                    <button onClick={handleCopy} className="w-full flex items-center justify-center gap-2 bg-brand-dark border border-brand-border font-bold py-2 px-4 rounded-lg hover:bg-brand-border">
                        {copied ? 'Copied!' : 'Copy Code'}
                    </button>
                    <button onClick={handleDownload} className="w-full flex items-center justify-center gap-2 bg-brand-dark border border-brand-border font-bold py-2 px-4 rounded-lg hover:bg-brand-border">
                        <Download className="w-5 h-5"/> Download
                    </button>
                </div>
                <p className="text-xs text-yellow-400">This code will NOT be shown again.</p>
                <button onClick={onClose} className="w-full bg-brand-primary text-brand-dark font-bold py-3 px-4 rounded-lg hover:bg-opacity-80">
                    I have saved my code. Proceed to Login.
                </button>
            </div>
        </div>
    );
}

/**
 * The main component of the application. It acts as the root container and controller.
 * It manages all major state, business logic, and routing between different views.
 */
const App: React.FC = () => {
  // --- STATE MANAGEMENT ---
  // All major application state is managed here and passed down to child components as props.
  
  // Navigation state: determines which component/page is currently visible.
  const [view, setView] = useState<View>('dashboard');
  
  // --- Profile and Authentication State ---
  // `useLocalStorage` is a custom hook that syncs state with the browser's localStorage.
  
  // Stores an array of all offline user profiles created on this device.
  const [profiles, setProfiles] = useLocalStorage<UserProfile[]>('workoutTrackerProfiles', []);
  // Stores the ID of the currently logged-in offline user. `null` if no one is logged in locally.
  const [activeLocalProfileId, setActiveLocalProfileId] = useLocalStorage<string | null>('activeLocalProfileId', null);
  // Tracks if the Google Sign-In client is ready to be used.
  const [isAuthReady, setIsAuthReady] = useState(false);
  // Tracks if the user is currently signed in with a Google account.
  const [isSignedIn, setIsSignedIn] = useState(false);
  // Holds any error message from an offline login/register attempt.
  const [offlineAuthError, setOfflineAuthError] = useState<string | null>(null);
  // Temporarily holds the new user's info to display in the SecurityCodeModal.
  const [securityCodeForNewUser, setSecurityCodeForNewUser] = useState<{ username: string; code: string } | null>(null);
  // Controls whether the login form or registration form is shown.
  const [authMode, setAuthMode] = useState<AuthMode>('login');

  // --- Core Application Data State ---
  // These states hold the data for the *currently active user* (whether local or cloud).

  // The primary data object: workout sessions, health stats, and routines.
  const [appData, setAppData] = useState<AppData>({ sessions: [], healthStats: [], routines: [] });
  // The user's application settings.
  const [settings, setSettings] = useState<DefaultSettings>(DEFAULT_SETTINGS);

  // --- Session Management State ---
  
  // Holds the workout session that is currently active (being logged). `null` if no session is active.
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  // Tracks the timestamp of the last user interaction with the active session, used for the auto-timeout feature.
  const [lastActivityTime, setLastActivityTime] = useState<number | null>(null);
  // If a user edits a past session, its ID is stored here. This helps differentiate editing from creating a new session.
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  
  // --- UI/Modal State ---
  
  // UI state for the cloud sync button (e.g., 'syncing', 'success').
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  // When a user wants to save a completed session as a new routine, the session is stored here to be passed to a modal.
  const [sessionToSaveAsRoutine, setSessionToSaveAsRoutine] = useState<WorkoutSession | null>(null);


  // --- DERIVED STATE (useMemo) ---
  // Values that are calculated from existing state. `useMemo` prevents recalculation on every render.

  /**
   * The full profile object of the currently active offline user.
   * It's derived from `profiles` and `activeLocalProfileId`. Returns `null` if not logged in locally.
   */
  const activeProfile = useMemo(() => {
    if (!activeLocalProfileId) return null;
    return profiles.find(p => p.id === activeLocalProfileId);
  }, [profiles, activeLocalProfileId]);

  // --- DATA MUTATION CALLBACKS (useCallback) ---
  // `useCallback` memoizes these functions so they aren't recreated on every render,
  // which is important for performance. These are defined before useEffects because
  // they are used as dependencies in them.

  /**
   * A generic utility to update a specific local user profile in the `profiles` array.
   * It takes an updater function to avoid stale state issues.
   * @param updater A function that receives the old profile and returns the updated profile.
   * @param profileIdToUpdate The ID of the profile to update (defaults to the active one).
   */
  const updateLocalProfile = useCallback((updater: (profile: UserProfile) => UserProfile, profileIdToUpdate?: string) => {
    const targetId = profileIdToUpdate || activeLocalProfileId;
    if (!targetId) return;
    setProfiles(prevProfiles =>
      prevProfiles.map(p =>
        p.id === targetId ? updater(p) : p
      )
    );
  }, [activeLocalProfileId, setProfiles]);

  /**
   * Finalizes and saves the `activeSession`.
   * This is a core function that handles saving for both local profiles and cloud users.
   * It also manages session IDs and durations.
   */
  const finishSession = useCallback(() => {
    if (!activeSession) return;
    // Don't save empty sessions.
    if (activeSession.exercises.length === 0) {
        setActiveSession(null); setEditingSessionId(null); return;
    }
    
    let finalSession = { ...activeSession };
    // If it's a new session ('active'), calculate its duration.
    if (activeSession.id === 'active') {
        finalSession.durationMinutes = Math.round((Date.now() - new Date(activeSession.timestamp).getTime()) / 60000);
    }

    // Give the new session a permanent ID based on the current timestamp.
    const newSessionId = finalSession.id === 'active' ? Date.now().toString() : finalSession.id;
    const finalSessionWithId = { ...finalSession, id: newSessionId };

    // A generic function to update an AppData object with the new session.
    const updateState = (currentData: AppData): AppData => {
        const updatedSessions = currentData.sessions.filter(s => s.id !== finalSession.id);
        const newSessions = [...updatedSessions, finalSessionWithId].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return { ...currentData, sessions: newSessions };
    };

    // Apply the update based on the user's auth state.
    if (activeLocalProfileId) {
        updateLocalProfile(profile => ({ ...profile, appData: updateState(profile.appData) }));
    } else if (isSignedIn) {
        const newAppData = updateState(appData);
        setAppData(newAppData); // Update local state immediately for UI responsiveness.
        saveDataToDrive(newAppData).catch(err => console.error("Drive save failed", err)); // Sync to cloud.
        saveWorkoutSessionToFit(finalSessionWithId); // Sync to Google Fit.
    }

    // Reset session state and navigate to the history view.
    setActiveSession(null);
    setEditingSessionId(null);
    if(view !== 'history') setView('history');
  }, [activeSession, appData, isSignedIn, activeLocalProfileId, view, updateLocalProfile]);


  // --- SIDE EFFECTS (useEffect) ---
  
  /**
   * This crucial effect synchronizes the `appData` and `settings` state based on the user's authentication status.
   * It runs whenever the auth state (`isSignedIn`, `activeProfile`) changes.
   * - If signed in with Google, it fetches data from Google Drive.
   * - If logged in with a local profile, it loads data from that profile.
   * - If logged out, it resets the app data to its default empty state.
   */
  useEffect(() => {
    if (isSignedIn) {
      // Google sign-in is the authority. Fetch from drive.
      setSyncStatus('syncing');
      readDataFromDrive()
        .then(driveData => {
          if (driveData) {
            setAppData(driveData);
            // Future enhancement: could sync settings from the cloud too.
          }
          setSyncStatus('success');
        })
        .catch(err => {
          console.error("Failed to read from drive on sign-in", err);
          setSyncStatus('error');
        })
        .finally(() => setTimeout(() => setSyncStatus('idle'), 3000)); // Reset status icon after 3s
    } else if (activeProfile) {
      // An offline profile is active. Load its data.
      setAppData(activeProfile.appData);
      setSettings(activeProfile.settings);
    } else {
      // No one is logged in, reset to default state.
      setAppData({ sessions: [], healthStats: [], routines: [] });
      setSettings(DEFAULT_SETTINGS);
    }
  }, [isSignedIn, activeProfile]);

  /**
   * Initializes the Google Sign-In client when the component mounts.
   * It also checks if a user was already signed in with Google from a previous visit.
   */
  useEffect(() => {
    initGoogleClient(() => {
        setIsAuthReady(true); // Signal that the sign-in button can be displayed.
        const token = (window as any).gapi?.client?.getToken();
        // Automatically sign in if a token exists AND we are not using a local profile.
        if (token && !activeLocalProfileId) {
           setIsSignedIn(true);
        }
    });
  }, [activeLocalProfileId]); // Rerun if local profile logs out, allowing Google Sign-In to take over.

  /**
   * Implements the session timeout feature.
   * If an active session exists and no action is taken for the duration specified
   * in `settings.sessionTimeout`, the session is automatically finished and saved.
   */
  useEffect(() => {
    let timeoutId: number | undefined;
    if (activeSession && lastActivityTime && settings.sessionTimeout > 0) {
      const timeoutMs = settings.sessionTimeout * 60 * 1000;
      const timeSinceLastActivity = Date.now() - lastActivityTime;
      const remainingTime = timeoutMs - timeSinceLastActivity;
      
      if (remainingTime <= 0) {
        // Timeout has already passed.
        finishSession();
      } else {
        // Set a timer to finish the session when the timeout is reached.
        timeoutId = window.setTimeout(finishSession, remainingTime);
      }
    }
    // Cleanup function: clear the timeout if the component unmounts or dependencies change.
    return () => { if (timeoutId) clearTimeout(timeoutId); };
  }, [activeSession, lastActivityTime, settings.sessionTimeout, finishSession]);

  
  // --- EVENT HANDLERS & BUSINESS LOGIC ---
  // These functions are passed as props to child components to handle user actions.

  const updateActiveSession = (sessionUpdate: Partial<WorkoutSession>) => {
      if(!activeSession) return;
      setActiveSession(prev => prev ? { ...prev, ...sessionUpdate } : null);
      setLastActivityTime(Date.now()); // Reset the timeout timer on any update.
  }

  const startSession = (session: WorkoutSession) => {
    if(activeSession) finishSession(); // Finish any existing session before starting a new one.
    setActiveSession(session);
    setLastActivityTime(Date.now());
    setView('logger');
  }
  
  const startEmptySession = () => {
    startSession({
        id: 'active', // 'active' is a special ID for a new, unsaved session.
        timestamp: new Date().toISOString(),
        name: `Workout - ${new Date().toLocaleDateString()}`,
        warmup: false, equipment: 'Bodyweight', notes: '', exercises: [],
    });
  };

  const addExerciseToSession = (exercise: Omit<Exercise, 'id'>) => {
    const newExercise: Exercise = { ...exercise, id: Date.now().toString() };
    if (!activeSession) {
      // If no session is active, adding an exercise automatically starts one.
      startSession({
        id: 'active', timestamp: new Date().toISOString(), warmup: false, equipment: 'Bodyweight', notes: '',
        exercises: [newExercise],
      });
    } else {
      // If a session is active, check if we're just adding a new set to an existing exercise.
      const existingExerciseIndex = activeSession.exercises.findIndex(ex => ex.name === newExercise.name && ex.weight === newExercise.weight && ex.unit === newExercise.unit && ex.reps === newExercise.reps);
      let updatedExercises;
      if (existingExerciseIndex > -1) {
        // Increment the set count of the existing exercise.
        updatedExercises = [...activeSession.exercises];
        updatedExercises[existingExerciseIndex].sets += 1;
      } else {
        // Add the new exercise to the list.
        updatedExercises = [...activeSession.exercises, newExercise];
      }
      setActiveSession(prev => prev ? { ...prev, exercises: updatedExercises } : null);
    }
    setLastActivityTime(Date.now()); // Reset timeout timer.
  };

  const deleteSession = async (sessionId: string) => {
    if (!window.confirm("Are you sure you want to delete this session?")) return;
    
    // Generic update function to remove a session.
    const updateFunc = (currentData: AppData): AppData => ({
        ...currentData,
        sessions: currentData.sessions.filter(s => s.id !== sessionId)
    });

    // Apply deletion based on auth state.
    if (activeLocalProfileId) {
      updateLocalProfile(profile => ({ ...profile, appData: updateFunc(profile.appData) }));
    } else if (isSignedIn) {
        const newAppData = updateFunc(appData);
        setAppData(newAppData);
        saveDataToDrive(newAppData).catch(error => {
            console.error("Failed to sync deletion to Drive:", error);
            alert("Could not sync deletion to cloud. It may reappear on next sync.");
        });
    }
  };

  const editSession = (sessionId: string) => {
    finishSession(); // Finish any currently active session first.
    const sessionToEdit = appData.sessions.find(s => s.id === sessionId);
    if(sessionToEdit) {
      setEditingSessionId(sessionId); // Mark that we are in "edit mode".
      setActiveSession(sessionToEdit); // Load the session into the logger.
      setLastActivityTime(null); // Disable the auto-timeout while editing.
      setView('logger');
    }
  };

  const cancelActiveSession = () => {
    setActiveSession(null);
    setEditingSessionId(null);
    if(view === 'logger') setView('dashboard'); // Go back to dashboard if we cancel.
  };

  const saveRoutine = (routine: WorkoutRoutine) => {
    const updateFunc = (currentData: AppData): AppData => {
        const existingIndex = currentData.routines.findIndex(r => r.id === routine.id);
        let newRoutines;
        if (existingIndex > -1) {
            // Update existing routine
            newRoutines = [...currentData.routines];
            newRoutines[existingIndex] = routine;
        } else {
            // Add new routine
            newRoutines = [...currentData.routines, routine];
        }
        return { ...currentData, routines: newRoutines };
    };

    if (activeLocalProfileId) {
        updateLocalProfile(profile => ({ ...profile, appData: updateFunc(profile.appData) }));
    } else if (isSignedIn) {
        const newAppData = updateFunc(appData);
        setAppData(newAppData);
        saveDataToDrive(newAppData).catch(err => console.error("Drive save failed", err));
    }
  };

  const deleteRoutine = async (routineId: string) => {
      if (!window.confirm("Are you sure you want to delete this routine?")) return;
      const updateFunc = (currentData: AppData): AppData => ({
          ...currentData,
          routines: currentData.routines.filter(r => r.id !== routineId)
      });
      if (activeLocalProfileId) {
          updateLocalProfile(profile => ({ ...profile, appData: updateFunc(profile.appData) }));
      } else if (isSignedIn) {
          const newAppData = updateFunc(appData);
          setAppData(newAppData);
          saveDataToDrive(newAppData).catch(error => {
              console.error("Failed to sync routine deletion to Drive:", error);
              alert("Could not sync deletion to cloud. It may reappear on next sync.");
          });
      }
  };

  const startRoutine = (routine: WorkoutRoutine) => {
      const newSession: WorkoutSession = {
          id: 'active', timestamp: new Date().toISOString(), name: `Routine: ${routine.name}`,
          warmup: false, equipment: 'Bodyweight', notes: '',
          exercises: routine.exercises.map(ex => ({
              ...ex, id: `${ex.name}-${Date.now()}`,
              // Use user's default settings for weight/unit when starting a routine.
              weight: settings.defaultWeight, unit: settings.defaultUnit
          })),
      };
      startSession(newSession);
      // Remember the last routine started for the "Quick Start" dashboard card.
      localStorage.setItem('lastRoutineId', JSON.stringify(routine.id));
  };
  
  const addHealthStat = (stat: Omit<HealthStat, 'id' | 'timestamp'>) => {
    const newStat: HealthStat = { ...stat, id: Date.now().toString(), timestamp: new Date().toISOString() };
    const updateFunc = (currentData: AppData): AppData => ({
        ...currentData,
        healthStats: [...currentData.healthStats, newStat]
    });
    
    if (activeLocalProfileId) {
        updateLocalProfile(profile => ({ ...profile, appData: updateFunc(profile.appData) }));
    } else if (isSignedIn) {
        const newAppData = updateFunc(appData);
        setAppData(newAppData);
        saveDataToDrive(newAppData).catch(err => console.error("Drive save failed", err));
        saveHealthStatToFit(newStat); // Sync to Google Fit
    }
  };

  const deleteHealthStat = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this entry?")) return;
    const updateFunc = (currentData: AppData): AppData => ({
        ...currentData,
        healthStats: currentData.healthStats.filter(stat => stat.id !== id)
    });

    if (activeLocalProfileId) {
        updateLocalProfile(profile => ({ ...profile, appData: updateFunc(profile.appData) }));
    } else if (isSignedIn) {
        const newAppData = updateFunc(appData);
        setAppData(newAppData);
        saveDataToDrive(newAppData).catch(error => {
            console.error("Failed to sync health stat deletion to Drive:", error);
            alert("Could not sync deletion to cloud. It may reappear on next sync.");
        });
    }
  };
  
  const handlePersistSettings = (newSettings: DefaultSettings) => {
    setSettings(newSettings);
    if (activeLocalProfileId) {
      updateLocalProfile(profile => ({ ...profile, settings: newSettings }));
    } // Note: For signed-in users, settings are not cloud-synced in this version. They are local to the device.
  };

  // --- Authentication Handlers ---
  const handleSignIn = () => signIn(success => {
    if (success) {
      setOfflineAuthError(null);
      setIsSignedIn(true);
      setActiveLocalProfileId(null); // Clear local profile when signing in with Google.
    }
  });

  const handleOfflineLogin = async (username: string, password: string) => {
    setOfflineAuthError(null);
    const profile = profiles.find(p => p.name.toLowerCase() === username.toLowerCase());
    if (!profile || !profile.passwordHash) {
        setOfflineAuthError("Invalid username or password.");
        return;
    }
    const isVerified = await verifyPassword(password, profile.passwordHash);
    if (isVerified) {
        setActiveLocalProfileId(profile.id); // Set the active local profile ID to log in.
        setIsSignedIn(false); // Ensure Google sign-in is marked as false.
    } else {
        setOfflineAuthError("Invalid username or password.");
    }
  };
  
  const handleOfflineRegister = async (username: string, password: string) => {
    setOfflineAuthError(null);
    if (profiles.some(p => p.name.toLowerCase() === username.toLowerCase())) {
        setOfflineAuthError("Username already taken.");
        return;
    }
    const passwordHash = await hashPassword(password);
    const securityCode = generateSecurityCode();
    const securityCodeHash = await hashPassword(securityCode); // Hash the security code for storage.
    const newProfile: UserProfile = {
      id: Date.now().toString(),
      name: username.trim(),
      passwordHash,
      securityCodeHash,
      appData: { sessions: [], healthStats: [], routines: [] }, // New profile starts with empty data.
      settings: DEFAULT_SETTINGS,
    };
    setProfiles(prev => [...prev, newProfile]);
    // Show the security code modal to the user.
    setSecurityCodeForNewUser({ username: newProfile.name, code: securityCode });
  };
  
  const handleOfflinePasswordReset = async (username: string, securityCode: string, newPassword: string): Promise<boolean> => {
    const profile = profiles.find(p => p.name.toLowerCase() === username.toLowerCase());

    if (!profile || !profile.securityCodeHash) {
        return false; // User or security code hash doesn't exist.
    }
    
    // Verify the provided security code against the stored hash.
    const isVerified = await verifyPassword(securityCode, profile.securityCodeHash);

    if (isVerified) {
        const newPasswordHash = await hashPassword(newPassword);
        // Update the password hash for the correct profile.
        updateLocalProfile(p => ({ ...p, passwordHash: newPasswordHash }), profile.id);
        return true;
    } else {
        return false;
    }
  };
  
  const handleDeleteActiveProfile = () => {
    if (!activeLocalProfileId || !activeProfile) return;
    if (window.confirm(`Are you sure you want to delete the profile "${activeProfile.name}"? This is irreversible.`)) {
        setProfiles(prev => prev.filter(p => p.id !== activeLocalProfileId));
        setActiveLocalProfileId(null); // This logs the user out.
    }
  };

  const handleLogOut = () => {
    // This is a generic logout function for both Google and offline accounts.
    setOfflineAuthError(null);
    setActiveLocalProfileId(null);
    setIsSignedIn(false);
    // The data-loading useEffect will handle resetting the app state.
  };
  
  const handleProceedToLogin = () => {
    // Called when the user closes the security code modal.
    setSecurityCodeForNewUser(null);
    setAuthMode('login'); // Switch the form to login mode.
  };


  // --- RENDER LOGIC ---

  // If the user is not authenticated (neither via Google nor an offline profile),
  // render the Login component.
  if (!isSignedIn && !activeLocalProfileId) {
    return (
      <>
        {/* The security code modal is shown on top of the login screen if needed. */}
        {securityCodeForNewUser && (
            <SecurityCodeModal 
                username={securityCodeForNewUser.username}
                code={securityCodeForNewUser.code}
                onClose={handleProceedToLogin}
            />
        )}
        <Login
          onSignIn={handleSignIn}
          onOfflineLogin={handleOfflineLogin}
          onOfflineRegister={handleOfflineRegister}
          onOfflinePasswordReset={handleOfflinePasswordReset}
          offlineAuthError={offlineAuthError}
          mode={authMode}
          onModeChange={setAuthMode}
        />
      </>
    );
  }

  // A function to render the currently selected view based on the `view` state.
  const renderView = () => {
    switch (view) {
      case 'logger':
        return <WorkoutLogger activeSession={activeSession} onAddExercise={addExerciseToSession} onUpdateSession={updateActiveSession} onFinishSession={finishSession} onCancel={cancelActiveSession} onStartEmptySession={startEmptySession} />;
      case 'history':
        return <WorkoutHistory activeSession={activeSession} sessions={appData.sessions} onDelete={deleteSession} onEdit={editSession} onInitiateSaveRoutine={setSessionToSaveAsRoutine} />;
      case 'dashboard':
        return <Dashboard appData={appData} onStartRoutine={startRoutine} />;
      case 'routines':
        return <Routines routines={appData.routines} onSaveRoutine={saveRoutine} onDeleteRoutine={deleteRoutine} onStartRoutine={startRoutine} />;
      case 'ai':
        return <AiPlanner />;
      case 'health':
        return <HealthTracker healthStats={appData.healthStats} onAddStat={addHealthStat} onDeleteStat={deleteHealthStat} />;
      case 'settings':
        return <Settings appData={appData} settings={settings} setSettings={handlePersistSettings} onUpdateProfileData={(data) => setAppData(prev => ({...prev, ...data}))} setSyncStatus={setSyncStatus} isAuthReady={isAuthReady} isSignedIn={isSignedIn} setIsSignedIn={setIsSignedIn} onLogOut={handleLogOut} activeProfileName={activeProfile?.name} onDeleteActiveProfile={handleDeleteActiveProfile} />;
      default:
        return <Dashboard appData={appData} onStartRoutine={startRoutine} />;
    }
  };

  // A reusable component for navigation items.
  const NavItem: React.FC<{ currentView: View; targetView: View; onClick: (view: View) => void; children: React.ReactNode; }> = ({ currentView, targetView, onClick, children }) => (
    <button onClick={() => onClick(targetView)} className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-200 w-16 h-16 ${currentView === targetView ? 'text-brand-primary' : 'text-brand-muted hover:text-brand-light hover:bg-brand-card'}`}>
      {children}
    </button>
  );

  // A helper component to add a title attribute (tooltip) to the sync icon.
  const SyncStatusIcon: React.FC<{ title: string; children: React.ReactNode; }> = ({ title, children }) => (<div title={title}>{children}</div>);

  // Displays the appropriate icon based on the current sync status.
  const SyncStatusDisplay: React.FC = () => {
    if (!isSignedIn) return <SyncStatusIcon title={`Using offline profile: ${activeProfile?.name}`}><CloudOff className="w-5 h-5" /></SyncStatusIcon>;
    switch (syncStatus) {
      case 'syncing': return <SyncStatusIcon title="Syncing..."><RefreshCw className="w-5 h-5 animate-spin" /></SyncStatusIcon>;
      case 'success': return <SyncStatusIcon title="Synced successfully"><Cloud className="w-5 h-5 text-brand-primary" /></SyncStatusIcon>;
      case 'error': return <SyncStatusIcon title="Sync failed"><CloudOff className="w-5 h-5 text-red-500" /></SyncStatusIcon>;
      default: return <SyncStatusIcon title="Cloud sync active"><Cloud className="w-5 h-5" /></SyncStatusIcon>;
    }
  };
  
  // The main application layout.
  return (
    <div className="min-h-screen bg-brand-dark flex flex-col md:flex-row">
      {/* Modals are rendered at the top level to overlay everything else. */}
      {sessionToSaveAsRoutine && (
          <SaveRoutineFromSessionModal
              session={sessionToSaveAsRoutine}
              onSave={saveRoutine}
              onClose={() => setSessionToSaveAsRoutine(null)}
          />
      )}
      
      {/* Main navigation bar (bottom on mobile, side on desktop) */}
      <nav className="w-full md:w-20 bg-brand-card/50 md:bg-black/20 border-t md:border-t-0 md:border-r border-brand-border fixed bottom-0 md:relative md:min-h-screen z-10">
        <div className="flex md:flex-col justify-around md:justify-start md:items-center md:gap-y-4 p-1 md:p-4">
          <div className="hidden md:block text-brand-primary my-4"><Dumbbell className="w-8 h-8"/></div>
          <NavItem currentView={view} targetView="dashboard" onClick={setView}><LayoutDashboard className="w-6 h-6" /><span className="text-xs mt-1">Dashboard</span></NavItem>
          <NavItem currentView={view} targetView="logger" onClick={setView}>
            <Pencil className="w-6 h-6" />
            <span className="text-xs mt-1">Log</span>
          </NavItem>
          <NavItem currentView={view} targetView="history" onClick={setView}><List className="w-6 h-6" /><span className="text-xs mt-1">Sessions</span></NavItem>
          <NavItem currentView={view} targetView="routines" onClick={setView}><ClipboardList className="w-6 h-6" /><span className="text-xs mt-1">Routines</span></NavItem>
          <NavItem currentView={view} targetView="health" onClick={setView}><HeartPulse className="w-6 h-6" /><span className="text-xs mt-1">Health</span></NavItem>
          <NavItem currentView={view} targetView="ai" onClick={setView}><Bot className="w-6 h-6" /><span className="text-xs mt-1">AI Plan</span></NavItem>
          <NavItem currentView={view} targetView="settings" onClick={setView}><SettingsIcon className="w-6 h-6" /><span className="text-xs mt-1">Settings</span></NavItem>
        </div>
        <div className="hidden md:block absolute bottom-4 left-1/2 -translate-x-1/2 text-brand-muted"><SyncStatusDisplay /></div>
      </nav>
      
      {/* Main content area where the active view is rendered */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 mb-20 md:mb-0">
        {renderView()}
      </main>
    </div>
  );
};

export default App;