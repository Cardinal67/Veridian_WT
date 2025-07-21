
import React, { useState } from 'react';
import type { WorkoutRoutine, Exercise, WorkoutCategory } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { WORKOUT_CATEGORIES } from '../constants';
import { PlusCircle, Trash2, Pencil, Dumbbell } from './Icons';

/**
 * Defines the props for the main Routines component.
 */
interface RoutinesProps {
  /** An array of all saved workout routines for the current user. */
  routines: WorkoutRoutine[];
  /** Callback function to save a new routine or update an existing one. */
  onSaveRoutine: (routine: WorkoutRoutine) => void;
  /** Callback function to delete a routine by its ID. */
  onDeleteRoutine: (routineId: string) => void;
  /** Callback function to start a workout session based on a selected routine. */
  onStartRoutine: (routine: WorkoutRoutine) => void;
}

/**
 * A modal component for creating a new workout routine or editing an existing one.
 * It's a self-contained form for managing the details of a single routine.
 */
const RoutineEditorModal: React.FC<{
  /** The routine object to be edited. If `null`, the modal is in "create new" mode. */
  routine: WorkoutRoutine | null;
  /** Callback to save the routine. */
  onSave: (routine: WorkoutRoutine) => void;
  /** Callback to close the modal. */
  onClose: () => void;
}> = ({ routine, onSave, onClose }) => {
  /**
   * State to hold the routine being edited. It's initialized with the passed `routine` prop
   * or a new, empty routine object if creating a new one.
   */
  const [editedRoutine, setEditedRoutine] = useState<WorkoutRoutine>(
    routine || { id: '', name: '', exercises: [] }
  );
  /** Fetches the list of available exercises to populate the dropdown. */
  const [workoutList] = useLocalStorage('customWorkouts', WORKOUT_CATEGORIES);

  /** Adds a selected exercise to the routine being edited. */
  const handleAddExercise = (exerciseName: string) => {
    // Check that an exercise was selected and that it's not already in the routine.
    if (exerciseName && !editedRoutine.exercises.some(e => e.name === exerciseName)) {
      setEditedRoutine(prev => ({
        ...prev,
        exercises: [...prev.exercises, { name: exerciseName, sets: 3, reps: 10 }]
      }));
    }
  };

  /** Removes an exercise from the routine. */
  const handleRemoveExercise = (exerciseName: string) => {
    setEditedRoutine(prev => ({
      ...prev,
      exercises: prev.exercises.filter(e => e.name !== exerciseName)
    }));
  };
  
  /** Updates the sets or reps for a specific exercise in the list. */
  const handleExerciseChange = (index: number, field: 'sets' | 'reps', value: string) => {
    const newExercises = [...editedRoutine.exercises];
    newExercises[index] = { ...newExercises[index], [field]: parseInt(value, 10) || 0 };
    setEditedRoutine(prev => ({ ...prev, exercises: newExercises }));
  };

  /** Validates and saves the routine. */
  const handleSave = () => {
    if (!editedRoutine.name.trim()) {
      alert("Please provide a name for the routine.");
      return;
    }
    if (editedRoutine.exercises.length === 0) {
      alert("A routine must have at least one exercise.");
      return;
    }
    // Assign a new ID if creating a new routine.
    onSave({ ...editedRoutine, id: routine?.id || Date.now().toString() });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-brand-card rounded-xl border border-brand-border w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-brand-border">
            <h2 className="text-2xl font-bold text-brand-primary">{routine ? 'Edit' : 'Create'} Routine</h2>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-brand-muted mb-1">Routine Name</label>
            <input
              type="text"
              value={editedRoutine.name}
              onChange={e => setEditedRoutine(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Upper Body Power"
              className="w-full bg-brand-dark border border-brand-border rounded-lg p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-muted mb-1">Add Exercise</label>
            <div className="flex gap-2">
                <select onChange={e => handleAddExercise(e.target.value)} className="w-full bg-brand-dark border border-brand-border rounded-lg p-2">
                  <option value="">Select an exercise...</option>
                   {workoutList.map(category => (
                      <optgroup key={category.category} label={category.category}>
                        {category.exercises.map(exercise => (
                          <option key={exercise.name} value={exercise.name}>{exercise.name}</option>
                        ))}
                      </optgroup>
                    ))}
                </select>
            </div>
          </div>
          <div className="space-y-2">
             <h3 className="text-lg font-semibold">Exercises</h3>
             {editedRoutine.exercises.length === 0 && <p className="text-brand-muted">No exercises added yet.</p>}
             {/* Map over the exercises in the routine being edited. */}
             {editedRoutine.exercises.map((ex, index) => (
               <div key={`${ex.name}-${index}`} className="flex items-center gap-2 bg-brand-dark p-2 rounded-lg">
                 <span className="flex-grow font-semibold">{ex.name}</span>
                 <input type="number" value={ex.sets} onChange={e => handleExerciseChange(index, 'sets', e.target.value)} className="w-16 bg-brand-card text-center p-1 rounded" />
                 <span className="text-sm text-brand-muted">sets</span>
                 <input type="number" value={ex.reps} onChange={e => handleExerciseChange(index, 'reps', e.target.value)} className="w-16 bg-brand-card text-center p-1 rounded" />
                 <span className="text-sm text-brand-muted">reps</span>
                 <button onClick={() => handleRemoveExercise(ex.name)} className="text-red-500 hover:text-red-400"><Trash2 className="w-5 h-5"/></button>
               </div>
             ))}
          </div>
        </div>
        <div className="p-6 border-t border-brand-border flex justify-end gap-4 mt-auto">
          <button onClick={onClose} className="bg-brand-muted/20 text-brand-light font-bold py-2 px-4 rounded-lg">Cancel</button>
          <button onClick={handleSave} className="bg-brand-primary text-brand-dark font-bold py-2 px-4 rounded-lg">{routine ? 'Save Changes' : 'Create Routine'}</button>
        </div>
      </div>
    </div>
  );
};

/**
 * The main Routines component displays a list of all saved workout routines.
 * It allows users to create, edit, delete, and start routines.
 */
const Routines: React.FC<RoutinesProps> = ({ routines, onSaveRoutine, onDeleteRoutine, onStartRoutine }) => {
  // --- STATE ---
  /** State to control the visibility of the RoutineEditorModal. */
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  /** State to hold the routine that is being edited. `null` when creating a new routine. */
  const [editingRoutine, setEditingRoutine] = useState<WorkoutRoutine | null>(null);

  // --- HANDLERS ---
  /** Opens the modal in "edit" mode with the selected routine's data. */
  const handleEdit = (routine: WorkoutRoutine) => {
    setEditingRoutine(routine);
    setIsEditorOpen(true);
  };
  
  /** Opens the modal in "create" mode. */
  const handleCreate = () => {
    setEditingRoutine(null);
    setIsEditorOpen(true);
  };
  
  /** Deletes a routine after user confirmation. */
  const handleDelete = (routineId: string) => {
    if (window.confirm("Are you sure you want to delete this routine? This cannot be undone.")) {
        onDeleteRoutine(routineId);
    }
  };

  // --- RENDER ---
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-brand-primary">Workout Routines</h1>
        <button onClick={handleCreate} className="flex items-center gap-2 bg-brand-primary text-brand-dark font-bold py-2 px-4 rounded-lg hover:bg-opacity-80">
          <PlusCircle className="w-6 h-6" />
          <span>New Routine</span>
        </button>
      </div>

      {/* Conditionally render a message if no routines exist. */}
      {routines.length === 0 ? (
        <div className="text-center py-10 bg-brand-card rounded-xl border border-brand-border">
          <p className="text-brand-muted">No routines created yet.</p>
          <p>Create a new routine or save a workout session from the "Log" tab.</p>
        </div>
      ) : (
        // Otherwise, render a grid of routine cards.
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {routines.map(routine => (
            <div key={routine.id} className="bg-brand-card p-4 rounded-xl border border-brand-border flex flex-col justify-between">
                <div>
                  <h2 className="text-xl font-bold text-brand-light mb-3">{routine.name}</h2>
                  {/* List of exercises within the routine card. */}
                  <ul className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                    {routine.exercises.map((ex, index) => (
                      <li key={`${ex.name}-${index}`} className="flex items-center gap-2 text-sm bg-brand-dark/50 p-2 rounded-md">
                        <Dumbbell className="w-4 h-4 text-brand-secondary flex-shrink-0" />
                        <span className="font-semibold flex-grow truncate">{ex.name}</span>
                        <span className="text-brand-muted">{ex.sets}x{ex.reps}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action buttons at the bottom of the card. */}
                <div className="border-t border-brand-border pt-4 flex flex-col gap-2">
                    <button onClick={() => onStartRoutine(routine)} className="w-full bg-brand-secondary text-brand-dark font-bold py-2 px-4 rounded-lg hover:bg-opacity-80">
                        Start this Routine
                    </button>
                    <div className="flex gap-2">
                        <button onClick={() => handleEdit(routine)} className="w-full flex items-center justify-center gap-2 bg-brand-dark/50 border border-brand-border font-bold py-2 px-4 rounded-lg hover:bg-brand-border">
                            <Pencil className="w-4 h-4"/> Edit
                        </button>
                        <button onClick={() => handleDelete(routine.id)} className="w-full flex items-center justify-center gap-2 bg-brand-dark/50 border border-brand-border text-red-500 font-bold py-2 px-4 rounded-lg hover:bg-red-500/10 hover:border-red-500/50">
                            <Trash2 className="w-4 h-4"/> Delete
                        </button>
                    </div>
                </div>
            </div>
          ))}
        </div>
      )}

      {/* The editor modal is rendered here, but only visible when `isEditorOpen` is true. */}
      {isEditorOpen && (
        <RoutineEditorModal
          routine={editingRoutine}
          onSave={onSaveRoutine}
          onClose={() => setIsEditorOpen(false)}
        />
      )}
    </div>
  );
};

export default Routines;
