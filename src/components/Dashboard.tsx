import React, { useState, useMemo, useEffect } from 'react';
import type { AppData, WorkoutRoutine } from '../types';
import { WORKOUT_CATEGORIES } from '../constants';
import { useLocalStorage } from '../hooks/useLocalStorage';
// Import charting components from the 'recharts' library.
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { HeartPulse, Dumbbell } from './Icons';

/**
 * Defines the props for the Dashboard component.
 */
interface DashboardProps {
  /** The core application data (sessions, stats, routines) for the current user. */
  appData: AppData;
  /** Callback function to start a new workout session based on a routine. */
  onStartRoutine: (routine: WorkoutRoutine) => void;
}

const ALL_EXERCISES_OPTION = 'All Exercises (Total Volume)';

/**
 * The Dashboard component serves as the main landing page of the application.
 * It provides a high-level overview of the user's activity, including a workout calendar,
 * progress charts, and quick actions like starting the last used routine.
 */
const Dashboard: React.FC<DashboardProps> = ({ appData, onStartRoutine }) => {
  // Destructure appData for easier access.
  const { sessions, healthStats, routines } = appData;
  
  // --- HOOKS & STATE ---
  
  /** The list of all available exercises, including custom ones. Fetched from localStorage. */
  const [workoutList] = useLocalStorage('customWorkouts', WORKOUT_CATEGORIES);
  /** The ID of the last routine the user started. Used for the "Quick Start" card. */
  const [lastRoutineId, setLastRoutineId] = useLocalStorage<string | null>('lastRoutineId', null);
  /** State to track which exercise is currently selected for the progress chart. */
  const [selectedExercise, setSelectedExercise] = useState<string>(ALL_EXERCISES_OPTION);

  // --- DERIVED STATE (useMemo) ---
  // `useMemo` is used extensively here to prevent expensive calculations on every render.

  /**
   * Generates a unique, sorted list of all exercise names available to the user.
   * It combines exercises from the default list, custom user-added exercises, and any
   * exercises found in past sessions that might no longer be in the main list.
   */
  const allExercises = useMemo(() => {
    const uniqueExercises = new Set<string>();
    workoutList.forEach(category => category.exercises.forEach(ex => uniqueExercises.add(ex.name)));
    sessions.forEach(session => session.exercises.forEach(ex => uniqueExercises.add(ex.name)));
    return [ALL_EXERCISES_OPTION, ...Array.from(uniqueExercises).sort()];
  }, [workoutList, sessions]);

  /** Finds the full routine object corresponding to the `lastRoutineId`. */
  const lastRoutine = useMemo(() => {
    return routines.find(r => r.id === lastRoutineId) || (routines.length > 0 ? routines[0] : null);
  }, [routines, lastRoutineId]);

  /**
   * This is a complex memoized calculation that transforms the raw `sessions` data into a format
   * suitable for the `recharts` library. It runs whenever sessions or the selected exercise change.
   */
  const chartData = useMemo(() => {
    if (sessions.length < 1) return [];

    const dataPoints = sessions.map(session => {
      let totalVolume = 0;
      let totalReps = 0;
      let selectedExerciseMaxWeight = 0;
      let selectedExerciseTotalReps = 0;
      let sessionContainsSelectedExercise = false;

      // Iterate through each exercise in the session to aggregate data.
      for (const ex of session.exercises) {
        // Standardize weight to kg for consistent volume calculation.
        const weightInKg = ex.unit === 'lbs' ? ex.weight * 0.453592 : ex.weight;
        const repsForExercise = ex.sets * ex.reps;
        
        // Calculate total volume and reps for the "All Exercises" view.
        totalReps += repsForExercise;
        // Volume is often calculated as sets * reps * weight. Here, bodyweight is considered 0 for volume.
        totalVolume += repsForExercise * (weightInKg > 0 ? weightInKg : 0);
        
        // If tracking a specific exercise, find its stats.
        if (ex.name === selectedExercise) {
          sessionContainsSelectedExercise = true;
          selectedExerciseTotalReps += repsForExercise;
          selectedExerciseMaxWeight = Math.max(selectedExerciseMaxWeight, ex.weight > 0 ? weightInKg : 0);
        }
      }

      // Return a structured data point for this session.
      return {
        date: new Date(session.timestamp).toLocaleDateString('en-CA'), // 'en-CA' format (YYYY-MM-DD) is good for sorting.
        timestamp: new Date(session.timestamp).getTime(),
        totalVolume: Math.round(totalVolume),
        totalReps: totalReps,
        // Use `null` for data points where the selected exercise wasn't performed,
        // so `recharts` can `connectNulls` to draw a broken line.
        weight: sessionContainsSelectedExercise ? selectedExerciseMaxWeight : null,
        repsForExercise: sessionContainsSelectedExercise ? selectedExerciseTotalReps : null,
      };
    });
        
    // Sort the data points by date to ensure the line chart is drawn correctly.
    return dataPoints.sort((a, b) => a.timestamp - b.timestamp);
        
  }, [sessions, selectedExercise]);
  
  /** Creates a `Set` of dates on which workouts were performed for efficient lookup in the calendar. */
  const sessionDays = useMemo(() => new Set(sessions.map(s => new Date(s.timestamp).toLocaleDateString('en-CA'))), [sessions]);

  /** Finds the most recent health stat entry to display in a summary card. */
  const latestHealthStat = useMemo(() => {
    if (healthStats.length === 0) return null;
    return [...healthStats].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  }, [healthStats]);
  
  // --- SIDE EFFECTS (useEffect) ---
  
  /**
   * Ensures that if the `selectedExercise` becomes invalid (e.g., after a data import),
   * it resets to the default "All Exercises" option.
   */
  useEffect(() => {
    if (allExercises.length > 0 && !allExercises.includes(selectedExercise)) {
        setSelectedExercise(allExercises[0]);
    }
  }, [allExercises, selectedExercise]);


  // --- SUB-COMPONENTS ---
  
  /**
   * A self-contained component to render the monthly calendar view.
   */
  const CalendarView = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const month = currentDate.getMonth(), year = currentDate.getFullYear();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // Get the day of the week for the 1st of the month (0=Sun, 1=Mon, etc.)
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    // Create an array of empty cells to offset the start of the month.
    const blanks = Array(firstDayOfMonth).fill(null);
    const days = Array.from({length: daysInMonth}, (_, i) => i + 1);

    return (
        <div className="bg-brand-card p-4 rounded-xl border border-brand-border">
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-1 rounded-full hover:bg-brand-border">&lt;</button>
                <h3 className="text-lg font-semibold text-center">{currentDate.toLocaleString('default', { month: 'long' })} {year}</h3>
                <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-1 rounded-full hover:bg-brand-border">&gt;</button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-brand-muted">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1 mt-2">
                {blanks.map((_, i) => <div key={`blank-${i}`}></div>)}
                {days.map(day => {
                    const dateStr = new Date(year, month, day).toLocaleDateString('en-CA');
                    return (
                        <div key={day} className={`flex items-center justify-center h-8 w-8 rounded-full text-sm ${
                            // Highlight day if a session exists on this date.
                            sessionDays.has(dateStr) ? 'bg-brand-primary text-brand-dark font-bold' : ''
                        } ${
                            // Add a ring around today's date.
                            new Date().toLocaleDateString('en-CA') === dateStr ? 'ring-2 ring-brand-secondary' : ''
                        }`}>
                            {day}
                        </div>
                    );
                })}
            </div>
        </div>
    )
  }

  // --- RENDER ---
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-brand-primary">Dashboard</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column with calendar and quick-action cards. */}
        <div className="lg:col-span-1 space-y-6">
            <CalendarView />
            {/* "Quick Start" card for the last used routine. */}
            {lastRoutine && (
                <div className="bg-brand-card p-4 rounded-xl border border-brand-border">
                    <h3 className="text-lg font-semibold text-brand-light mb-2">Quick Start</h3>
                    <div className="bg-brand-dark p-3 rounded-lg">
                        <p className="text-brand-muted">Last routine</p>
                        <p className="font-bold text-lg text-brand-primary truncate">{lastRoutine.name}</p>
                    </div>
                    <button onClick={() => onStartRoutine(lastRoutine)} className="mt-3 w-full flex items-center justify-center gap-2 bg-brand-secondary text-brand-dark font-bold py-2 px-4 rounded-lg hover:bg-opacity-80">
                        <Dumbbell className="w-5 h-5"/> Start Routine
                    </button>
                </div>
            )}
            {/* "Latest Health Stats" card. */}
            {latestHealthStat && (
                 <div className="bg-brand-card p-4 rounded-xl border border-brand-border">
                    <h3 className="text-lg font-semibold text-brand-light mb-2 flex items-center gap-2">
                        <HeartPulse className="w-5 h-5 text-brand-secondary"/> Latest Health Stats
                    </h3>
                    <div className="space-y-2">
                        {latestHealthStat.bodyweight !== undefined && (
                            <div className="flex justify-between items-baseline"><span className="text-brand-muted">Bodyweight</span><span className="font-bold text-xl">{latestHealthStat.bodyweight} <span className="text-sm">{latestHealthStat.bodyweightUnit}</span></span></div>
                        )}
                        {latestHealthStat.bodyFatPercentage && (
                             <div className="flex justify-between items-baseline"><span className="text-brand-muted">Body Fat</span><span className="font-bold text-xl">{latestHealthStat.bodyFatPercentage} <span className="text-sm">%</span></span></div>
                        )}
                        <p className="text-xs text-brand-muted text-right pt-1">Logged on {new Date(latestHealthStat.timestamp).toLocaleDateString()}</p>
                    </div>
                </div>
            )}
        </div>
        {/* Right column with the main progress chart. */}
        <div className="lg:col-span-2 bg-brand-card p-6 rounded-xl border border-brand-border">
          <h2 className="text-xl font-semibold text-brand-light mb-4">Progress Visualization</h2>
          <div className="mb-4">
            <label htmlFor="exercise-select" className="block text-sm font-medium text-brand-muted">Select Exercise to Track</label>
            <select id="exercise-select" value={selectedExercise} onChange={e => setSelectedExercise(e.target.value)} className="w-full mt-1 bg-brand-dark border border-brand-border rounded-lg p-2">
              {allExercises.length > 0 ? allExercises.map(ex => <option key={ex} value={ex}>{ex}</option>) : <option>No exercises found</option>}
            </select>
          </div>
          {/* Render the chart if there's enough data, otherwise show a message. */}
          {chartData.length > 1 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3A3A3A" />
                <XAxis dataKey="date" stroke="#A3A3A3" fontSize={12} tick={{ fill: '#A3A3A3' }} />
                <YAxis yAxisId="left" stroke="#00C2FF" tick={{ fill: '#00C2FF' }} />
                <YAxis yAxisId="right" orientation="right" stroke="#14F195" tick={{ fill: '#14F195' }}/>
                <Tooltip contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #3A3A3A' }} labelStyle={{ color: '#F5F5F5' }} />
                <Legend wrapperStyle={{ color: '#F5F5F5' }} />
                {/* Conditionally render lines based on whether "All Exercises" is selected. */}
                {selectedExercise === ALL_EXERCISES_OPTION ? (
                    <>
                        <Line yAxisId="left" type="monotone" dataKey="totalVolume" stroke="#00C2FF" strokeWidth={2} name="Total Volume (kg)" dot={false} />
                        <Line yAxisId="right" type="monotone" dataKey="totalReps" stroke="#14F195" strokeWidth={2} name="Total Reps" dot={false} />
                    </>
                ) : (
                    <>
                        <Line yAxisId="left" type="monotone" dataKey="weight" stroke="#00C2FF" strokeWidth={2} name="Max Weight (kg)" connectNulls dot={false} />
                        <Line yAxisId="right" type="monotone" dataKey="repsForExercise" stroke="#14F195" strokeWidth={2} name="Reps for Exercise" connectNulls dot={false} />
                    </>
                )}
              </LineChart>
            </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-80 flex items-center justify-center text-brand-muted text-center p-4">
              <p>
                {sessions.length < 2 
                    ? `Log workouts on at least two different days to see a progress chart.`
                    : `Not enough data for "${selectedExercise}". Try selecting another exercise or logging more workouts.`
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;