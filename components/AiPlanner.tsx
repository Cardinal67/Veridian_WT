
import React, { useState } from 'react';
import { generateWorkoutPlan } from '../services/geminiService';
import { EQUIPMENT_LIST } from '../constants';
import { Bot } from './Icons';

// --- Type Definitions ---
type Goal = "Build Muscle" | "Lose Weight" | "Improve Endurance";
type Experience = "Beginner" | "Intermediate" | "Advanced";

/**
 * Defines the structure of the workout plan returned by the AI.
 * This should match the JSON schema defined in the geminiService.
 */
interface GeneratedPlan {
    day: string;
    focus: string;
    exercises: {
        name: string;
        sets: number;
        reps: string;
    }[];
}

// --- API Key Check ---
/**
 * A boolean constant that checks if the Gemini API key has been set in the environment.
 * This prevents the component from making API calls that are guaranteed to fail and
 * allows for a helpful message to be shown to the user.
 * It checks that the key exists and is not the placeholder value.
 */
const isApiKeySet = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE';

/**
 * The AiPlanner component provides an interface for users to generate a custom workout plan
 * using the Google Gemini AI. It collects user preferences and sends them to the AI service.
 */
const AiPlanner: React.FC = () => {
    // --- STATE MANAGEMENT ---

    // State for the form inputs, defining the user's request.
    const [goal, setGoal] = useState<Goal>("Build Muscle");
    const [experience, setExperience] = useState<Experience>("Beginner");
    const [days, setDays] = useState<number>(3);
    const [equipment, setEquipment] = useState<string[]>(['Bodyweight']);

    // State for the component's lifecycle: loading, error, and success (the plan itself).
    const [plan, setPlan] = useState<GeneratedPlan[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // --- EVENT HANDLERS ---

    /**
     * Toggles the selection of an equipment item.
     * If the item is already in the `equipment` array, it's removed. Otherwise, it's added.
     * @param item The equipment string to toggle.
     */
    const handleEquipmentChange = (item: string) => {
        setEquipment(prev =>
            prev.includes(item) ? prev.filter(e => e !== item) : [...prev, item]
        );
    };

    /**
     * Handles the form submission to generate a workout plan.
     * It sets the loading state, calls the AI service, and handles the response.
     */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); // Prevent the default form submission behavior (page reload).
        
        // Reset state for a new request.
        setIsLoading(true);
        setError(null);
        setPlan(null);

        try {
            // Call the service function to interact with the Gemini API.
            const generatedPlan = await generateWorkoutPlan({ goal, experience, days, equipment });
            setPlan(generatedPlan); // On success, store the returned plan.
        } catch (err) {
            // On failure, store the error message to display to the user.
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
            console.error(err);
        } finally {
            // Always set loading to false when the process is complete (either success or failure).
            setIsLoading(false);
        }
    };

    // --- RENDER ---
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-brand-primary flex items-center gap-3">
                <Bot className="w-8 h-8"/>
                <span>AI Workout Planner</span>
            </h1>

            {/* Conditionally render a warning message if the API key is not configured. */}
            {!isApiKeySet && (
                <div className="bg-yellow-500/10 border border-yellow-500 text-yellow-400 p-4 rounded-lg">
                    <p className="font-bold">AI Planner is not configured.</p>
                    <p className="text-sm">A Gemini API Key is required to use this feature. Please add your key to the <code>index.html</code> file to enable the AI Planner.</p>
                </div>
            )}

            {/* The main form for user input. */}
            <form onSubmit={handleSubmit} className="bg-brand-card p-6 rounded-xl border border-brand-border space-y-6">
                {/* The `fieldset` is disabled if the API key isn't set or if a request is in progress. */}
                <fieldset disabled={!isApiKeySet || isLoading} className="contents">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-brand-muted mb-1">Primary Goal</label>
                            <select value={goal} onChange={e => setGoal(e.target.value as Goal)} className="w-full bg-brand-dark border border-brand-border rounded-lg p-2 disabled:opacity-50">
                                <option>Build Muscle</option>
                                <option>Lose Weight</option>
                                <option>Improve Endurance</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-brand-muted mb-1">Experience Level</label>
                            <select value={experience} onChange={e => setExperience(e.target.value as Experience)} className="w-full bg-brand-dark border border-brand-border rounded-lg p-2 disabled:opacity-50">
                                <option>Beginner</option>
                                <option>Intermediate</option>
                                <option>Advanced</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-brand-muted mb-1">Days per Week</label>
                            <input type="number" value={days} onChange={e => setDays(parseInt(e.target.value))} min="1" max="7" className="w-full bg-brand-dark border border-brand-border rounded-lg p-2 disabled:opacity-50" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-muted mb-2">Available Equipment</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                            {/* Render a button for each equipment type. */}
                            {EQUIPMENT_LIST.map(item => (
                                <button
                                  type="button"
                                  key={item}
                                  onClick={() => handleEquipmentChange(item)}
                                  // Dynamically style the button based on whether it's selected.
                                  className={`p-2 text-sm rounded-lg border transition-colors disabled:opacity-50 ${equipment.includes(item) ? 'bg-brand-primary text-brand-dark border-brand-primary' : 'bg-brand-dark border-brand-border hover:border-brand-muted'}`}
                                >
                                    {item}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button type="submit" disabled={isLoading || !isApiKeySet} className="w-full bg-brand-secondary text-brand-dark font-bold py-3 px-4 rounded-lg hover:bg-opacity-80 disabled:bg-brand-muted disabled:cursor-not-allowed flex items-center justify-center gap-2">
                        {/* Conditionally render loading spinner and text. */}
                        {isLoading ? (
                            <>
                               <div className="w-5 h-5 border-2 border-brand-dark border-t-transparent rounded-full animate-spin"></div>
                               <span>Generating Plan...</span>
                            </>
                        ) : 'Generate My Plan'}
                    </button>
                </fieldset>
            </form>

            {/* Conditionally render an error message if the API call failed. */}
            {error && (
                <div className="bg-red-500/10 border border-red-500 text-red-400 p-4 rounded-lg">
                    <p className="font-bold">Error Generating Plan</p>
                    <p className="text-sm">{error}</p>
                </div>
            )}

            {/* Conditionally render the generated plan if the API call was successful. */}
            {plan && (
                <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-brand-light">Your Custom Workout Plan</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Map over each day in the plan and render a card for it. */}
                        {plan.map(dayPlan => (
                            <div key={dayPlan.day} className="bg-brand-card p-4 rounded-xl border border-brand-border flex flex-col">
                                <h3 className="text-xl font-semibold text-brand-primary">{dayPlan.day}</h3>
                                <p className="text-brand-muted mb-4">{dayPlan.focus}</p>
                                <ul className="space-y-3 flex-grow">
                                    {/* Map over the exercises for the day and render a list item for each. */}
                                    {dayPlan.exercises.map(ex => (
                                        <li key={ex.name} className="bg-brand-dark p-3 rounded-md">
                                            <p className="font-semibold text-brand-light">{ex.name}</p>
                                            <p className="text-sm text-brand-muted">{ex.sets} sets of {ex.reps} reps</p>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AiPlanner;
