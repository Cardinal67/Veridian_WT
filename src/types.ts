/**
 * This file contains all the core TypeScript type definitions and interfaces
 * used across the application. Centralizing them here ensures consistency
 * and provides a single source of truth for the application's data structures.
 */

/**
 * Represents a single exercise logged by the user, including details
 * like sets, reps, and weight.
 */
export interface Exercise {
  id: string;         // A unique identifier for this specific exercise instance.
  name: string;       // The name of the exercise (e.g., "Push-ups", "Bench Press").
  sets: number;       // The number of sets performed.
  reps: number;       // The number of repetitions per set.
  weight: number;     // The weight used for the exercise. Can be 0 for bodyweight exercises.
  unit: 'kg' | 'lbs'; // The unit for the weight.
}

/**
 * Represents a complete workout session, which is a collection of exercises
 * performed on a specific date.
 */
export interface WorkoutSession {
  id: string;                // A unique identifier for the session (often a timestamp).
  timestamp: string;         // An ISO 8601 string representing when the session started.
  name?: string;             // An optional, user-defined name for the session (e.g., "Morning Run").
  warmup: boolean;           // Whether the user performed a warmup.
  equipment: string;         // The primary equipment used during the session.
  notes: string;             // User's notes about the session (e.g., "Felt strong today").
  exercises: Exercise[];     // An array of all exercises performed during the session.
  durationMinutes?: number;  // The total duration of the workout in minutes.
}

/**
 * Represents a reusable workout routine template. It defines the exercises,
 * sets, and reps, but not the specific weight, which can be filled in when
 * the routine is performed.
 */
export interface WorkoutRoutine {
  id: string;        // A unique identifier for the routine.
  name: string;      // The name of the routine (e.g., "Upper Body Strength").
  // The exercises in the routine. It omits fields that are specific to a single performance.
  exercises: Omit<Exercise, 'id' | 'weight' | 'unit'>[];
}

/**
 * Represents a single entry of health-related statistics logged by the user.
 * All properties are optional, allowing the user to log only what they want.
 */
export interface HealthStat {
  id:string;                  // A unique identifier for this log entry.
  timestamp: string;         // An ISO 8601 string for when the stats were logged.
  bodyweight?: number;        // User's body weight.
  bodyweightUnit?: 'kg' | 'lbs'; // The unit for the body weight.
  bodyFatPercentage?: number; // User's body fat percentage.
  sleepHours?: number;        // Hours of sleep.
  waterIntakeLiters?: number; // Water intake in liters.
  restingHeartRate?: number;  // Resting heart rate in beats per minute (bpm).
}

/**
 * A top-level interface that encapsulates all of the user's primary data.
 * This is the structure that gets saved to localStorage for offline profiles
 * and to Google Drive for cloud-synced users.
 */
export interface AppData {
    sessions: WorkoutSession[];
    healthStats: HealthStat[];
    routines: WorkoutRoutine[];
}

/**
 * Defines the structure for a category of workouts, used for populating
 * the exercise selection dropdowns.
 */
export interface WorkoutCategory {
  category: string; // The name of the category (e.g., "Strength Training", "Cardio").
  exercises: {
    name: string;        // The name of the exercise.
    description: string; // A brief description of the exercise.
    type: 'bodyweight' | 'weighted'; // Whether the exercise is typically bodyweight or requires weights.
  }[];
}

/**
 * Defines the user's customizable default settings, used to pre-fill
 * forms in the WorkoutLogger.
 */
export interface DefaultSettings {
  defaultWorkout: string;   // The exercise name to be selected by default.
  defaultReps: number;      // The default number of reps.
  defaultWeight: number;    // The default weight.
  defaultUnit: 'kg' | 'lbs';// The default weight unit.
  sessionTimeout: number;   // The auto-save timeout for active sessions, in minutes.
}

/**
 * Represents a complete user profile for offline storage.
 * It includes their credentials, all their application data, and their settings.
 */
export interface UserProfile {
  id: string;               // A unique identifier for the profile.
  name: string;             // The user's chosen username.
  passwordHash: string;     // The hashed password for authentication.
  securityCodeHash?: string;// The hashed security code for password recovery.
  appData: AppData;         // All the user's workout and health data.
  settings: DefaultSettings;// The user's personal settings.
}