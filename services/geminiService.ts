import { GoogleGenAI, Type } from "@google/genai";
import { MODEL_ANALYSIS, MODEL_SCRIPTING, MODEL_VEO, SYSTEM_INSTRUCTION_ANALYSIS, SYSTEM_INSTRUCTION_SCRIPTING } from "../constants";
import { VideoAnalysis, AnalysisStyle, Scene } from "../types";

// Helper to get fresh instance with potentially updated key
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// File to Base64 helper
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data url prefix (e.g. "data:video/mp4;base64,")
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const analyzeVideoContent = async (base64Data: string, mimeType: string): Promise<VideoAnalysis> => {
  const ai = getAI();
  
  const response = await ai.models.generateContent({
    model: MODEL_ANALYSIS,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        },
        {
          text: "Analyze this video deeply. Provide the output in JSON format."
        }
      ]
    },
    config: {
      systemInstruction: SYSTEM_INSTRUCTION_ANALYSIS,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          environment: {
            type: Type.OBJECT,
            properties: {
              space: { type: Type.STRING },
              time: { type: Type.STRING },
              weather_lighting: { type: Type.STRING },
            }
          },
          character: {
             type: Type.OBJECT,
             properties: {
               demographics: { type: Type.STRING },
               outfit: { type: Type.STRING },
               emotion_gesture: { type: Type.STRING },
               main_action: { type: Type.STRING },
             }
          },
          audio: {
             type: Type.OBJECT,
             properties: {
               dialogue: { type: Type.STRING },
               environment_sound: { type: Type.STRING },
               music: { type: Type.STRING },
             }
          },
          camera: {
             type: Type.OBJECT,
             properties: {
               angle: { type: Type.STRING },
               movement: { type: Type.STRING },
               pacing: { type: Type.STRING },
               style: { type: Type.STRING },
             }
          },
          art_style: {
             type: Type.OBJECT,
             properties: {
               style_type: { type: Type.STRING },
               color_tone: { type: Type.STRING },
               lighting_style: { type: Type.STRING },
             }
          },
        }
      }
    }
  });

  if (!response.text) throw new Error("No analysis generated");
  return JSON.parse(response.text) as VideoAnalysis;
};

export const generateScenesFromAnalysis = async (
  analysis: VideoAnalysis, 
  style: AnalysisStyle
): Promise<Scene[]> => {
  const ai = getAI();
  const prompt = `
    Original Analysis: ${JSON.stringify(analysis)}
    
    Target Style: ${style}
    
    Task: 
    1. Rewrite the video concept to match the Target Style.
    2. Break it down into 8-second scenes.
    3. For each scene, write a "veo_prompt" in English that is optimized for Veo 3. 
       The prompt should be descriptive, cinematic, and encompass the new style.
  `;

  const response = await ai.models.generateContent({
    model: MODEL_SCRIPTING,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION_SCRIPTING,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            timestamp: { type: Type.STRING, description: "e.g. 00:00 - 00:08" },
            veo_prompt: { type: Type.STRING, description: "The English prompt for Veo 3" }
          }
        }
      }
    }
  });

  if (!response.text) throw new Error("No script generated");
  const rawScenes = JSON.parse(response.text);

  return rawScenes.map((s: any, index: number) => ({
    id: `scene-${Date.now()}-${index}`,
    timestamp: s.timestamp,
    prompt: s.veo_prompt,
    status: 'pending'
  }));
};

export const generateVeoVideo = async (scenePrompt: string): Promise<string> => {
  const ai = getAI();
  
  // Note: Veo requires a specific paid key flow, handled in UI before calling this.
  let operation = await ai.models.generateVideos({
    model: MODEL_VEO,
    prompt: scenePrompt,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '16:9'
    }
  });

  // Poll for completion
  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5s
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!videoUri) throw new Error("Video generation failed or returned no URI");

  // Fetch the actual video blob to use in the app
  const response = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
  if (!response.ok) throw new Error("Failed to download generated video content");
  
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};
