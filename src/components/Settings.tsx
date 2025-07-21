import React, { useRef, useState } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { DefaultSettings, WorkoutCategory, AppData } from '../types';
import { WORKOUT_CATEGORIES, DEFAULT_SETTINGS } from '../constants';
import { Download, Upload, Cloud, RefreshCw } from './Icons';
import { signIn, signOut, readDataFromDrive, saveDataToDrive } from '../services/googleDriveService';
import type { SyncStatus } from '../App';

// --- Type definitions specific to this component ---
/** The keys of the AppData object, plus 'settings', for use in the import/export feature. */
type DataKey = keyof AppData | 'settings';
/** An array of all data keys that can be imported or exported. */
const DATA_KEYS: DataKey[] = ['sessions', 'healthStats', 'routines', 'settings'];


// --- Sub-component: ImportExportModal ---
/**
 * A modal component for handling the import and export of user data.
 * It's a self-contained unit with its own state and logic for file handling.
 */
const ImportExportModal: React.FC<{
    /** Determines if the modal is in 'import' or 'export' mode. */
    mode: 'import' | 'export';
    /** Callback to close the modal. */
    onClose: () => void;
    /** The current user's app data, needed for exporting. */
    appData: AppData;
    /** The current user's settings, needed for exporting. */
    settings: DefaultSettings;
    /** Callback to apply imported data to the main app state. */
    onImport: (data: Partial<AppData>, settings?: DefaultSettings) => void;
}> = ({ mode, onClose, appData, settings, onImport }) => {
    /** State to track which data keys (sessions, routines, etc.) are selected for the operation. */
    const [selectedKeys, setSelectedKeys] = useState<DataKey[]>(DATA_KEYS);
    /** A ref to the hidden file input element, to trigger it programmatically. */
    const fileInputRef = useRef<HTMLInputElement>(null);
    /** State to hold the data parsed from an imported file. */
    const [importFileData, setImportFileData] = useState<any>(null);

    /** Toggles the selection of a data key in the checklist. */
    const handleKeyToggle = (key: DataKey) => {
        setSelectedKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    };

    /** Handles the export process: creates a JSON file and triggers a download. */
    const handleExport = () => {
        const dataToExport: any = {};
        // Build the export object based on selected keys.
        if (selectedKeys.includes('settings')) {
            dataToExport.settings = settings;
        }
        for (const key of DATA_KEYS) {
            // Only include data if the key is selected and the data array is not empty.
            if (key !== 'settings' && selectedKeys.includes(key) && appData[key].length > 0) {
                dataToExport[key] = appData[key];
            }
        }
        if (Object.keys(dataToExport).length === 0) {
            alert("No data selected or available to export."); return;
        }
        // Create a data URI and a link element to trigger the download.
        const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(dataToExport, null, 2))}`;
        const link = document.createElement("a");
        link.href = jsonString;
        link.download = `workout-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        onClose();
    };

    /** Handles the file selection for import. Reads and parses the selected JSON file. */
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target?.result as string);
                if (typeof imported !== 'object' || imported === null) throw new Error("Invalid file format.");
                setImportFileData(imported);
                // Automatically pre-select the checkboxes for the data keys available in the imported file.
                const availableKeys = DATA_KEYS.filter(key => key in imported);
                setSelectedKeys(availableKeys);
            } catch (error) {
                alert(`Error reading file: ${error instanceof Error ? error.message : "Unknown error"}`);
            }
        };
        reader.readAsText(file);
    };
    
    /** Handles the final import action after user confirmation. */
    const handleImport = () => {
        if (!importFileData) { alert("Please select a file first."); return; }
        if (!window.confirm("This will overwrite selected data for the current profile. Are you sure?")) return;

        // Prepare the data to be sent to the parent component.
        const dataToImport: Partial<AppData> = {};
        let settingsToImport: DefaultSettings | undefined;

        if (selectedKeys.includes('settings') && 'settings' in importFileData) {
            settingsToImport = importFileData.settings;
        }
        for (const key of DATA_KEYS) {
            if (key !== 'settings' && selectedKeys.includes(key) && key in importFileData) {
                dataToImport[key] = importFileData[key];
            }
        }
        onImport(dataToImport, settingsToImport);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-brand-card rounded-xl border border-brand-border w-full max-w-md">
                <div className="p-6 border-b border-brand-border">
                    <h2 className="text-2xl font-bold text-brand-primary capitalize">{mode} Data</h2>
                </div>
                <div className="p-6 space-y-4">
                    {mode === 'import' && !importFileData && (
                        <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 bg-brand-dark border border-brand-border font-bold py-3 px-4 rounded-lg">
                            <Upload className="w-5 h-5"/> Select Backup File
                        </button>
                    )}
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".json" className="hidden"/>

                    <p className="text-brand-muted">Select data to {mode} for the current profile:</p>
                    <div className="space-y-2">
                        {DATA_KEYS.map(key => (
                           <div key={key} className="flex items-center bg-brand-dark p-3 rounded-lg">
                               <input
                                 type="checkbox"
                                 id={`key-${key}`}
                                 checked={selectedKeys.includes(key)}
                                 onChange={() => handleKeyToggle(key)}
                                 // Disable checkbox if importing and the key is not in the file.
                                 disabled={mode === 'import' && importFileData && !(key in importFileData)}
                                 className="h-5 w-5 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                               />
                               <label htmlFor={`key-${key}`} className="ml-3 text-brand-light capitalize flex-grow">{key}</label>
                           </div>
                        ))}
                    </div>
                </div>
                <div className="p-6 border-t border-brand-border flex justify-end gap-4">
                    <button onClick={onClose} className="bg-brand-muted/20 text-brand-light font-bold py-2 px-4 rounded-lg">Cancel</button>
                    <button onClick={mode === 'export' ? handleExport : handleImport} className="bg-brand-primary text-brand-dark font-bold py-2 px-4 rounded-lg capitalize">{mode}</button>
                </div>
            </div>
        </div>
    );
};


