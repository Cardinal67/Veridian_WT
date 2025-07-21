
import React, { useState, useMemo } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { HealthStat, DefaultSettings } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { HeartPulse, Trash2 } from './Icons';
import { DEFAULT_SETTINGS } from '../constants';

/**
 * Defines the props for the HealthTracker component.
 */
interface HealthTrackerProps {
    /** An array of all health stat entries for the current user. */
    healthStats: HealthStat[];
    /** Callback function to add a new health stat entry. */
    onAddStat: (stat: Omit<HealthStat, 'id' | 'timestamp'>) => void;
    /** Callback function to delete a health stat entry by its ID. */
    onDeleteStat: (id: string) => void;
}

/**
 * The HealthTracker component allows users to log and view various health metrics
 * like bodyweight, body fat percentage, sleep, and more. It includes a form for new entries,
 * a historical list of past entries, and a chart to visualize trends over time.
 */
const HealthTracker: React.FC<HealthTrackerProps> = ({ healthStats, onAddStat, onDeleteStat }) => {
    // --- HOOKS & STATE ---
    
    /** Fetches the user's default settings, used here for the default weight unit. */
    const [settings] = useLocalStorage<DefaultSettings>('workoutSettings', DEFAULT_SETTINGS);
    
    // State for each input field in the "Log Today's Stats" form.
    // Using `''` for empty state allows the placeholder to show.
    const [bodyweight, setBodyweight] = useState<number | ''>('');
    const [bodyFat, setBodyFat] = useState<number | ''>('');
    const [unit, setUnit] = useState<'kg' | 'lbs'>(settings.defaultUnit);
    const [sleepHours, setSleepHours] = useState<number | ''>('');
    const [waterIntake, setWaterIntake] = useState<number | ''>('');
    const [rhr, setRhr] = useState<number | ''>('');
    
    // --- DERIVED STATE (useMemo) ---
    
    /**
     * A memoized, sorted list of health stats, with the most recent entries first.
     * This is used for rendering the history list.
     */
    const sortedStats = useMemo(() => 
        [...healthStats].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()), 
    [healthStats]);

    /**
     * Memoized calculation to transform the raw `healthStats` data into a format
     * suitable for the `recharts` library. It also standardizes bodyweight to kg for
     * consistent charting.
     */
    const chartData = useMemo(() => {
        if (healthStats.length === 0) return [];
        return [...healthStats]
          .map(stat => ({
            date: new Date(stat.timestamp).toLocaleDateString('en-CA'),
            // Standardize bodyweight to kg for the chart's Y-axis.
            bodyweight: stat.bodyweight !== undefined ? (stat.bodyweightUnit === 'lbs' ? stat.bodyweight * 0.453592 : stat.bodyweight) : undefined,
            bodyFat: stat.bodyFatPercentage,
            restingHeartRate: stat.restingHeartRate,
            sleepHours: stat.sleepHours,
            waterIntakeLiters: stat.waterIntakeLiters,
            timestamp: new Date(stat.timestamp).getTime(),
          }))
          .sort((a, b) => a.timestamp - b.timestamp); // Sort chronologically for the line chart.
      }, [healthStats]);

    // --- EVENT HANDLERS ---
    
    /** Handles the submission of the new health stat form. */
    const handleAddStat = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validate that at least one field has been filled out.
        const isBodyweightValid = bodyweight !== '' && bodyweight > 0;
        const isBodyFatValid = bodyFat !== '' && bodyFat >= 0;
        const isSleepValid = sleepHours !== '' && sleepHours >= 0;
        const isWaterValid = waterIntake !== '' && waterIntake >= 0;
        const isRhrValid = rhr !== '' && rhr >= 0;

        if (!isBodyweightValid && !isBodyFatValid && !isSleepValid && !isWaterValid && !isRhrValid) {
            alert("Please enter at least one health stat to log an entry.");
            return;
        }

        // Call the parent `onAddStat` callback with the new data.
        // Use `undefined` for empty fields so they aren't stored in the data object.
        onAddStat({
            bodyweight: isBodyweightValid ? bodyweight : undefined,
            bodyweightUnit: isBodyweightValid ? unit : undefined,
            bodyFatPercentage: isBodyFatValid ? bodyFat : undefined,
            sleepHours: isSleepValid ? sleepHours : undefined,
            waterIntakeLiters: isWaterValid ? waterIntake : undefined,
            restingHeartRate: isRhrValid ? rhr : undefined,
        });

        // Reset all form fields after successful submission.
        setBodyweight('');
        setBodyFat('');
        setSleepHours('');
        setWaterIntake('');
        setRhr('');
    };

    /** A simple wrapper for the delete callback. */
    const handleDeleteStat = (id: string) => {
        onDeleteStat(id);
    }
    
    /** A helper function for the quick-add water buttons. */
    const handleAddWater = (litersToAdd: number) => {
        setWaterIntake(prev => {
            const current = Number(prev) || 0;
            // Use `toFixed` to handle floating point inaccuracies.
            return parseFloat((current + litersToAdd).toFixed(3));
        });
    };

    /** A constant array for rendering the quick-add water buttons. */
    const waterButtons = [
        { label: '+8 oz', value: 0.237 },
        { label: '+16 oz', value: 0.473 },
        { label: '+500 mL', value: 0.5 },
        { label: '+1 L', value: 1.0 },
    ];

    // --- RENDER ---
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-brand-primary flex items-center gap-3">
                <HeartPulse className="w-8 h-8"/>
                <span>Health Statistics</span>
            </h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left column: Form for adding new stats and the history list. */}
                <div className="lg:col-span-1 space-y-6">
                    <form onSubmit={handleAddStat} className="bg-brand-card p-6 rounded-xl border border-brand-border space-y-4">
                        <h2 className="text-xl font-semibold">Log Today's Stats</h2>
                        <div>
                            <label htmlFor="bodyweight" className="block text-sm font-medium text-brand-muted">Bodyweight</label>
                            <div className="flex mt-1">
                                <input type="number" id="bodyweight" value={bodyweight} onChange={e => setBodyweight(e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder="e.g., 70.5" step="0.1" className="w-full bg-brand-dark border-brand-border rounded-l-lg p-2 border" />
                                <button type="button" onClick={() => setUnit(unit === 'kg' ? 'lbs' : 'kg')} className="bg-brand-secondary text-brand-dark font-semibold px-4 rounded-r-lg">{unit}</button>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="bodyfat" className="block text-sm font-medium text-brand-muted">Body Fat % (Optional)</label>
                            <div className="flex mt-1">
                                <input type="number" id="bodyfat" value={bodyFat} onChange={e => setBodyFat(e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder="e.g., 15.2" step="0.1" className="w-full bg-brand-dark border-brand-border rounded-l-lg p-2 border" />
                                <span className="bg-brand-dark border-brand-border border rounded-r-lg p-2 text-brand-muted">%</span>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="rhr" className="block text-sm font-medium text-brand-muted">Resting Heart Rate (Optional)</label>
                            <div className="flex mt-1">
                                <input type="number" id="rhr" value={rhr} onChange={e => setRhr(e.target.value === '' ? '' : parseInt(e.target.value))} placeholder="e.g., 60" className="w-full bg-brand-dark border-brand-border rounded-l-lg p-2 border" />
                                <span className="bg-brand-dark border-brand-border border rounded-r-lg p-2 text-brand-muted">bpm</span>
                            </div>
                        </div>
                         <div>
                            <label htmlFor="sleep" className="block text-sm font-medium text-brand-muted">Sleep (Optional)</label>
                            <div className="flex mt-1">
                                <input type="number" id="sleep" value={sleepHours} onChange={e => setSleepHours(e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder="e.g., 7.5" step="0.5" className="w-full bg-brand-dark border-brand-border rounded-l-lg p-2 border" />
                                <span className="bg-brand-dark border-brand-border border rounded-r-lg p-2 text-brand-muted">hours</span>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="water" className="block text-sm font-medium text-brand-muted">Water Intake (Optional)</label>
                            <div className="flex mt-1">
                                <input type="number" id="water" value={waterIntake} onChange={e => setWaterIntake(e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder="e.g., 3.5" step="0.1" className="w-full bg-brand-dark border-brand-border rounded-l-lg p-2 border" />
                                <span className="bg-brand-dark border-brand-border border rounded-r-lg p-2 text-brand-muted">liters</span>
                            </div>
                             <div className="flex flex-wrap gap-2 mt-2">
                                {waterButtons.map(btn => (
                                    <button type="button" key={btn.label} onClick={() => handleAddWater(btn.value)} className="text-xs bg-brand-dark border border-brand-border rounded-md px-2 py-1 hover:bg-brand-border">
                                        {btn.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <button type="submit" className="w-full bg-brand-primary text-brand-dark font-bold py-3 px-4 rounded-lg hover:bg-opacity-80 transition-transform transform hover:scale-105">
                            Add Entry
                        </button>
                    </form>
                    
                    <div className="bg-brand-card p-6 rounded-xl border border-brand-border">
                        <h2 className="text-xl font-semibold mb-4">History</h2>
                        <div className="max-h-96 overflow-y-auto space-y-3 pr-2">
                            {sortedStats.length > 0 ? sortedStats.map(stat => (
                                <div key={stat.id} className="flex justify-between items-center bg-brand-dark p-3 rounded-lg">
                                    <div>
                                        <p className="font-semibold text-brand-light">{new Date(stat.timestamp).toLocaleDateString()}</p>
                                        <ul className="text-xs text-brand-muted list-disc list-inside pl-1">
                                            {/* Conditionally render each stat type only if it exists in the entry. */}
                                            {stat.bodyweight !== undefined && <li>{stat.bodyweight} {stat.bodyweightUnit} Weight</li>}
                                            {stat.bodyFatPercentage !== undefined && <li>{stat.bodyFatPercentage}% Body Fat</li>}
                                            {stat.restingHeartRate !== undefined && <li>{stat.restingHeartRate} bpm RHR</li>}
                                            {stat.sleepHours !== undefined && <li>{stat.sleepHours}h Sleep</li>}
                                            {stat.waterIntakeLiters !== undefined && <li>{stat.waterIntakeLiters}L Water</li>}
                                        </ul>
                                    </div>
                                    <button onClick={() => handleDeleteStat(stat.id)} className="text-red-500 hover:text-red-400 p-2 rounded-full hover:bg-red-500/10 transition-colors">
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            )) : <p className="text-brand-muted text-center py-4">No health stats logged yet.</p>}
                        </div>
                    </div>
                </div>

                {/* Right column: The progress chart. */}
                <div className="lg:col-span-2 bg-brand-card p-6 rounded-xl border border-brand-border">
                    <h2 className="text-xl font-semibold mb-4">Progress Chart</h2>
                    {chartData.length > 1 ? (
                         <div className="h-[30rem]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#3A3A3A" />
                                    <XAxis dataKey="date" stroke="#A3A3A3" fontSize={12} tick={{ fill: '#A3A3A3' }} />
                                    <YAxis yAxisId="left" dataKey="bodyweight" stroke="#00C2FF" tick={{ fill: '#00C2FF' }} unit="kg" domain={['dataMin - 2', 'dataMax + 2']} width={40} />
                                    <YAxis yAxisId="right" orientation="right" stroke="#A3A3A3" tick={{ fill: '#A3A3A3' }} width={40}/>
                                    <Tooltip contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #3A3A3A' }} labelStyle={{ color: '#F5F5F5' }} />
                                    <Legend />
                                    {/* Each line is associated with a Y-axis and has a unique color. `connectNulls` ensures the line continues over missing data points. */}
                                    <Line yAxisId="left" type="monotone" dataKey="bodyweight" stroke="#00C2FF" strokeWidth={2} name="Bodyweight (kg)" dot={false} connectNulls />
                                    <Line yAxisId="right" type="monotone" dataKey="bodyFat" stroke="#14F195" strokeWidth={2} name="Body Fat (%)" connectNulls dot={false} />
                                    <Line yAxisId="right" type="monotone" dataKey="restingHeartRate" stroke="#f97316" strokeWidth={2} name="Resting HR (bpm)" connectNulls dot={false} />
                                    <Line yAxisId="right" type="monotone" dataKey="sleepHours" stroke="#ec4899" strokeWidth={2} name="Sleep (hours)" connectNulls dot={false} />
                                    <Line yAxisId="right" type="monotone" dataKey="waterIntakeLiters" stroke="#a855f7" strokeWidth={2} name="Water (L)" connectNulls dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-96 flex items-center justify-center text-brand-muted">
                            <p>Log at least two entries to see a progress chart.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default HealthTracker;
