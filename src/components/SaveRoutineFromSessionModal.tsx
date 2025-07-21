
import React, { useState, useEffect } from 'react';
import type { WorkoutSession, WorkoutRoutine, Exercise } from '../types';

/**
 * A new type specific to this component. It extends the basic exercise info
 * with an `included` flag, allowing the user to toggle which exercises from
 * the session should be part of the new routine.
 */
type EditableExercise = Omit<Exercise, 'id' | 'weight' | 'unit'> & { included: boolean };

/**
 * Defines the props for the SaveRoutineFromSessionModal.
 */
interface SaveRoutineFromSessionModalProps {
  /** The completed workout session that the user wants to save as a routine. */
  session: WorkoutSession;
  /** Callback function to save the newly created routine to the main app state. */
  onSave: (routine: WorkoutRoutine) => void;
  /** Callback function to close the modal. */
  onClose: () => void;
}

/**
 * A modal component that allows a user to convert a completed workout session
 * into a reusable workout routine. It pre-populates the form with data from the
 * session and allows the user to edit the details before saving.
 */
const SaveRoutineFromSessionModal: React.FC<SaveRoutineFromSessionModalProps> = ({ session, onSave, onClose }) => {
  // --- STATE MANAGEMENT ---
  /** State for the new routine's name. */
  const [name, setName] = useState('');
  /** State for the list of exercises, enhanced with the `included` flag for editing. */
  const [exercises, setExercises] = useState<EditableExercise[]>([]);

  // --- SIDE EFFECTS (useEffect) ---
  /**
   * This effect runs when the component mounts or when the `session` prop changes.
   * It initializes the modal's form state with data from the provided session.
   */
  useEffect(() => {
    // Set the default routine name based on the session's name or date.
    setName(session.name || `Routine from ${new Date(session.timestamp).toLocaleDateString()}`);
    // Transform the session's exercises into the `EditableExercise` format,
    // with all exercises included by default.
    setExercises(session.exercises.map(ex => ({
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        included: true,
    })));
  }, [session]); // The effect depends on the session prop.
  
  // --- EVENT HANDLERS ---
  /**
   * Updates the sets or reps for a specific exercise in the list.
   * @param index The index of the exercise to update.
   * @param field The property to update ('sets' or 'reps').
   * @param value The new value as a string from the input field.
   */
  const handleExerciseChange = (index: number, field: 'sets' | 'reps', value: string) => {
    const newExercises = [...exercises];
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0) {
        newExercises[index] = { ...newExercises[index], [field]: numValue };
        setExercises(newExercises);
    }
  };

  /**
   * Toggles the `included` flag for an exercise when its checkbox is clicked.
   * @param index The index of the exercise to toggle.
   */
  const handleToggleInclude = (index: number) => {
    const newExercises = [...exercises];
    newExercises[index].included = !newExercises[index].included;
    setExercises(newExercises);
  }

  /** Handles the final save action. */
  const handleSave = () => {
    if (!name.trim()) {
      alert("Please provide a name for the routine.");
      return;
    }
    
    // Filter out the exercises that the user unchecked.
    // Then, map the result to the final `WorkoutRoutine` exercise format,
    // removing the temporary `included` flag.
    const finalExercises = exercises
        .filter(ex => ex.included)
        .map(({ name, sets, reps }) => ({ name, sets, reps }));

    if (finalExercises.length === 0) {
      alert("Please include at least one exercise in the routine.");
      return;
    }
    
    // Construct the new routine object.
    const newRoutine: WorkoutRoutine = {
        id: Date.now().toString(), // Generate a new ID for the routine.
        name,
        exercises: finalExercises
    };

    onSave(newRoutine); // Call the parent callback to save the routine.
    alert(`Routine "${name}" saved!`);
    onClose();
  };

  // --- RENDER ---
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-brand-card rounded-xl border border-brand-border w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-brand-border">
            <h2 className="text-2xl font-bold text-brand-primary">Save Session as Routine</h2>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label htmlFor="routine-name" className="block text-sm font-medium text-brand-muted mb-1">Routine Name</label>
            <input
              id="routine-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Upper Body Power"
              className="w-full bg-brand-dark border border-brand-border rounded-lg p-2"
            />
          </div>
          
          <div className="space-y-2">
             <h3 className="text-lg font-semibold">Select and Edit Exercises</h3>
             <p className="text-sm text-brand-muted">Choose which exercises to include and adjust their sets/reps for the routine.</p>
             {exercises.length === 0 && <p className="text-brand-muted">This session has no exercises to save.</p>}
             {/* Map over the editable exercises and render a row for each. */}
             {exercises.map((ex, index) => (
               <div key={`${ex.name}-${index}`} className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${ex.included ? 'bg-brand-dark' : 'bg-brand-dark/50'}`}>
                 <input
                    type="checkbox"
                    checked={ex.included}
                    onChange={() => handleToggleInclude(index)}
                    className="h-5 w-5 rounded border-gray-300 text-brand-primary focus:ring-brand-primary bg-brand-card"
                 />
                 <span className={`flex-grow font-semibold ${!ex.included && 'text-brand-muted line-through'}`}>{ex.name}</span>
                 {/* The inputs are disabled if the exercise is not included. */}
                 <input type="number" value={ex.sets} onChange={e => handleExerciseChange(index, 'sets', e.target.value)} disabled={!ex.included} className="w-16 bg-brand-card text-center p-1 rounded disabled:bg-brand-dark/30" />
                 <span className={`text-sm ${ex.included ? 'text-brand-muted' : 'text-brand-muted/50'}`}>sets</span>
                 <input type="number" value={ex.reps} onChange={e => handleExerciseChange(index, 'reps', e.target.value)} disabled={!ex.included} className="w-16 bg-brand-card text-center p-1 rounded disabled:bg-brand-dark/30" />
                 <span className={`text-sm ${ex.included ? 'text-brand-muted' : 'text-brand-muted/50'}`}>reps</span>
               </div>
             ))}
          </div>
        </div>
        <div className="p-6 border-t border-brand-border flex justify-end gap-4 mt-auto">
          <button onClick={onClose} className="bg-brand-muted/20 text-brand-light font-bold py-2 px-4 rounded-lg">Cancel</button>
          <button onClick={handleSave} className="bg-brand-primary text-brand-dark font-bold py-2 px-4 rounded-lg">Save Routine</button>
        </div>
      </div>
    </div>
  );
};

export default SaveRoutineFromSessionModal;
