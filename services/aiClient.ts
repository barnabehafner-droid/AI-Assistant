import { GoogleGenAI } from "@google/genai";

// This will be replaced by Vite during the build process.
// It's crucial that the build environment has the API_KEY set.
const apiKey = process.env.API_KEY;

if (!apiKey) {
    // This provides a clear error message in the browser console 
    // if the API key was not available at build time.
    throw new Error("API_KEY environment variable not set during build. The application cannot start.");
}

export const ai = new GoogleGenAI({ apiKey });
