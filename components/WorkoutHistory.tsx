
import React from 'react';
import type { WorkoutSession } from '../types';
import { Dumbbell, Trash2, Pencil, ClipboardList } from './Icons';
import { useSessionTimer } from '../hooks/useLocalStorage';

/**
 * Defines the props for the WorkoutHistory component.
 * It receives the list of all sessions and callbacks to interact with them.
 */
interface WorkoutHistoryProps {
  /** An array of all completed workout sessions for the current user. */
  sessions: WorkoutSession[];
  /** Callback function to delete a session by its ID. */
  onDelete: (sessionId: string) => void;
  /** Callback function to begin editing a session by its ID. */
  onEdit: (sessionId: string) => void;
  /** Callback function to open the "Save as Routine" modal with the selected session's data. */
  onInitiateSaveRoutine: (session: WorkoutSession) => void;
  /** The currently active workout session, if one exists. Used to display the active session banner. */
  activeSession: WorkoutSession | null;
}

/**
 * The WorkoutHistory component displays a list of all past workout sessions.
 * It allows users to view, edit, or delete their logged workouts.
 * It also provides an entry point for saving a past session as a new routine.
 */
const WorkoutHistory: React.FC<WorkoutHistoryProps> = ({ sessions, onDelete, onEdit, onInitiateSaveRoutine, activeSession }) => {
  
  // Sort sessions in descending chronological order (newest first).
  // A new array is created with `[...sessions]` to avoid mutating the original prop.
  const sortedSessions = [...sessions].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  // Use the custom hook to get a running timer for the active session banner.
  const timer = useSessionTimer(activeSession?.timestamp ?? null);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-brand-primary">Workout Sessions</h1>
      
      {/* If a session is currently active, display a prominent, pulsing banner at the top. */}
      {activeSession && (
        <div className="bg-brand-secondary/10 border border-brand-secondary/50 p-4 rounded-xl flex items-center justify-between animate-pulse-slow">
            <div className="flex items-center gap-3">
                <Dumbbell className="w-6 h-6 text-brand-secondary"/>
                <div>
                  <h2 className="font-bold text-brand-secondary">Active Session</h2>
                  <p className="text-sm text-brand-light">A workout is currently in progress.</p>
                </div>
            </div>
            <span className="font-mono text-3xl text-brand-secondary tracking-wider">{timer}</span>
        </div>
      )}

      {/* If there are no logged sessions, display a helpful message. */}
      {sortedSessions.length === 0 ? (
        <div className="text-center py-10 bg-brand-card rounded-xl border border-brand-border">
          <p className="text-brand-muted">No workout sessions logged yet.</p>
          <p>Go to the "Log" tab to get started!</p>
        </div>
      ) : (
        // If sessions exist, map over the sorted array and render a card for each one.
        <div className="space-y-4">
          {sortedSessions.map(session => {
            // Calculate total sets for display.
            const totalSets = session.exercises.reduce((acc, ex) => acc + ex.sets, 0);
            return (
              <div key={session.id} className="bg-brand-card p-4 sm:p-6 rounded-xl border border-brand-border transition-all duration-300 hover:border-brand-primary">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xl font-bold text-brand-light">
                      {/* Display the session name, or fall back to a formatted date. */}
                      {session.name || new Date(session.timestamp).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                    <p className="text-sm text-brand-muted">
                      {new Date(session.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                  {/* Action buttons for the session card. */}
                  <div className="flex items-center">
                      <button onClick={() => onInitiateSaveRoutine(session)} title="Save as Routine" className="text-brand-primary hover:text-green-400 p-2 rounded-full hover:bg-green-500/10 transition-colors">
                          <ClipboardList className="w-5 h-5" />
                      </button>
                      <button onClick={() => onEdit(session.id)} title="Edit Session" className="text-brand-secondary hover:text-blue-400 p-2 rounded-full hover:bg-blue-500/10 transition-colors">
                          <Pencil className="w-5 h-5" />
                      </button>
                      <button onClick={() => onDelete(session.id)} title="Delete Session" className="text-red-500 hover:text-red-400 p-2 rounded-full hover:bg-red-500/10 transition-colors">
                          <Trash2 className="w-5 h-5" />
                      </button>
                  </div>
                </div>
                {/* Collapsible details section of the card. */}
                <div className="mt-4 border-t border-brand-border pt-4">
                  {/* Summary stats. */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div className="bg-brand-dark p-3 rounded-lg">
                          <p className="text-brand-muted">Total Sets</p>
                          <p className="text-xl font-semibold text-brand-primary">{totalSets}</p>
                      </div>
                       <div className="bg-brand-dark p-3 rounded-lg">
                          <p className="text-brand-muted">Duration</p>
                          <p className="text-lg font-semibold text-brand-light">{session.durationMinutes ? `${session.durationMinutes} min` : 'N/A'}</p>
                      </div>
                      <div className="bg-brand-dark p-3 rounded-lg">
                          <p className="text-brand-muted">Equipment</p>
                          <p className="text-lg font-semibold text-brand-light">{session.equipment}</p>
                      </div>
                  </div>
                  {/* Display notes if they exist. */}
                  {session.notes && (
                      <div className="mt-4 bg-brand-dark p-3 rounded-lg">
                          <p className="text-brand-muted">Notes</p>
                          <p className="text-brand-light italic">"{session.notes}"</p>
                      </div>
                  )}
                  {/* List of exercises performed in the session. */}
                  <div className="mt-4">
                    <h4 className="font-semibold text-brand-light mb-2">Exercises:</h4>
                    <ul className="space-y-2">
                      {session.exercises.map(ex => (
                        <li key={ex.id} className="flex items-center gap-3 bg-brand-dark/50 p-2 rounded-md">
                          <Dumbbell className="w-5 h-5 text-brand-secondary" />
                          <span className="font-semibold">{ex.name}:</span>
                          <span className="text-brand-muted">{ex.sets} sets of {ex.reps} reps 
                            {ex.weight > 0 && ` @ ${ex.weight} ${ex.unit}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  );
};

export default WorkoutHistory;
