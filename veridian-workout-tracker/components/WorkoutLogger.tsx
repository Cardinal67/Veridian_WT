
import React, { useState, useMemo, useEffect } from 'react';
import type { WorkoutSession, Exercise, DefaultSettings, WorkoutCategory } from '../types';
import { WORKOUT_CATEGORIES, EQUIPMENT_LIST } from '../constants';
import { useLocalStorage, useSessionTimer } from '../hooks/useLocalStorage';
import { PlusCircle, Trash2, Plus, Minus, Dumbbell } from './Icons';

/**
 * Defines the props accepted by the WorkoutLogger component.
 * These are primarily callbacks and data from the parent `App` component.
 */
interface WorkoutLoggerProps {
  /** The current workout session being logged or edited. Null if no session is active. */
  activeSession: WorkoutSession | null;
  /** Callback function to add a new exercise to the current session. */
  onAddExercise: (exercise: Omit<Exercise, 'id'>) => void;
  /** Callback function to update properties of the active session (e.g., notes, warmup). */
  onUpdateSession: (sessionUpdate: Partial<WorkoutSession>) => void;
  /** Callback function to finalize and save the current session. */
  onFinishSession: () => void;
  /** Callback function to cancel the current session or edit operation. */
  onCancel: () => void;
  /** Callback function to start a new, empty session. */
  onStartEmptySession: () => void;
}

/**
 * A fallback default settings object in case the one from localStorage is not available.
 */
const DEFAULT_SETTINGS: DefaultSettings = {
    defaultWorkout: WORKOUT_CATEGORIES[0].exercises[0].name,
    defaultReps: 10,
    defaultWeight: 0,
    defaultUnit: 'kg',
    sessionTimeout: 60,
};

/**
 * The WorkoutLogger component is the main interface for creating and managing an active workout session.
 * It allows users to add exercises, modify their properties, and finalize the session.
 * It also serves as the interface for editing past workout sessions.
 */
