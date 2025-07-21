import type { WorkoutCategory, DefaultSettings } from './types';

/**
 * This file exports constant data used throughout the application.
 * Keeping constants in a separate file makes them easy to manage, reuse,
 * and modify without changing component logic.
 */

/**
 * Defines the default settings for a new user or a user who hasn't
 * configured their own settings yet. This ensures a consistent starting
 * experience.
 */
export const DEFAULT_SETTINGS: DefaultSettings = {
    defaultWorkout: "Push-ups",
    defaultReps: 10,
    defaultWeight: 0,
    defaultUnit: 'kg',
    sessionTimeout: 60, // in minutes
};

/**
 * A structured list of pre-defined workout exercises, grouped by category.
 * This data is used to populate the exercise selection dropdowns in the
 * Workout Logger and Routine Editor, providing users with a comprehensive
 * list of common exercises to choose from.
 */
export const WORKOUT_CATEGORIES: WorkoutCategory[] = [
  {
    category: "Strength Training",
    exercises: [
        { name: "Push-ups", description: "Classic upper body exercise targeting chest, shoulders, and triceps.", type: "bodyweight" },
        { name: "Pull-ups", description: "Challenging back and bicep exercise using an overhand grip.", type: "bodyweight" },
        { name: "Chin-ups", description: "Similar to pull-ups but with an underhand grip, emphasizing biceps.", type: "bodyweight" },
        { name: "Sit-ups", description: "Core exercise focusing on abdominal muscles and hip flexors.", type: "bodyweight" },
        { name: "Crunches", description: "Abdominal exercise that isolates the rectus abdominis.", type: "bodyweight" },
        { name: "Planks", description: "Isometric core strength exercise that involves maintaining a push-up like position.", type: "bodyweight" },
        { name: "Squats", description: "Fundamental lower body exercise for quads, hamstrings, and glutes.", type: "bodyweight" },
        { name: "Lunges", description: "Unilateral leg exercise that targets quads, glutes, and hamstrings.", type: "bodyweight" },
        { name: "Dips", description: "Targets triceps and chest, typically using parallel bars or a bench.", type: "bodyweight" },
        { name: "Bench Press", description: "Compound upper-body lift for chest, shoulders, and triceps using a barbell.", type: "weighted" },
        { name: "Overhead Press", description: "Shoulder exercise, lifting a weight overhead. Also called Military Press.", type: "weighted" },
        { name: "Deadlift", description: "Full-body compound lift that targets the posterior chain.", type: "weighted" },
        { name: "Back Squat", description: "Squat variation with the barbell resting on the upper back.", type: "weighted" },
        { name: "Front Squat", description: "Squat variation with the barbell held in front of the shoulders.", type: "weighted" },
        { name: "Bicep Curls", description: "Isolation exercise for the bicep muscles.", type: "weighted" },
        { name: "Tricep Extensions", description: "Isolation exercise for the triceps, can be done overhead or lying down.", type: "weighted" },
        { name: "Bent-over Rows", description: "Back exercise that targets the lats, rhomboids, and traps.", type: "weighted" },
    ]
  },
  {
    category: "Cardiovascular (Cardio)",
    exercises: [
        { name: "Running (Treadmill)", description: "Cardiovascular exercise that improves heart health and endurance on a treadmill.", type: "bodyweight" },
        { name: "Running (Outdoor)", description: "Cardiovascular exercise that improves heart health and endurance outdoors.", type: "bodyweight" },
        { name: "Cycling (Stationary)", description: "Low-impact cardio on a stationary bike that strengthens legs.", type: "bodyweight" },
        { name: "Cycling (Outdoor)", description: "Low-impact cardio outdoors that strengthens legs and improves cardiovascular fitness.", type: "bodyweight" },
        { name: "Swimming", description: "Full-body, low-impact workout that improves cardiovascular health and muscle strength.", type: "bodyweight" },
        { name: "Rowing", description: "Full-body cardio workout that engages legs, core, and upper body.", type: "bodyweight" },
        { name: "Elliptical Trainer", description: "Low-impact cardio machine that simulates stair climbing, walking, or running.", type: "bodyweight" },
        { name: "Stair Climber", description: "Machine that simulates climbing stairs for an intense cardio and leg workout.", type: "bodyweight" },
    ]
  },
  {
    category: "Flexibility & Mobility",
    exercises: [
        { name: "Yoga", description: "A practice of physical postures, breathing techniques, and meditation for flexibility and mindfulness.", type: "bodyweight" },
        { name: "Pilates", description: "Low-impact exercise method focused on core strength, posture, and flexibility.", type: "bodyweight" },
        { name: "Stretching (Static)", description: "Holding a stretch for a period of time to increase flexibility.", type: "bodyweight" },
        { name: "Stretching (Dynamic)", description: "Active movements that take your body through a range of motion to warm up.", type: "bodyweight" },
    ]
  },
  {
    category: "High-Intensity & Functional Fitness",
    exercises: [
        { name: "High-Intensity Interval Training (HIIT)", description: "Involves short bursts of intense exercise alternated with low-intensity recovery periods.", type: "bodyweight" },
        { name: "CrossFit", description: "High-intensity fitness program incorporating elements from several sports and types of exercise.", type: "bodyweight" },
        { name: "Barre", description: "Hybrid workout combining ballet-inspired moves with elements of Pilates, dance, yoga, and strength training.", type: "bodyweight" },
        { name: "Circuit Training", description: "A form of body conditioning involving endurance training, resistance training, or high-intensity aerobics.", type: "bodyweight" },
    ]
  }
];

/**
 * A simple list of common equipment types.
 * This is used to populate the equipment dropdown in the Workout Logger and
 * the equipment selection in the AI Planner.
 */
export const EQUIPMENT_LIST: string[] = [
  "Bodyweight", "Ab Roller", "Dumbbells", "Barbell", "Kettlebells", "Resistance Bands",
  "Cable Machine", "Treadmill", "Stationary Bike", "Elliptical", "Rowing Machine", "Other"
];