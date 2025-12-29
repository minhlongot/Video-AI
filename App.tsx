import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, Film, Wand2, Play, Download, Settings, 
  Music, Camera, Palette, User, Sun, RefreshCw,
  CheckCircle2, AlertCircle, Video as VideoIcon
} from './components/Icons';
import { VideoPlayer } from './components/VideoPlayer';
import { AnalysisStyle, AppState, Scene, VideoAnalysis } from './types';
import { analyzeVideoContent, fileToGenerativePart, generateScenesFromAnalysis, generateVeoVideo } from './services/geminiService';

const App: React.FC = () => {
  // State
  const [state, setState] = useState<AppState>({
    videoFile: null,
    videoPreviewUrl: null,
    isAnalyzing: false,
    analysis: null,
    scenes: [],
    selectedStyle: AnalysisStyle.ORIGINAL,
    isStitching: false,
    error: null,
  });

  const [activeTab, setActiveTab] = useState<'analysis' | 'scenes'>('analysis');

  // Handle Video Upload
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        setState(s => ({ ...s, error: "Video quá lớn cho bản demo này. Vui lòng dùng video < 20MB." }));
        return;
      }
      const url = URL.createObjectURL(file);
      setState(s => ({
        ...s,
        videoFile: file,
        videoPreviewUrl: url,
        error: null,
        analysis: null,
        scenes: []
      }));
    }
  };

  // 1. Analyze Video
  const handleAnalyze = async () => {
    if (!state.videoFile) return;

    setState(s => ({ ...s, isAnalyzing: true, error: null }));
    try {
      const base64Data = await fileToGenerativePart(state.videoFile);
      const analysis = await analyzeVideoContent(base64Data, state.videoFile.type);
      
      // Auto-generate initial scenes based on Original style
      const initialScenes = await generateScenesFromAnalysis(analysis, AnalysisStyle.ORIGINAL);
      
      setState(s => ({ 
        ...s, 
        isAnalyzing: false, 
        analysis, 
        scenes: initialScenes 
      }));
      setActiveTab('scenes');
    } catch (err: any) {
      setState(s => ({ ...s, isAnalyzing: false, error: err.message || "Phân tích thất bại." }));
    }
  };

  // 2. Generate New Script based on Style
  const handleStyleGenerate = async () => {
    if (!state.analysis) return;

    setState(s => ({ ...s, isAnalyzing: true, error: null }));
    try {
      const newScenes = await generateScenesFromAnalysis(state.analysis, state.selectedStyle);
      setState(s => ({ ...s, isAnalyzing: false, scenes: newScenes }));
      setActiveTab('scenes');
    } catch (err: any) {
      setState(s => ({ ...s, isAnalyzing: false, error: err.message }));
    }
  };

  // 3. Generate Single Scene Video
  const handleGenerateSceneVideo = async (sceneId: string) => {
    // Check Key First
    const aiStudio = (window as any).aistudio;
    if (aiStudio) {
      const hasKey = await aiStudio.hasSelectedApiKey();
      if (!hasKey) {
        await aiStudio.openSelectKey();
      }
    }

    const sceneIndex = state.scenes.findIndex(s => s.id === sceneId);
    if (sceneIndex === -1) return;

    const scene = state.scenes[sceneIndex];
    
    // Update status to generating
    const updateScene = (updates: Partial<Scene>) => {
      setState(prev => {
        const newScenes = [...prev.scenes];
        newScenes[sceneIndex] = { ...newScenes[sceneIndex], ...updates };
        return { ...prev, scenes: newScenes };
      });
    };

    updateScene({ status: 'generating', error: undefined } as any);

    try {
      const videoUrl = await generateVeoVideo(scene.prompt);
      updateScene({ status: 'completed', videoUrl });
    } catch (err: any) {
      updateScene({ status: 'failed' });
      setState(s => ({ ...s, error: `Scene generation failed: ${err.message}` }));
    }
  };

  // 4. Generate All Videos (Sequential)
  const handleGenerateAll = async () => {
    const aiStudio = (window as any).aistudio;
    if (aiStudio) {
      const hasKey = await aiStudio.hasSelectedApiKey();
      if (!hasKey) {
        await aiStudio.openSelectKey();
      }
    }

    setState(s => ({ ...s, isStitching: true }));

    // Loop through scenes that don't have video yet
    for (const scene of state.scenes) {
      if (!scene.videoUrl) {
         await handleGenerateSceneVideo(scene.id);
      }
    }

    setState(s => ({ ...s, isStitching: false }));
  };

  // 5. Download All
  const handleDownloadAll = () => {
    state.scenes.forEach((scene, index) => {
      if (scene.videoUrl) {
        const a = document.createElement('a');
        a.href = scene.videoUrl;
        a.download = `veo_scene_${index + 1}_${state.selectedStyle}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    });
  };

  // Render Helpers
  const renderAnalysisBlock = (icon: React.ReactNode, title: string, data: any) => (
    <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
      <div className="flex items-center gap-2 mb-3 text-brand-500">
        {icon}
        <h3 className="font-semibold text-lg">{title}</h3>
      </div>
      <div className="space-y-2 text-sm text-gray-300">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="grid grid-cols-3 gap-2">
            <span className="text-gray-500 capitalize">{key.replace('_', ' ')}:</span>
            <span className="col-span-2 text-white">{String(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans selection:bg-brand-500/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-950/80 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-brand-500">
            <VideoIcon size={28} />
            <h1 className="text-2xl font-bold tracking-tight text-white">Veo<span className="text-brand-500">Director</span></h1>
          </div>
          <div className="flex gap-4">
             {(window as any).aistudio && (
               <button 
                 onClick={() => (window as any).aistudio?.openSelectKey()}
                 className="text-xs text-gray-400 hover:text-white underline"
               >
                 API Key Settings
               </button>
             )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Input & Analysis */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Upload Section */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 shadow-xl">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Upload size={20} /> Input Video
            </h2>
            
            {!state.videoFile ? (
              <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-gray-700 border-dashed rounded-xl cursor-pointer hover:bg-gray-800/50 hover:border-brand-500 transition-all group">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-10 h-10 mb-3 text-gray-500 group-hover:text-brand-500 transition-colors" />
                  <p className="mb-2 text-sm text-gray-400"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                  <p className="text-xs text-gray-500">MP4, MOV (Max 20MB)</p>
                </div>
                <input type="file" className="hidden" accept="video/mp4,video/quicktime" onChange={handleFileChange} />
              </label>
            ) : (
              <div className="space-y-4">
                <VideoPlayer src={state.videoPreviewUrl!} className="aspect-video bg-black rounded-lg" />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400 truncate max-w-[200px]">{state.videoFile.name}</span>
                  <button 
                    onClick={() => setState(s => ({ ...s, videoFile: null, videoPreviewUrl: null }))}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}

            {/* Analyze Action */}
            {state.videoFile && !state.analysis && (
              <button
                onClick={handleAnalyze}
                disabled={state.isAnalyzing}
                className="w-full mt-4 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {state.isAnalyzing ? <RefreshCw className="animate-spin" /> : <Wand2 />}
                {state.isAnalyzing ? "Analyzing Video..." : "Analyze Content"}
              </button>
            )}
          </div>

          {/* Analysis Results */}
          {state.analysis && (
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Settings size={20} /> Analysis
                </h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setActiveTab('analysis')}
                    className={`px-3 py-1 text-xs rounded-full ${activeTab === 'analysis' ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                  >
                    Details
                  </button>
                  <button 
                    onClick={() => setActiveTab('scenes')}
                    className={`px-3 py-1 text-xs rounded-full ${activeTab === 'scenes' ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                  >
                    Script
                  </button>
                </div>
              </div>

              {activeTab === 'analysis' ? (
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {renderAnalysisBlock(<Sun size={18}/>, "Environment", state.analysis.environment)}
                  {renderAnalysisBlock(<User size={18}/>, "Character", state.analysis.character)}
                  {renderAnalysisBlock(<Camera size={18}/>, "Camera", state.analysis.camera)}
                  {renderAnalysisBlock(<Palette size={18}/>, "Art Style", state.analysis.art_style)}
                  {renderAnalysisBlock(<Music size={18}/>, "Audio", state.analysis.audio)}
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Style Selector */}
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Creative Style</label>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.values(AnalysisStyle).map((style) => (
                        <button
                          key={style}
                          onClick={() => setState(s => ({ ...s, selectedStyle: style }))}
                          className={`px-3 py-2 text-sm rounded-lg border transition-all text-left ${
                            state.selectedStyle === style 
                              ? 'bg-brand-900/40 border-brand-500 text-brand-300' 
                              : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                          }`}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <button
                    onClick={handleStyleGenerate}
                    disabled={state.isAnalyzing}
                    className="w-full py-3 bg-white text-gray-900 hover:bg-gray-200 rounded-lg font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    {state.isAnalyzing ? <RefreshCw className="animate-spin" /> : <Film />}
                    Generate New Script
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Scene Manager & Preview */}
        <div className="lg:col-span-7 space-y-6">
          {state.error && (
            <div className="bg-red-900/20 border border-red-800 text-red-200 p-4 rounded-xl flex items-center gap-3">
              <AlertCircle size={20} />
              {state.error}
            </div>
          )}

          {state.scenes.length > 0 && (
            <div className="bg-gray-900 rounded-2xl border border-gray-800 shadow-xl overflow-hidden">
              <div className="p-6 border-b border-gray-800 flex justify-between items-center sticky top-0 bg-gray-900 z-10">
                <div>
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Film size={20} /> Storyboard
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {state.scenes.length} scenes • {state.scenes.length * 8}s total duration
                  </p>
                </div>
                <div className="flex gap-2">
                   <button 
                    onClick={handleGenerateAll}
                    disabled={state.isStitching || state.isAnalyzing}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                  >
                    {state.isStitching ? <RefreshCw className="animate-spin" size={16} /> : <Play size={16} />}
                    Generate All Video
                  </button>
                  <button 
                    onClick={handleDownloadAll}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                  >
                    <Download size={16} /> Export
                  </button>
                </div>
              </div>

              <div className="divide-y divide-gray-800 max-h-[calc(100vh-250px)] overflow-y-auto">
                {state.scenes.map((scene, idx) => (
                  <div key={scene.id} className="p-6 group hover:bg-gray-800/30 transition-colors">
                    <div className="flex gap-4">
                      {/* Left: Thumbnail/Video Area */}
                      <div className="w-48 flex-shrink-0">
                        <div className="aspect-video bg-gray-950 rounded-lg border border-gray-800 overflow-hidden relative flex items-center justify-center">
                          {scene.videoUrl ? (
                            <VideoPlayer src={scene.videoUrl} className="w-full h-full" />
                          ) : (
                            <div className="text-center p-2">
                              {scene.status === 'generating' ? (
                                <RefreshCw className="animate-spin mx-auto text-brand-500 mb-2" />
                              ) : (
                                <VideoIcon className="mx-auto text-gray-700 mb-2" />
                              )}
                              <span className="text-xs text-gray-500 uppercase font-mono tracking-wider">
                                {scene.status === 'generating' ? 'Generating...' : `Scene ${idx + 1}`}
                              </span>
                            </div>
                          )}
                        </div>
                        {scene.status === 'failed' && (
                           <span className="text-xs text-red-500 mt-1 block text-center">Generation Failed</span>
                        )}
                        {scene.videoUrl && (
                          <a 
                            href={scene.videoUrl} 
                            download={`scene_${idx+1}.mp4`}
                            className="mt-2 text-xs text-gray-400 hover:text-brand-400 flex items-center justify-center gap-1 w-full"
                          >
                            <Download size={12} /> Download Clip
                          </a>
                        )}
                      </div>

                      {/* Right: Prompt & Controls */}
                      <div className="flex-1 space-y-3">
                        <div className="flex justify-between items-start">
                           <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-800 text-gray-400 text-xs font-mono">
                             {scene.timestamp}
                           </span>
                           {scene.status === 'completed' && <CheckCircle2 size={16} className="text-green-500" />}
                        </div>
                        
                        <div>
                          <label className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1 block">Veo Prompt</label>
                          <textarea 
                            className="w-full bg-gray-950/50 border border-gray-700 rounded-lg p-3 text-sm text-gray-300 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none resize-none h-24"
                            value={scene.prompt}
                            onChange={(e) => {
                              const newScenes = [...state.scenes];
                              newScenes[idx].prompt = e.target.value;
                              setState(s => ({ ...s, scenes: newScenes }));
                            }}
                          />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            onClick={() => handleGenerateSceneVideo(scene.id)}
                            disabled={scene.status === 'generating'}
                            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-xs text-white rounded border border-gray-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                          >
                            {scene.status === 'generating' ? <RefreshCw className="animate-spin" size={12}/> : <Wand2 size={12} />}
                            {scene.videoUrl ? "Regenerate" : "Generate Scene"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State / Welcome */}
          {!state.scenes.length && !state.videoFile && (
            <div className="h-full flex items-center justify-center text-center p-12 border-2 border-dashed border-gray-800 rounded-2xl opacity-50">
              <div className="max-w-md">
                <Film className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                <h3 className="text-xl font-bold text-gray-300 mb-2">Ready to Create?</h3>
                <p className="text-gray-500">Upload a video to start the AI analysis and creative process.</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;