const WorkoutLogger: React.FC<WorkoutLoggerProps> = ({ activeSession, onAddExercise, onUpdateSession, onFinishSession, onCancel, onStartEmptySession }) => {
  // --- DERIVED STATE & CONSTANTS ---
  
  /** A boolean flag to determine if we are editing an existing session vs. logging a new one. */
  const isEditing = activeSession ? activeSession.id !== 'active' : false;

  // --- HOOKS ---

  /** Fetches the user's saved settings from localStorage, with a fallback to default settings. */
  const [settings] = useLocalStorage<DefaultSettings>('workoutSettings', DEFAULT_SETTINGS);
  /** Fetches the list of workouts, including any custom ones the user has added. */
  const [workoutList, setWorkoutList] = useLocalStorage<WorkoutCategory[]>('customWorkouts', WORKOUT_CATEGORIES);
  /** Custom hook that provides a running timer string for the active session. */
  const timer = useSessionTimer(activeSession && !isEditing ? activeSession.timestamp : null);


  // --- COMPONENT STATE ---

  // State for the "Add Exercise" form. It's initialized with the user's default settings.
  const [selectedWorkout, setSelectedWorkout] = useState<string>(settings.defaultWorkout);
  const [reps, setReps] = useState(settings.defaultReps);
  const [weight, setWeight] = useState(settings.defaultWeight);
  const [unit, setUnit] = useState<'kg' | 'lbs'>(settings.defaultUnit);
  /** A boolean to control whether a weight input is shown for a bodyweight exercise (e.g., weighted pull-ups). */
  const [addExtraWeight, setAddExtraWeight] = useState(false);
  /** State for the input field when adding a new custom workout name. */
  const [customWorkout, setCustomWorkout] = useState('');
  /** State for the type of the new custom workout ('bodyweight' or 'weighted'). */
  const [customWorkoutType, setCustomWorkoutType] = useState<'bodyweight' | 'weighted'>('weighted');
  /** A boolean to toggle the visibility of the custom workout input fields. */
  const [isAddingCustom, setIsAddingCustom] = useState(false);

  // --- MORE DERIVED STATE (useMemo) ---
  
  /** A memoized reference to the exercises in the active session for stable rendering. */
  const exercises = activeSession?.exercises || [];
  /** A memoized calculation of the total number of sets in the current session. */
  const totalSets = useMemo(() => exercises.reduce((acc, ex) => acc + ex.sets, 0), [exercises]);

  /**
   * Memoized lookup to find the details (like `type`) of the currently selected exercise
   * from the main workout list. This is used to determine if it's a bodyweight exercise.
   */
  const selectedExerciseInfo = useMemo(() => {
    for (const category of workoutList) {
        const exercise = category.exercises.find(ex => ex.name === selectedWorkout);
        if (exercise) return exercise;
    }
    return null;
  }, [selectedWorkout, workoutList]);
  
  /** A boolean indicating if the selected exercise is of type 'bodyweight'. */
  const isCurrentExerciseBodyweight = selectedExerciseInfo?.type === 'bodyweight';

  // --- SIDE EFFECTS (useEffect) ---
  
  /**
   * This effect resets the weight input when the selected exercise changes.
   * If the new exercise is bodyweight, weight is set to 0. Otherwise, it's set
   * to the user's default weight.
   */
  useEffect(() => {
      setAddExtraWeight(false); // Always hide the extra weight option on change.
      if (isCurrentExerciseBodyweight) {
        setWeight(0);
      } else {
        setWeight(settings.defaultWeight);
      }
  }, [selectedWorkout, isCurrentExerciseBodyweight, settings.defaultWeight]);

  // --- EVENT HANDLERS ---
  
  /** A wrapper function to call the parent `onUpdateSession` with the updated exercises list. */
  const handleExerciseListChange = (newExercises: Exercise[]) => {
      onUpdateSession({ exercises: newExercises });
  }

  /**
   * Updates the number of sets for a specific exercise.
   * @param id The ID of the exercise to update.
   * @param delta The amount to change the sets by (+1 or -1).
   */
  const handleUpdateSet = (id: string, delta: number) => {
    const newExercises = exercises
      .map(ex => ex.id === id ? { ...ex, sets: Math.max(1, ex.sets + delta) } : ex)
      .filter(ex => ex.sets > 0); // This line could be used to remove an exercise if sets hit 0.
    handleExerciseListChange(newExercises);
  };
  
  /** Removes an exercise from the active session. */
  const handleRemoveExercise = (id: string) => {
    handleExerciseListChange(exercises.filter(ex => ex.id !== id));
  };
  
  /** Handles the click of the main "Add Exercise" button. */
  const handleAddExerciseClick = () => {
    if (!selectedWorkout) return;
    // For bodyweight exercises, only include weight if the "add extra weight" checkbox is checked.
    const exerciseWeight = isCurrentExerciseBodyweight && !addExtraWeight ? 0 : weight;
    onAddExercise({ name: selectedWorkout, sets: 1, reps, weight: exerciseWeight, unit });
  };
  
  /** Adds a new, user-defined exercise to the main workout list. */
  const handleAddCustomWorkout = () => {
    const trimmedName = customWorkout.trim();
    // Ensure the name is not empty and doesn't already exist.
    if (trimmedName && !workoutList.some(cat => cat.exercises.some(ex => ex.name === trimmedName))) {
      const newExercise = { name: trimmedName, description: 'User-added custom exercise.', type: customWorkoutType };
      const updatedList = [...workoutList];
      // Add the new exercise to the "Functional Fitness" category, or the first category if that one doesn't exist.
      const functionalCategory = updatedList.find(c => c.category === "High-Intensity & Functional Fitness") || updatedList[0];
      functionalCategory.exercises.push(newExercise);
      setWorkoutList(updatedList); // This saves the updated list to localStorage via the custom hook.
      setSelectedWorkout(newExercise.name); // Automatically select the new exercise.
      // Reset the form fields.
      setCustomWorkout('');
      setIsAddingCustom(false);
    }
  };

  /** A derived boolean to control when the weight input should be disabled. */
  const isWeightInputDisabled = isCurrentExerciseBodyweight && !addExtraWeight;

  // --- RENDER ---
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-brand-primary">
        {isEditing ? 'Edit Workout Session' : (activeSession ? 'Active Workout Session' : 'Log a Workout')}
      </h1>
      
      {/* Show a "Start Empty Session" card if no session is currently active. */}
      {!activeSession && (
        <div className="bg-brand-card p-6 rounded-xl border border-brand-border space-y-4 text-center">
            <h2 className="text-xl font-semibold text-brand-light">Start a New Session</h2>
            <p className="text-brand-muted">You can start an empty session and add exercises as you go, or add your first exercise below to begin.</p>
            <button
                onClick={onStartEmptySession}
                className="w-full sm:w-auto bg-brand-secondary/20 text-brand-secondary border border-brand-secondary/50 font-bold py-3 px-6 rounded-lg hover:bg-brand-secondary/30 flex items-center justify-center gap-2"
            >
                <Dumbbell className="w-5 h-5" />
                Start Empty Session
            </button>
        </div>
      )}

      {/* The main form for adding a new exercise. */}
      <div className="bg-brand-card p-6 rounded-xl border border-brand-border space-y-4">
        <h2 className="text-xl font-semibold text-brand-light">Add Exercise</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div>
            <label htmlFor="workout-type" className="block text-sm font-medium text-brand-muted mb-1">Exercise Type</label>
            <select id="workout-type" value={selectedWorkout} onChange={(e) => setSelectedWorkout(e.target.value)} className="w-full bg-brand-dark border border-brand-border rounded-lg p-2">
              {/* Populate the dropdown from the workout list constant/localStorage. */}
              {workoutList.map(category => (
                <optgroup key={category.category} label={category.category}>
                  {category.exercises.map(ex => <option key={ex.name} value={ex.name}>{ex.name}</option>)}
                </optgroup>
              ))}
            </select>
            {/* Conditionally render the custom workout input fields. */}
            {isAddingCustom ? (
                <div className="flex flex-wrap gap-2 mt-2">
                    <input type="text" value={customWorkout} onChange={(e) => setCustomWorkout(e.target.value)} placeholder="New exercise name" className="flex-grow bg-brand-dark border border-brand-border rounded-lg p-2" />
                    <select value={customWorkoutType} onChange={e => setCustomWorkoutType(e.target.value as any)} className="bg-brand-dark border border-brand-border rounded-lg p-2">
                        <option value="weighted">Weighted</option><option value="bodyweight">Bodyweight</option>
                    </select>
                    <button onClick={handleAddCustomWorkout} className="bg-brand-primary text-brand-dark font-bold py-2 px-3 rounded-lg">Add</button>
                    <button onClick={() => setIsAddingCustom(false)} className="bg-brand-muted/20 text-brand-light py-2 px-3 rounded-lg">Cancel</button>
                </div>
            ) : <button onClick={() => setIsAddingCustom(true)} className="text-sm text-brand-primary hover:underline mt-2">Add custom exercise</button> }
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="reps" className="block text-sm font-medium text-brand-muted mb-1">Reps</label>
              <input type="number" id="reps" value={reps} onChange={e => setReps(Math.max(0, parseInt(e.target.value)))} className="w-full bg-brand-dark border border-brand-border rounded-lg p-2" />
            </div>
            <div>
              <label htmlFor="weight" className="block text-sm font-medium text-brand-muted mb-1">Weight ({unit})</label>
              <div className="flex">
                  <input type="number" id="weight" value={weight} onChange={e => setWeight(Math.max(0, parseFloat(e.target.value)))} disabled={isWeightInputDisabled} className="w-full bg-brand-dark border-brand-border rounded-l-lg p-2 border disabled:bg-brand-dark/50" />
                  <button onClick={() => setUnit(unit === 'kg' ? 'lbs' : 'kg')} className="bg-brand-secondary text-brand-dark font-semibold px-3 rounded-r-lg">{unit}</button>
              </div>
              {/* Conditionally render the "add extra weight" checkbox for bodyweight exercises. */}
              {isCurrentExerciseBodyweight && (
                  <div className="flex items-center gap-2 mt-2">
                      <input type="checkbox" id="addExtraWeight" checked={addExtraWeight} onChange={(e) => setAddExtraWeight(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary" />
                      <label htmlFor="addExtraWeight" className="text-sm text-brand-muted">Add extra weight</label>
                  </div>
              )}
            </div>
          </div>
        </div>
        <button onClick={handleAddExerciseClick} className="w-full flex items-center justify-center gap-2 bg-brand-primary text-brand-dark font-bold py-3 px-4 rounded-lg hover:bg-opacity-80">
          <PlusCircle className="w-6 h-6"/>
          {/* Change button text based on whether a session has started. */}
          <span>{exercises.length === 0 ? 'Start Session with this Exercise' : 'Add Exercise to Session'}</span>
        </button>
      </div>

      {/* This block is only rendered if there is an active session with at least one exercise. */}
      {activeSession && exercises.length > 0 && (
        <div className="bg-brand-card p-6 rounded-xl border border-brand-border space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-brand-light">Current Session ({totalSets} total sets)</h2>
            {/* Show the timer only for new sessions, not when editing old ones. */}
            {!isEditing && <span className="font-mono text-xl text-brand-secondary tracking-wider">{timer}</span>}
          </div>
          <div className="space-y-3">
            {/* Map over the exercises in the session and render a row for each. */}
            {exercises.map(ex => (
              <div key={ex.id} className="flex items-center justify-between bg-brand-dark p-3 rounded-lg">
                <div>
                  <p className="font-bold">{ex.name}</p>
                  <p className="text-sm text-brand-muted">{ex.reps} reps{ex.weight > 0 && ` @ ${ex.weight} ${ex.unit}`}</p>
                </div>
                <div className="flex items-center gap-3">
                   {/* +/- buttons for adjusting set count. */}
                   <div className="flex items-center gap-2 bg-brand-border p-1 rounded-lg">
                      <button onClick={() => handleUpdateSet(ex.id, -1)} className="p-1 rounded-full bg-brand-muted/20 hover:bg-brand-muted/50"><Minus className="w-4 h-4"/></button>
                      <span className="font-mono text-lg w-8 text-center">{ex.sets}</span>
                      <button onClick={() => handleUpdateSet(ex.id, 1)} className="p-1 rounded-full bg-brand-muted/20 hover:bg-brand-muted/50"><Plus className="w-4 h-4"/></button>
                   </div>
                   <span className="text-sm text-brand-muted">set(s)</span>
                  <button onClick={() => handleRemoveExercise(ex.id)} className="text-red-500 hover:text-red-400"><Trash2 className="w-5 h-5" /></button>
                </div>
              </div>
            ))}
          </div>
          
          {/* Section for session-wide details like notes, equipment, etc. */}
          <div className="border-t border-brand-border pt-4 space-y-4">
            {/* Additional inputs shown only when editing a past session. */}
            {isEditing && (
                <div className="space-y-4">
                    <div>
                        <label htmlFor="duration" className="block text-sm font-medium text-brand-muted mb-1">Session Duration (minutes)</label>
                        <input 
                            id="duration"
                            type="number"
                            value={activeSession.durationMinutes || 0}
                            onChange={e => onUpdateSession({ durationMinutes: parseInt(e.target.value) || 0 })}
                            className="w-full bg-brand-dark border border-brand-border rounded-lg p-2"
                        />
                    </div>
                    <div>
                        <label htmlFor="session-timestamp" className="block text-sm font-medium text-brand-muted mb-1">Session Date & Time</label>
                        <input
                            id="session-timestamp"
                            type="datetime-local"
                            // This complex value is needed to format the ISO string correctly for the input, accounting for timezones.
                            value={new Date(new Date(activeSession.timestamp).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16)}
                            onChange={e => {
                                if (e.target.value) {
                                    onUpdateSession({ timestamp: new Date(e.target.value).toISOString() })
                                }
                            }}
                            className="w-full bg-brand-dark border border-brand-border rounded-lg p-2"
                        />
                    </div>
                </div>
            )}
            <div className="flex items-center space-x-3">
              <input type="checkbox" id="warmup" checked={activeSession.warmup} onChange={e => onUpdateSession({ warmup: e.target.checked })} className="h-4 w-4 rounded text-brand-primary focus:ring-brand-primary"/>
              <label htmlFor="warmup">Did you warm up?</label>
            </div>
            <div>
              <label htmlFor="equipment" className="block text-sm font-medium text-brand-muted mb-1">Equipment Used</label>
              <select id="equipment" value={activeSession.equipment} onChange={e => onUpdateSession({ equipment: e.target.value })} className="w-full bg-brand-dark border border-brand-border rounded-lg p-2">
                {EQUIPMENT_LIST.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-brand-muted mb-1">Session Notes</label>
              <textarea id="notes" value={activeSession.notes} onChange={e => onUpdateSession({ notes: e.target.value })} rows={3} placeholder="How did it feel? Any PRs?" className="w-full bg-brand-dark border border-brand-border rounded-lg p-2"></textarea>
            </div>
            <div className="flex items-center gap-4">
                {isEditing && (
                    <button onClick={onCancel} className="w-full bg-brand-muted/30 text-brand-light font-bold py-3 px-4 rounded-lg">Cancel Edit</button>
                )}
                <button onClick={onFinishSession} className="w-full bg-brand-secondary text-brand-dark font-bold py-3 px-4 rounded-lg hover:bg-opacity-80">
                    {isEditing ? 'Update Session' : 'Finish & Save Session'}
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkoutLogger;
