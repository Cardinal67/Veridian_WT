import { GoogleGenAI, Type } from "@google/genai";

/**
 * Defines the structure of the request object sent to the `generateWorkoutPlan` function.
 */
interface PlanRequest {
  goal: string;
  experience: string;
  days: number;
  equipment: string[];
}

/**
 * Defines the expected JSON schema for the response from the Gemini API.
 * This is a powerful feature that instructs the model to return its output
 * in a structured JSON format, which is much easier and more reliable to parse

 * than plain text. The schema is defined using OpenAPI standards.
 */
const planSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            day: { type: Type.STRING, description: "Day of the week for the workout (e.g., Monday, Day 1)." },
            focus: { type: Type.STRING, description: "The main focus of the day's workout (e.g., Upper Body, Legs, Full Body)." },
            exercises: {
                type: Type.ARRAY,
                description: "List of exercises for the day.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING, description: "Name of the exercise." },
                        sets: { type: Type.INTEGER, description: "Number of sets." },
                        reps: { type: Type.STRING, description: "Recommended repetition range (e.g., '8-12', '15-20')." },
                    },
                    required: ["name", "sets", "reps"],
                },
            },
        },
        required: ["day", "focus", "exercises"],
    },
};

/**
 * Calls the Google Gemini API to generate a personalized workout plan.
 * @param {PlanRequest} request - An object containing the user's preferences.
 * @returns A promise that resolves to the parsed JSON workout plan.
 * @throws An error if the API key is not configured or if the API call fails.
 */
export const generateWorkoutPlan = async (request: PlanRequest) => {
    // 1. API Key Validation
    // Retrieve the API key from Vite's environment variables.
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
        throw new Error("Gemini API key is not configured. Please add it to your environment variables (VITE_GEMINI_API_KEY) to use AI features.");
    }
    
    // 2. Initialize the Gemini AI Client
    // Create a new instance of the GoogleGenAI client with the API key.
    const ai = new GoogleGenAI({ apiKey });
    
    // 3. Construct the Prompt
    // This is a form of "prompt engineering." We create a detailed, specific prompt
    // that tells the AI exactly what we want, including the user's specific details.
    // Providing clear instructions and context helps the model generate a high-quality, relevant response.
    const prompt = `
    Create a weekly workout plan for a user with the following details:
    - Goal: ${request.goal}
    - Experience Level: ${request.experience}
    - Days per week: ${request.days}
    - Available Equipment: ${request.equipment.length > 0 ? request.equipment.join(', ') : 'Bodyweight only'}

    Please provide the plan in the specified JSON format. For each exercise, suggest a number of sets and a rep range (e.g., "8-12 reps").
    Ensure the plan is balanced and targets different muscle groups appropriately throughout the week.
    If the goal is weight loss, include a mix of strength and cardio.
    If the goal is endurance, focus on higher reps or circuit-style training.
    If the goal is muscle building, focus on progressive overload with lower-to-moderate rep ranges.
  `;
  
    try {
        // 4. Make the API Call
        // We use `ai.models.generateContent` to send the request.
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash", // Specify the model to use.
            contents: prompt,         // The detailed prompt we constructed.
            config: {
                // This configuration is key for getting structured data.
                responseMimeType: "application/json", // We tell the model we expect JSON.
                responseSchema: planSchema,           // We provide the exact schema it should follow.
            },
        });
        
        // 5. Process the Response
        // Access the generated text from the response.
        const jsonText = response.text.trim();
        // The Gemini API can sometimes wrap the JSON in markdown backticks (```json ... ```),
        // so we defensively remove them to ensure clean JSON parsing.
        const cleanedJsonText = jsonText.replace(/^```json\s*/, '').replace(/```$/, '');

        // Parse the cleaned text into a JavaScript object and return it.
        return JSON.parse(cleanedJsonText);

    } catch (error) {
        // 6. Error Handling
        // If anything goes wrong during the API call, we log the error and throw a more
        // user-friendly error message that can be displayed in the UI.
        console.error("Error calling Gemini API:", error);
        if (error instanceof Error) {
            throw new Error(`Failed to generate workout plan: ${error.message}`);
        }
        throw new Error("An unexpected error occurred while generating the workout plan.");
    }
};