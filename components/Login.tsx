
import React, { useState, useRef } from 'react';
import { Dumbbell, Upload } from './Icons';

/**
 * Defines the props for the main Login component.
 * It primarily consists of callbacks to the parent `App` component to handle auth logic.
 */
interface LoginProps {
    /** Callback to initiate the Google Sign-In flow. */
    onSignIn: () => void;
    /** Callback to handle an offline login attempt. */
    onOfflineLogin: (username: string, password: string) => void;
    /** Callback to handle an offline registration attempt. */
    onOfflineRegister: (username: string, password: string) => void;
    /** Callback to handle an offline password reset attempt. Returns a promise indicating success. */
    onOfflinePasswordReset: (username: string, securityCode: string, newPassword: string) => Promise<boolean>;
    /** An error message from a previous auth attempt, to be displayed in the UI. */
    offlineAuthError: string | null;
    /** The current mode of the form, either 'login' or 'register'. */
    mode: 'login' | 'register';
    /** Callback to change the form mode. */
    onModeChange: (mode: 'login' | 'register') => void;
}


/**
 * A modal component for handling the offline password reset flow.
 * It allows users to enter their username, security code, and new password,
 * or upload a recovery file to pre-fill the fields.
 */
const PasswordResetModal: React.FC<{
    onClose: () => void;
    onReset: (username: string, securityCode: string, newPassword: string) => Promise<boolean>;
}> = ({ onClose, onReset }) => {
    // State for the form fields.
    const [username, setUsername] = useState('');
    const [securityCode, setSecurityCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    // State for UI feedback.
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    // A ref to the hidden file input element.
    const fileInputRef = useRef<HTMLInputElement>(null);

    /**
     * Handles the selection of a recovery file. It reads the file content
     * and attempts to parse the username and security code from it.
     */
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                if (!content) throw new Error("File is empty.");

                // Use regex to find the username and security code in the text file.
                const usernameMatch = content.match(/Username: (.*)/);
                const codeMatch = content.match(/Security Code: (.*)/);

                if (usernameMatch && usernameMatch[1]) {
                    setUsername(usernameMatch[1].trim());
                } else {
                    throw new Error("Could not find username in file.");
                }

                if (codeMatch && codeMatch[1]) {
                    setSecurityCode(codeMatch[1].trim());
                } else {
                    throw new Error("Could not find security code in file.");
                }
                setError(null);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Invalid recovery file format.");
            } finally {
                // Reset file input so the user can upload the same file again if they made a mistake.
                if (event.target) {
                    event.target.value = '';
                }
            }
        };
        reader.onerror = () => {
             setError("Failed to read the file.");
        }
        reader.readAsText(file);
    };

    /** Handles the submission of the password reset form. */
    const handleResetSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (newPassword !== confirmPassword) {
            setError("New passwords do not match.");
            return;
        }
        if (!username || !securityCode || !newPassword) {
            setError("All fields are required.");
            return;
        }
        
        setIsResetting(true);
        const result = await onReset(username, securityCode, newPassword);
        setIsResetting(false);

        if (result) {
            setSuccess(true); // Show the success message.
        } else {
            setError("Invalid username or security code.");
        }
    };
    
    // If the reset was successful, show a confirmation screen.
    if (success) {
        return (
             <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div className="bg-brand-card rounded-xl border border-brand-border w-full max-w-md p-6 text-center space-y-4">
                    <h2 className="text-2xl font-bold text-brand-primary">Password Reset Successfully!</h2>
                    <p className="text-brand-light">You can now log in with your new password.</p>
                    <button onClick={onClose} className="w-full bg-brand-primary text-brand-dark font-bold py-2 px-4 rounded-lg">
                        Close
                    </button>
                </div>
            </div>
        )
    }

    // Render the main password reset modal form.
    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-brand-card rounded-xl border border-brand-border w-full max-w-md">
                 <div className="p-6 border-b border-brand-border">
                    <h2 className="text-2xl font-bold text-brand-primary">Reset Password</h2>
                </div>
                <form onSubmit={handleResetSubmit} className="p-6 space-y-4">
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".txt" className="hidden"/>
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 bg-brand-dark border border-brand-border font-bold py-3 px-4 rounded-lg hover:bg-brand-border">
                        <Upload className="w-5 h-5"/> Upload Recovery Code File
                    </button>
                     
                    <div className="relative flex py-1 items-center">
                        <div className="flex-grow border-t border-brand-border"></div>
                        <span className="flex-shrink mx-4 text-brand-muted text-xs">OR ENTER MANUALLY</span>
                        <div className="flex-grow border-t border-brand-border"></div>
                    </div>

                     <div>
                       <label className="block text-sm font-medium text-brand-muted mb-1">Username</label>
                       <input type="text" value={username} onChange={e => setUsername(e.target.value)} required className="w-full bg-brand-dark border border-brand-border rounded-lg p-2"/>
                    </div>
                     <div>
                       <label className="block text-sm font-medium text-brand-muted mb-1">Security Code</label>
                       <input type="text" value={securityCode} onChange={e => setSecurityCode(e.target.value)} required placeholder="XXXX-XXXX-XXXX" className="w-full bg-brand-dark border border-brand-border rounded-lg p-2 font-mono"/>
                    </div>
                     <div>
                       <label className="block text-sm font-medium text-brand-muted mb-1">New Password</label>
                       <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required className="w-full bg-brand-dark border border-brand-border rounded-lg p-2"/>
                    </div>
                     <div>
                       <label className="block text-sm font-medium text-brand-muted mb-1">Confirm New Password</label>
                       <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="w-full bg-brand-dark border border-brand-border rounded-lg p-2"/>
                    </div>
                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                    <div className="pt-2 flex justify-end gap-4">
                        <button type="button" onClick={onClose} className="bg-brand-muted/20 text-brand-light font-bold py-2 px-4 rounded-lg">Cancel</button>
                        <button type="submit" disabled={isResetting} className="bg-brand-primary text-brand-dark font-bold py-2 px-4 rounded-lg disabled:bg-brand-muted">
                           {isResetting ? 'Resetting...' : 'Reset Password'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/**
 * The main Login component. It serves as the entry point for unauthenticated users,
 * offering options to sign in with Google or use an offline account (login or register).
 */
const Login: React.FC<LoginProps> = ({ onSignIn, onOfflineLogin, onOfflineRegister, onOfflinePasswordReset, offlineAuthError, mode, onModeChange }) => {
    // State for the login/register form fields.
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    // State to control the visibility of the password reset modal.
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);

    /** Handles the submission of the offline login or register form. */
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!username || !password) {
            alert("Username and password cannot be empty.");
            return;
        }
        if (mode === 'login') {
            onOfflineLogin(username, password);
        } else {
            if (password !== confirmPassword) {
                alert("Passwords do not match.");
                return;
            }
            onOfflineRegister(username, password);
        }
    };

    return (
        <div className="min-h-screen bg-brand-dark text-brand-light flex flex-col items-center justify-center p-4">
            <div className="text-center w-full max-w-md mx-auto">
                <div className="flex justify-center items-center gap-4 mb-4">
                    <Dumbbell className="w-12 h-12 text-brand-primary" />
                    <h1 className="text-4xl font-bold tracking-tighter">Veridian Workout Tracker</h1>
                </div>
                <p className="text-brand-muted mb-8">
                    Your personal AI-powered fitness companion. Log workouts, track progress, and get custom plans.
                </p>
                <div className="bg-brand-card p-8 rounded-xl border border-brand-border space-y-4">
                    <h2 className="text-xl font-semibold">Get Started</h2>
                    <p className="text-sm text-brand-muted">
                        Sign in with Google to sync your data across devices, back up to Google Drive, and connect with Google Fit.
                    </p>
                    <button onClick={onSignIn} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-3 hover:bg-blue-700 transition-colors">
                        <svg className="w-5 h-5" viewBox="0 0 48 48"><path fill="#fbc02d" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12 s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20 s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#e53935" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039 l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path><path fill="#4caf50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36 c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path><path fill="#1565c0" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.089,5.571l6.19,5.238 C42.022,35.17,44,30.025,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path></svg>
                        Sign In with Google
                    </button>
                    <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-brand-border"></div>
                        <span className="flex-shrink mx-4 text-brand-muted text-xs">OR</span>
                        <div className="flex-grow border-t border-brand-border"></div>
                    </div>
                    
                    <div className="text-left">
                      {/* Tabs to switch between Login and Register modes. */}
                      <div className="flex border-b border-brand-border mb-4">
                        <button onClick={() => onModeChange('login')} className={`flex-1 py-2 text-center font-semibold ${mode === 'login' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-brand-muted'}`}>Login</button>
                        <button onClick={() => onModeChange('register')} className={`flex-1 py-2 text-center font-semibold ${mode === 'register' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-brand-muted'}`}>Create Account</button>
                      </div>

                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                           <label className="block text-sm font-medium text-brand-muted mb-1">Username</label>
                           <input type="text" value={username} onChange={e => setUsername(e.target.value)} required className="w-full bg-brand-dark border border-brand-border rounded-lg p-2"/>
                        </div>
                        <div>
                           <label className="block text-sm font-medium text-brand-muted mb-1">Password</label>
                           <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-brand-dark border border-brand-border rounded-lg p-2"/>
                        </div>
                        {/* The "Confirm Password" field is only shown in register mode. */}
                        {mode === 'register' && (
                          <div>
                            <label className="block text-sm font-medium text-brand-muted mb-1">Confirm Password</label>
                            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="w-full bg-brand-dark border border-brand-border rounded-lg p-2"/>
                          </div>
                        )}
                        {offlineAuthError && <p className="text-red-500 text-sm text-center">{offlineAuthError}</p>}
                        <button type="submit" className="w-full bg-brand-secondary text-brand-dark font-bold py-3 rounded-lg hover:bg-opacity-80">
                           {mode === 'login' ? 'Login to Offline Account' : 'Create Offline Account'}
                        </button>
                        {mode === 'login' && (
                            <button type="button" onClick={() => setIsResetModalOpen(true)} className="text-sm text-brand-secondary hover:underline w-full pt-1">
                                Forgot Password?
                            </button>
                        )}
                      </form>
                    </div>
                </div>
                 <p className="text-xs text-brand-muted mt-6">
                    Using an offline account, your data will be stored only on this device and browser, protected by your password.
                </p>
            </div>
            {/* The password reset modal is rendered here but only visible when `isResetModalOpen` is true. */}
            {isResetModalOpen && (
                <PasswordResetModal
                    onClose={() => setIsResetModalOpen(false)}
                    onReset={onOfflinePasswordReset}
                />
            )}
        </div>
    );
};

export default Login;
