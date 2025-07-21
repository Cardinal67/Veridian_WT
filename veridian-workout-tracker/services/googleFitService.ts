
// @ts-nocheck
// Note: Using @ts-nocheck because the Google API scripts are loaded globally.
// This service handles all interactions with the Google Fit API.

import type { WorkoutSession, HealthStat } from '../types';
import { gapiCallWrapper } from './googleDriveService';

// The base URL for all Google Fit API requests for the currently authenticated user.
const FITNESS_API_URL = 'https://www.googleapis.com/fitness/v1/users/me';

/**
 * A helper function to convert a JavaScript timestamp (in milliseconds)
 * to nanoseconds, which is required by the Google Fit API.
 * @param ms The timestamp in milliseconds.
 * @returns The timestamp in nanoseconds.
 */
const toNano = (ms: number) => ms * 1_000_000;

/**
 * Saves a health stat entry (currently only body weight) to Google Fit.
 * This is a "fire-and-forget" operation; if it fails, it will log a warning
 * to the console but will not interrupt the user's experience.
 * @param stat The HealthStat object to save.
 */
export const saveHealthStatToFit = async (stat: HealthStat) => {
    try {
        // Use the gapiCallWrapper to ensure the user is signed in and GAPI is ready.
        // The entire logic is wrapped here.
        await gapiCallWrapper(async () => {
            // Currently, this function only syncs body weight.
            // Support for other stats can be added by creating similar data sources and points.
            if (stat.bodyweight === undefined || stat.bodyweight === null) return;
            
            // Standardize weight to kilograms, as it's the standard unit for Google Fit's `com.google.weight` data type.
            const weightInKg = stat.bodyweightUnit === 'lbs' ? stat.bodyweight * 0.453592 : stat.bodyweight;
            const timestampNanos = toNano(new Date(stat.timestamp).getTime());

            // Define a unique data source ID for our application. This helps identify the source of the data within Google Fit.
            // The format is typically 'raw:data_type:app_identifier'.
            const dataSourceId = 'raw:com.google.weight:com.veridian-workout-tracker.app';
            // A dataset ID must uniquely identify the time range of the data points.
            // For a single point in time, the start and end times are the same.
            const datasetId = `${timestampNanos}-${timestampNanos}`;

            // Make a PATCH request to the data source's dataset.
            // PATCH is used to "upsert" (update or insert) data for the given time range.
            await window.gapi.client.request({
                path: `${FITNESS_API_URL}/dataSources/${dataSourceId}/datasets/${datasetId}`,
                method: 'PATCH',
                params: { dataSourceId, datasetId },
                body: {
                    minStartTimeNs: timestampNanos,
                    maxEndTimeNs: timestampNanos,
                    dataSourceId: dataSourceId,
                    point: [{
                        startTimeNanos: timestampNanos,
                        endTimeNanos: timestampNanos,
                        dataTypeName: "com.google.weight", // The specific data type for body weight.
                        value: [{ fpVal: weightInKg }] // `fpVal` stands for floating-point value.
                    }]
                }
            });
            console.log('Weight data synced to Google Fit.');
        });
    } catch (error) {
        // If the gapiCallWrapper throws an error (e.g., user not signed in), catch it here.
        console.warn(`Could not sync health stat to Google Fit: ${error.message}`);
    }
};

/**
 * Saves a completed workout session to Google Fit.
 * This is also a "fire-and-forget" operation.
 * @param session The WorkoutSession object to save.
 */
export const saveWorkoutSessionToFit = async (session: WorkoutSession) => {
    try {
        await gapiCallWrapper(async () => {
            // A session must have a duration to be logged in Google Fit.
            if (!session.durationMinutes || session.durationMinutes <= 0) {
                console.log("Session has no duration, skipping Google Fit sync.");
                return;
            }

            const startTime = new Date(session.timestamp);
            const endTime = new Date(startTime.getTime() + session.durationMinutes * 60 * 1000);
            
            // The activity type for 'Strength training' in the Google Fit API is 75.
            // A full list of activity types is available in the Google Fit documentation.
            const activityType = 75; 
            // Create a unique ID for this session to allow for future updates if needed.
            const sessionId = `veridian-workout-tracker-session:${startTime.getTime()}`;
            
            // Make a PUT request to the sessions endpoint.
            // PUT is used to create or fully replace a session with the given ID.
            await window.gapi.client.request({
                path: `${FITNESS_API_URL}/sessions/${sessionId}`,
                method: 'PUT',
                body: {
                    id: sessionId,
                    name: session.name || 'Workout',
                    description: session.notes || `Completed ${session.exercises.length} exercises. Equipment: ${session.equipment}.`,
                    startTimeMillis: startTime.getTime(),
                    endTimeMillis: endTime.getTime(),
                    application: {
                        name: "Veridian Workout Tracker", // Identifies our app as the source of the session.
                    },
                    activityType: activityType,
                }
            });
            console.log('Workout session synced to Google Fit.');
        });
    } catch (error) {
        console.warn(`Could not sync workout session to Google Fit: ${error.message}`);
    }
};
