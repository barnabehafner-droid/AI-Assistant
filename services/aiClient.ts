import { GoogleGenAI } from "@google/genai";

// FIX: Adhering to @google/genai guidelines, which mandate using process.env.API_KEY.
// We declare `process` to satisfy TypeScript, assuming the build environment provides it.
declare var process: {
  env: {
    API_KEY: string;
  }
};

// Per guidelines, initialize directly with process.env.API_KEY and assume it is configured.
export const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