// --- Main Settings Component ---
interface SettingsProps {
    appData: AppData;
    settings: DefaultSettings;
    setSettings: (settings: DefaultSettings) => void;
    onUpdateProfileData: (data: Partial<AppData>) => void;
    setSyncStatus: React.Dispatch<React.SetStateAction<SyncStatus>>;
    isAuthReady: boolean;
    isSignedIn: boolean;
    setIsSignedIn: React.Dispatch<React.SetStateAction<boolean>>;
    onLogOut: () => void;
    activeProfileName?: string;
    onDeleteActiveProfile: () => void;
}

const Settings: React.FC<SettingsProps> = ({ appData, settings, setSettings, onUpdateProfileData, setSyncStatus, isAuthReady, isSignedIn, setIsSignedIn, onLogOut, activeProfileName, onDeleteActiveProfile }) => {
    /** Fetches the custom workout list to populate the default exercise dropdown. */
    const [workoutList] = useLocalStorage<WorkoutCategory[]>('customWorkouts', WORKOUT_CATEGORIES);
    /** State to manage the loading state of the "Sync Now" button. */
    const [isSyncing, setIsSyncing] = useState(false);
    /** State to control the visibility and mode of the ImportExportModal. */
    const [modal, setModal] = useState<'import' | 'export' | null>(null);

    /** A check to see if the Google Client ID is configured. */
    const isClientIdSet = import.meta.env.VITE_GOOGLE_CLIENT_ID && import.meta.env.VITE_GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID_HERE.apps.googleusercontent.com';

    /** Generic handler to update a specific setting. */
    const handleSettingChange = <K extends keyof DefaultSettings>(key: K, value: DefaultSettings[K]) => {
        setSettings({ ...settings, [key]: value });
    };

    /** Callback passed to the import modal to apply the imported data. */
    const handleDataImport = (data: Partial<AppData>, newSettings?: DefaultSettings) => {
        onUpdateProfileData(data);
        if (newSettings) {
            setSettings(newSettings);
        }
        alert("Data imported successfully!");
    };

    const handleSignIn = () => signIn(success => { setIsSignedIn(success); if(success) handleSync(true); });
    const handleSignOut = () => { signOut(); onLogOut(); setSyncStatus('idle'); };

    /**
     * A simple data merge strategy. It combines local and remote data arrays and
     * uses a Map to de-duplicate items based on their `id`. This ensures that
     * updates to existing items are preserved and new items from both sources are kept.
     */
    const mergeData = (local: AppData, remote: AppData): AppData => {
        const mergeByKey = (key: keyof AppData) => {
            const combined = [...(local[key] || []), ...(remote[key] || [])];
            const map = new Map(combined.map((item: any) => [item.id, item]));
            return Array.from(map.values()).sort((a: any, b: any) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
        };
        return {
            sessions: mergeByKey('sessions') as AppData['sessions'],
            healthStats: mergeByKey('healthStats') as AppData['healthStats'],
            routines: mergeByKey('routines') as AppData['routines'],
        };
    }

    /**
     * Handles the manual "Sync Now" process.
     * It fetches remote data, merges it with local data, updates the local state,
     * and saves the merged result back to the cloud.
     */
    const handleSync = async (isInitialSync = false) => {
        if (!isSignedIn) { alert("Please sign in with Google first."); return; }
        setIsSyncing(true); setSyncStatus('syncing');
        try {
            const remoteData = await readDataFromDrive();
            const localData = appData;

            if (remoteData) {
                 if (isInitialSync && (localData.sessions.length > 0 || localData.healthStats.length > 0)) {
                     if(!window.confirm("Cloud data found. Do you want to merge it with your current local data?")) {
                        onUpdateProfileData(remoteData); // If user says no, overwrite local with remote.
                        // Or you could choose to do nothing:
                        // setSyncStatus('idle'); setIsSyncing(false); return;
                     }
                 }
                const mergedData = mergeData(localData, remoteData);
                onUpdateProfileData(mergedData); // Update app state with merged data.
                await saveDataToDrive(mergedData); // Save merged data back to Drive.
            } else {
                // No remote data exists, so this is the first sync. Save local data to Drive.
                await saveDataToDrive(localData);
            }
            setSyncStatus('success');
            setTimeout(() => setSyncStatus('idle'), 3000);
        } catch (error) {
            setSyncStatus('error');
            setTimeout(() => setSyncStatus('idle'), 5000);
            console.error("Sync failed:", error); alert(`Sync failed. ${error instanceof Error ? error.message : ''}`);
        } finally {
            setIsSyncing(false);
        }
    }
    
    /**
     * A highly destructive action to wipe all application data from localStorage.
     */
    const handleResetApp = async () => {
        if (window.confirm("Are you sure you want to reset the entire application? All your offline profiles and their data will be permanently deleted. This cannot be undone.")) {
            // Attempt to sign out from Google to clear tokens.
            if (isSignedIn) {
                try {
                    await signOut();
                } catch (error) {
                    console.error("Sign out failed during app reset, proceeding anyway.", error);
                    alert("Failed to sign out from Google. Please revoke access manually if needed. Local data will be cleared.");
                }
            }
            // Clear everything from localStorage.
            localStorage.clear();
            alert("Application data has been reset. The app will now reload.");
            window.location.reload();
        }
    };
    
    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-brand-primary">Settings</h1>
            {modal && <ImportExportModal mode={modal} onClose={() => setModal(null)} appData={appData} settings={settings} onImport={handleDataImport} />}

            {/* --- Account & Sync Section --- */}
            <div className="bg-brand-card p-6 rounded-xl border border-brand-border space-y-6">
                 <h2 className="text-xl font-semibold text-brand-light">{isSignedIn ? 'Google Cloud Sync' : `Offline Profile: ${activeProfileName}`}</h2>
                {isSignedIn ? (
                    <>
                        <p className="text-brand-muted mt-1">Backup your data to a private Google Drive folder. Signing in also syncs workout and health data with Google Fit.</p>
                        {!isClientIdSet ? (<p className="text-yellow-400 text-sm">Google Client ID not configured. Cloud sync is disabled.</p>)
                        : !isAuthReady ? (<button disabled className="w-full bg-brand-muted text-brand-dark font-bold py-3 rounded-lg">Initializing...</button>)
                        : (
                            <div className="space-y-4">
                                <button onClick={() => handleSync()} disabled={isSyncing} className="w-full flex items-center justify-center gap-2 bg-brand-secondary text-brand-dark font-bold py-3 rounded-lg disabled:bg-brand-muted">
                                    {isSyncing ? <RefreshCw className="w-5 h-5 animate-spin"/> : <Cloud className="w-5 h-5"/>} {isSyncing ? 'Syncing...' : 'Sync Now'}
                                </button>
                                <button onClick={handleSignOut} className="w-full bg-brand-dark border border-brand-border font-bold py-3 rounded-lg">Sign Out</button>
                            </div>
                        )}
                    </>
                ) : (
                     <>
                        <p className="text-brand-muted mt-1">Your data is saved only in this browser, protected by your password.</p>
                        <button onClick={onLogOut} className="w-full bg-brand-dark border border-brand-border font-bold py-3 rounded-lg">Log Out</button>
                    </>
                )}
                 {/* Show the Google Sign-In button only when logged out of an offline account. */}
                 {!isSignedIn && (
                    <div className="pt-4 border-t border-brand-border text-center">
                        <p className="text-sm text-brand-muted mb-2">Or, sign in to sync your data to the cloud.</p>
                        <button onClick={handleSignIn} disabled={!isClientIdSet || !isAuthReady} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-3 disabled:opacity-50">
                            <svg className="w-5 h-5" viewBox="0 0 48 48"><path fill="#fbc02d" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12 s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20 s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#e53935" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039 l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path><path fill="#4caf50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36 c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path><path fill="#1565c0" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.089,5.571l6.19,5.238 C42.022,35.17,44,30.025,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path></svg>
                            Sign In with Google
                        </button>
                    </div>
                )}
            </div>

            {/* --- General Settings Section --- */}
            <div className="bg-brand-card p-6 rounded-xl border border-brand-border space-y-6">
                <h2 className="text-xl font-semibold text-brand-light">Workout & Session Settings</h2>
                <div>
                  <label htmlFor="session-timeout" className="block text-sm font-medium text-brand-muted">Session Timeout (minutes)</label>
                  <input type="number" id="session-timeout" value={settings.sessionTimeout} onChange={e => handleSettingChange('sessionTimeout', Math.max(1, parseInt(e.target.value) || 60))} className="w-full mt-1 bg-brand-dark border border-brand-border rounded-lg p-2" />
                  <p className="text-xs text-brand-muted mt-1">If you don't add an exercise for this duration, your session will be saved automatically.</p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-brand-muted">Default Exercise</label>
                    <select value={settings.defaultWorkout} onChange={(e) => handleSettingChange('defaultWorkout', e.target.value)} className="w-full mt-1 bg-brand-dark border border-brand-border rounded-lg p-2">
                        {workoutList.map(category => (
                            <optgroup key={category.category} label={category.category}>
                                {category.exercises.map(ex => <option key={ex.name} value={ex.name}>{ex.name}</option>)}
                            </optgroup>
                        ))}
                    </select>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                      <label className="block text-sm font-medium text-brand-muted">Default Reps</label>
                      <input type="number" value={settings.defaultReps} onChange={e => handleSettingChange('defaultReps', Math.max(0, parseInt(e.target.value) || 0))} className="w-full mt-1 bg-brand-dark border border-brand-border rounded-lg p-2" />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-brand-muted">Default Weight</label>
                      <input type="number" value={settings.defaultWeight} onChange={e => handleSettingChange('defaultWeight', Math.max(0, parseFloat(e.target.value) || 0))} className="w-full mt-1 bg-brand-dark border border-brand-border rounded-lg p-2" />
                  </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-brand-muted mb-2">Default Unit</label>
                    <div className="flex bg-brand-dark border border-brand-border rounded-lg h-10">
                        <button onClick={() => handleSettingChange('defaultUnit', 'kg')} className={`w-1/2 p-2 rounded-l-md ${settings.defaultUnit === 'kg' ? 'bg-brand-secondary text-brand-dark font-semibold' : ''}`}>kg</button>
                        <button onClick={() => handleSettingChange('defaultUnit', 'lbs')} className={`w-1/2 p-2 rounded-r-md ${settings.defaultUnit === 'lbs' ? 'bg-brand-secondary text-brand-dark font-semibold' : ''}`}>lbs</button>
                    </div>
                </div>
            </div>

            {/* --- Data Management Section --- */}
            <div className="bg-brand-card p-6 rounded-xl border border-brand-border space-y-6">
                <h2 className="text-xl font-semibold text-brand-light">Local Data Backup</h2>
                <p className="text-brand-muted mt-1">Manually export or import your app data from a local backup file. This affects the currently active profile.</p>
                <div className="flex flex-col sm:flex-row gap-4">
                    <button onClick={() => setModal('import')} className="flex-1 flex items-center justify-center gap-2 bg-brand-dark border border-brand-border font-bold py-3 rounded-lg">
                        <Upload className="w-5 h-5"/> Import Data
                    </button>
                    <button onClick={() => setModal('export')} className="flex-1 flex items-center justify-center gap-2 bg-brand-dark border border-brand-border font-bold py-3 rounded-lg">
                        <Download className="w-5 h-5"/> Export Data
                    </button>
                </div>
            </div>

            {/* --- Danger Zone --- */}
            <div className="bg-red-900/20 p-6 rounded-xl border border-red-500/50 space-y-4">
                <h2 className="text-xl font-semibold text-red-400">Danger Zone</h2>
                {/* Profile deletion is only available for offline profiles. */}
                {!isSignedIn && activeProfileName && (
                    <div className="border-t border-red-500/30 pt-4 space-y-2">
                         <p className="text-red-400/80">This will permanently delete your current offline profile ({activeProfileName}) and all its data. This cannot be undone.</p>
                        <button onClick={onDeleteActiveProfile} className="w-full bg-red-600/80 border border-red-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-red-600">
                            Delete Current Profile
                        </button>
                    </div>
                )}
                <div className="border-t border-red-500/30 pt-4 space-y-2">
                  <p className="text-red-400/80">This action is irreversible and will permanently delete ALL app data from this browser, including all offline profiles.</p>
                  <button onClick={handleResetApp} className="w-full bg-red-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-red-700">
                      Reset All App Data
                  </button>
                </div>
            </div>
        </div>
    );
};

export default Settings;