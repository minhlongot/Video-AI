export enum AnalysisStyle {
  ORIGINAL = "Original",
  FUNNY = "Hài hước",
  SPOOKY = "Ma mị",
  AGGRESSIVE = "Cục súc",
  THRILLER = "Gay cấn",
  CINEMATIC = "Điện ảnh",
  ANIMATION_3D = "3D Hoạt hình"
}

export interface VideoAnalysis {
  environment: {
    space: string;
    time: string;
    weather_lighting: string;
  };
  character: {
    demographics: string;
    outfit: string;
    emotion_gesture: string;
    main_action: string;
  };
  audio: {
    dialogue: string;
    environment_sound: string;
    music: string;
  };
  camera: {
    angle: string;
    movement: string;
    pacing: string;
    style: string;
  };
  art_style: {
    style_type: string;
    color_tone: string;
    lighting_style: string;
  };
}

export interface Scene {
  id: string;
  timestamp: string;
  prompt: string; // The Veo 3 English prompt
  status: 'pending' | 'generating' | 'completed' | 'failed';
  videoUrl?: string;
  referenceImage?: string; // Base64 of a reference frame if needed
}

export interface AppState {
  videoFile: File | null;
  videoPreviewUrl: string | null;
  isAnalyzing: boolean;
  analysis: VideoAnalysis | null;
  scenes: Scene[];
  selectedStyle: AnalysisStyle;
  isStitching: boolean;
  error: string | null;
}