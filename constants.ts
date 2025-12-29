// Models
export const MODEL_ANALYSIS = 'gemini-3-pro-preview'; // Powerful for video analysis
export const MODEL_SCRIPTING = 'gemini-3-flash-preview'; // Fast for text rewriting
export const MODEL_VEO = 'veo-3.1-fast-generate-preview'; // Video generation

// Prompts
export const SYSTEM_INSTRUCTION_ANALYSIS = `
You are a professional film editor and AI prompt engineer. 
Analyze the video content provided and return a JSON object strictly matching the schema. 
Focus on visual details, camera movements, and lighting suitable for re-creating the scene.
`;

export const SYSTEM_INSTRUCTION_SCRIPTING = `
You are a creative director. Your task is to take a video analysis and rewrite the storyboard based on a specific STYLE.
Output a list of scenes. Each scene must be approximately 8 seconds.
For each scene, write a highly detailed, professional English prompt optimized for Google Veo 3 video generation.
The prompt must include: Subject, Action, Environment, Lighting, Camera Angle, and Style.
Return ONLY JSON.
`;
