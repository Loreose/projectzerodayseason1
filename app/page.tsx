"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { FaCog, FaPowerOff, FaFolder, FaFileImage, FaFileAlt, FaLock, FaBitcoin } from "react-icons/fa";
import { useSettings, WALLPAPERS } from "./utils/settings";
import { PhoneBar, PhonePanel, PhoneApp } from "./utils/PhonePanel";
import { PlayerStats } from "./utils/playerStats";

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // We'll determine the initial stage in useEffect to avoid hydration mismatch
  const [stage, setStage] = useState<"boot" | "login" | "desktop" | "operator_setup" | "post_setup">("boot");
  const [operatorName, setOperatorName] = useState<string>("");
  const [completedEpisodes, setCompletedEpisodes] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [selectedLockedEpisode, setSelectedLockedEpisode] = useState("");
  const [selectedSeasonToComplete, setSelectedSeasonToComplete] = useState("");
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [phoneActiveApp, setPhoneActiveApp] = useState<PhoneApp>(null);

  const transitionTo = (newStage: typeof stage) => {
    setIsExiting(true);
    setTimeout(() => {
        setStage(newStage);
        setIsExiting(false);
    }, 500);
  };

  useEffect(() => {
    // Initial boot sequence
    const bootSequence = async () => {
      // Check if already booted in this session
      const hasBooted = sessionStorage.getItem('boot_complete');
      const isDesktopReturn = searchParams.get("stage") === "desktop";
      const storedName = localStorage.getItem('operator_name');
      const completed = JSON.parse(localStorage.getItem('completed_episodes') || '[]');
      setCompletedEpisodes(completed);

      if (isDesktopReturn || hasBooted) {
        // Skip animation
        if (storedName) setOperatorName(storedName);
        
        if (isDesktopReturn) {
            setStage("desktop");
        } else if (storedName) {
            setStage("login");
        } else {
            setStage("operator_setup");
        }
      } else {
        // Full boot sequence
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (!storedName) {
            transitionTo("operator_setup");
        } else {
            setOperatorName(storedName);
            transitionTo("login");
        }
        
        // Mark as booted
        sessionStorage.setItem('boot_complete', 'true');
      }
      
      setIsInitialized(true);
    };

    bootSequence();
  }, [searchParams]);

  const [loginProgress, setLoginProgress] = useState(0);
  
  // Window management
  interface WindowState {
    id: string;
    title: string;
    isOpen: boolean;
    isMinimized: boolean;

    position: { x: number; y: number };
    size: { width: number; height: number };
    zIndex: number;
  }

  const [windows, setWindows] = useState<Record<string, WindowState>>({
    folders: {
      id: 'folders',
      title: 'Folders',
      isOpen: false,
      isMinimized: false,

      position: { x: 150, y: 100 },
      size: { width: 800, height: 500 },
      zIndex: 1
    },
    settings: {
      id: 'settings',
      title: 'Settings',
      isOpen: false,
      isMinimized: false,

      position: { x: 200, y: 150 },
      size: { width: 800, height: 600 },
      zIndex: 1
    }
  });
  
  const [highestZIndex, setHighestZIndex] = useState(1);
  const [draggingWindow, setDraggingWindow] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Helper functions for window management
  const openWindow = (windowId: string) => {
    setWindows(prev => ({
      ...prev,
      [windowId]: {
        ...prev[windowId],
        isOpen: true,
        isMinimized: false,
        zIndex: highestZIndex + 1
      }
    }));
    setHighestZIndex(prev => prev + 1);
  };

  const closeWindow = (windowId: string) => {
    setWindows(prev => ({
      ...prev,
      [windowId]: {
        ...prev[windowId],
        isOpen: false,
        isMinimized: false
      }
    }));
  };

  const minimizeWindow = (windowId: string) => {
    setWindows(prev => ({
      ...prev,
      [windowId]: {
        ...prev[windowId],
        isMinimized: true
      }
    }));
  };

  const restoreWindow = (windowId: string) => {
    setWindows(prev => ({
      ...prev,
      [windowId]: {
        ...prev[windowId],
        isMinimized: false,
        zIndex: highestZIndex + 1
      }
    }));
    setHighestZIndex(prev => prev + 1);
  };



  const handleWindowMouseDown = (windowId: string, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.window-header')) {
      if (windows[windowId].zIndex !== highestZIndex) {
        const newZIndex = highestZIndex + 1;
        setWindows(prev => ({
          ...prev,
          [windowId]: {
            ...prev[windowId],
            zIndex: newZIndex
          }
        }));
        setHighestZIndex(newZIndex);
      }
      
      setDraggingWindow(windowId);
      setDragOffset({
        x: e.clientX - windows[windowId].position.x,
        y: e.clientY - windows[windowId].position.y
      });
    }
  };

  // Dragging logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingWindow) {
         const windowWidth = windows[draggingWindow].size.width;
         const windowHeight = windows[draggingWindow].size.height;
         
         const rawX = e.clientX - dragOffset.x;
         const rawY = e.clientY - dragOffset.y;

         // Clamp to screen edges
         // Top bar is roughly 40px (h-12 is 48px? No, menu bar is px-4 py-2 + text. py-2 is 0.5rem top/bottom = 1rem total height + line height. 
         // But usually 0 is top of screen.
         // Let's constrain x to [0, innerWidth - windowWidth]
         // Let's constrain y to [0, innerHeight - windowHeight]
         
         const newX = Math.max(0, Math.min(window.innerWidth - windowWidth, rawX));
         const newY = Math.max(0, Math.min(window.innerHeight - windowHeight, rawY));
         
         setWindows(prev => ({
           ...prev,
           [draggingWindow]: {
             ...prev[draggingWindow],
             position: { x: newX, y: newY }
           }
         }));
      }
    };

    const handleMouseUp = () => {
      setDraggingWindow(null);
    };

    if (draggingWindow) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggingWindow, dragOffset, windows]);

  // Level interface
  interface Level {
    id: number;
    title: string;
    description: string;
    folderName?: string;
    locked?: boolean;
    season?: number;
    episodeNumber?: number;
  }

  const [levels, setLevels] = useState<Level[]>([]);
  const [currentPath, setCurrentPath] = useState("/");
  const [launchingLevel, setLaunchingLevel] = useState<Level | null>(null);

  // Fetch levels
  useEffect(() => {
    fetch("/api/levels")
      .then((res) => res.json())
      .then((data) => setLevels(data))
      .catch((err) => console.error("Failed to load levels", err));
  }, []);

  // Launch timer effect
  useEffect(() => {
    if (launchingLevel) {
      const timer = setTimeout(() => {
        router.push(`/game?episode=${launchingLevel.folderName}`);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [launchingLevel, router]);

  // Helper to get contents of current path
  const getFolderContents = () => {
    if (currentPath === "/") {
      // Group levels by season
      const seasons = new Set(levels.map(l => l.season || 1));
      return Array.from(seasons).sort().map(s => ({
        name: `SEASON_${s.toString().padStart(2, '0')}`,
        type: 'folder',
        season: s
      }));
    } else if (currentPath.startsWith("/SEASON_")) {
      const seasonNum = parseInt(currentPath.split("_")[1]);
      return levels
        .filter(l => (l.season || 1) === seasonNum)
        .sort((a, b) => (a.episodeNumber || a.id) - (b.episodeNumber || b.id))
        .map(l => {
          // Calculate if locked
          const epNum = l.episodeNumber !== undefined ? l.episodeNumber : l.id;
          let isLocked = false;
          
          // Episode 0 is always unlocked. Logic for > 0
          const currentFolder = l.folderName || `level_${l.id}`;
          
          if (completedEpisodes.includes(currentFolder)) {
             isLocked = true;
          } else if (epNum > 0) {
             const prevLevel = levels.find(pl => (pl.episodeNumber !== undefined ? pl.episodeNumber : pl.id) === epNum - 1);
             // If previous level exists, check if it is completed
             if (prevLevel) {
                const prevFolder = prevLevel.folderName || `level_${prevLevel.id}`;
                if (!completedEpisodes.includes(prevFolder)) {
                   isLocked = true;
                }
             }
          }

          return {
            name: `${l.folderName || `level_${l.id}`}.exe`,
            type: 'file',
            data: l,
            isLocked
          };
        });
    }
    return [];
  };

  const handleItemClick = (item: any) => {
    if (item.type === 'folder') {
      setCurrentPath(`/${item.name}`);
    } else {
      // Launch level with loading screen
      if (item.data.folderName) {
        setLaunchingLevel(item.data);
      }
    }
  };

  const handleBack = () => {
     if (currentPath !== "/") {
       setCurrentPath("/");
     }
  };

  // Auto-login timer
  useEffect(() => {
    if (stage === "login") {
      // Progress bar animation
      const progressInterval = setInterval(() => {
        setLoginProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            return 100;
          }
          return prev + 2;
        });
      }, 50); // Faster progress for 2.5s auth

      // Start exit animation
      const exitTimer = setTimeout(() => {
        setIsExiting(true);
      }, 4000);

      // Transition to desktop
      const transitionTimer = setTimeout(() => {
        setStage("desktop");
      }, 5000);

      return () => {
        clearTimeout(exitTimer);
        clearTimeout(transitionTimer);
        clearInterval(progressInterval);
      };
    }
  }, [stage]);

  const { settings, updateSetting, currentWallpaper, mounted } = useSettings();

  const desktopPhoneConfig = {
    enabled: true
  };

  return (
    <div className="relative min-h-screen w-full bg-black overflow-hidden flex flex-col select-none">
      {/* BOOT LOADING SCREEN */}
      {stage === "boot" && (
        <main className={`relative z-50 flex-1 flex flex-col items-center justify-center bg-black transition-opacity duration-500 ease-in-out ${isExiting ? 'opacity-0' : 'opacity-100 animate-[fadeIn_0.5s_ease-in]'}`}>
           <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-gray-800 border-t-white rounded-full animate-spin"></div>
           </div>
        </main>
      )}

      {/* Desktop Wallpaper - Dynamic from Settings */}
      {stage !== "boot" && (
        <div className={`absolute inset-0 transition-all duration-1000 ease-in-out ${stage === 'login' ? 'blur-xl scale-110 brightness-[0.6]' : 'blur-0 scale-100 brightness-100'}`}>
            {mounted && settings.wallpaperId === 'custom' && settings.customUrl ? (
            <img src={settings.customUrl} alt="Wallpaper" className="w-full h-full object-cover" />
            ) : (
            <div className={`w-full h-full transition-colors duration-500 ease-in-out ${mounted ? currentWallpaper.value : 'bg-[#1a1a2e]'}`}></div>
            )}
        </div>
      )}
      
      {/* Subtle pattern overlay */}
      {stage !== "boot" && (
        <div className="absolute inset-0 opacity-5" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '40px 40px'
        }}></div>
      )}

      {/* OPERATOR SETUP SCREEN */}
      {stage === "operator_setup" && (
        <main className={`relative z-10 flex-1 flex flex-col items-center justify-center transition-all duration-500 ease-in-out ${isExiting ? 'opacity-0 scale-95' : 'opacity-100 animate-[fadeIn_0.5s_ease-in]'}`}>
          <div className="w-full max-w-md bg-black/40 backdrop-blur-md border border-white/10 p-8 rounded-xl shadow-2xl flex flex-col items-center">
            <h2 className="text-2xl font-bold text-white mb-2 tracking-widest font-mono">Bilgisayar Adı</h2>
            <p className="text-gray-400 text-xs mb-8 font-mono text-center">
               Lütfen sistem kayıtları için bir bilgisayar adı girin.<br/>
            </p>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const input = (e.currentTarget.elements.namedItem('operatorName') as HTMLInputElement).value;
                if (input.trim()) {
                   const name = input.trim();
                   localStorage.setItem('operator_name', name);
                   setOperatorName(name);
                   
                   // Go to post_setup instead of login directly
                   transitionTo("post_setup");
                   
                   // Wait 10 seconds (plus fade time) then go to login
                   setTimeout(() => {
                       transitionTo("login");
                   }, 10500);
                }
              }}
              className="w-full flex flex-col gap-4"
            >
               <div className="relative group">
                  <input 
                    name="operatorName"
                    type="text" 
                    autoFocus
                    maxLength={12}
                    placeholder="Bilgisayar Adı.."
                    className="w-full bg-black/50 border border-gray-600 text-white font-mono text-center py-3 focus:outline-none focus:border-white focus:shadow-[0_0_15px_rgba(34,197,94,0.3)] transition-all rounded-sm tracking-widest"
                  />
                  <div className="absolute inset-0 border border-white/5 pointer-events-none"></div>
               </div>

               <button 
                 type="submit"
                 className="w-full bg-white/10 hover:bg-white/20 text-white font-mono text-sm py-2 border border-white/20 hover:border-white/40 transition-all rounded-sm tracking-wider"
               >
                 Devam Et
               </button>
            </form>
          </div>
        </main>
      )}

      {/* POST SETUP LOADING SCREEN */}
      {stage === "post_setup" && (
        <main className={`relative z-10 flex-1 flex flex-col items-center justify-center transition-opacity duration-1000 ease-in-out ${isExiting ? 'opacity-0' : 'opacity-100 animate-[fadeIn_1s_ease-in]'}`}>
           <div className="flex flex-col items-center gap-6">
              <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
              <div className="text-center space-y-2">
                  <h2 className="text-xl font-bold text-white tracking-widest font-mono">Hoşgeldin, bir kaç dakikanı alacağız...</h2>
              </div>
           </div>
        </main>
      )}

      {/* LOGIN SCREEN */}
      {stage === "login" && (
        <main 
          className={`relative z-10 flex-1 flex flex-col items-center justify-center animate-[fadeIn_0.5s_ease-in] transition-all duration-1000 ease-in-out ${
            isExiting ? "-translate-y-full opacity-0 scale-95 filter blur-sm" : ""
          }`}
        >
          <div className="w-full max-w-sm flex flex-col items-center">
            
            {/* User Avatar */}
            <div className="mb-6 relative group">
              <div className="w-24 h-24 rounded-full bg-gray-300 flex items-center justify-center shadow-2xl overflow-hidden border-2 border-white">
                 <svg viewBox="0 0 24 24" fill="currentColor" className="w-16 h-16 text-white translate-y-2">
                    <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
                 </svg>
              </div>
            </div>

            {/* Username */}
            <div className="mb-8 text-center">
              <h2 className="text-white text-xl font-medium tracking-wide drop-shadow-md">
                 {operatorName}
              </h2>
            </div>

            {/* Password Input (Typing Animation) */}
            <div className="w-full relative mb-6">
              <div className="bg-white/20 backdrop-blur-xl rounded-md p-1 flex items-center justify-center border border-white/20 shadow-lg h-9 w-56 mx-auto transition-all duration-300 hover:bg-white/25">
                 <div className="text-xl text-white tracking-widest font-bold h-full flex items-center justify-center pb-1 w-full relative">
                    {loginProgress < 5 ? (
                      <span className="text-sm text-white/70 font-sans tracking-normal absolute">Şifreyi Girin</span>
                    ) : (
                      <div className="flex items-center">
                        <span>{"•".repeat(Math.min(10, Math.floor(loginProgress / 10)))}</span>
                        {loginProgress < 100 && (
                          <span className="w-[2px] h-5 bg-white/90 ml-0.5 animate-pulse rounded-full"></span>
                        )}
                      </div>
                    )}
                 </div>
                 {/* Question mark icon */}
                 {loginProgress < 5 && (
                    <div className="absolute right-2 text-white/60 text-[10px] border border-white/40 rounded-full w-4 h-4 flex items-center justify-center hover:bg-white/20 cursor-pointer transition-colors">?</div>
                 )}
              </div>
            </div>

          </div>
        </main>
      )}

      {/* DESKTOP SCREEN */}
      {stage === "desktop" && (
        <>
          {/* macOS Menu Bar */}
          <div className="relative z-30 bg-black/20 backdrop-blur-xl border-b border-white/10">
            <div className="px-4 py-2 flex items-center justify-between">
              {/* Left side - Apple logo and app name */}
              <div className="flex items-center gap-4">
                <span className="text-white/90 text-sm font-medium">Masaüstü</span>
                <span className="text-white/70 text-sm">Dosya</span>
                <span className="text-white/70 text-sm">Düzenle</span>
                <span className="text-white/70 text-sm">Görünüm</span>
                <span className="text-white/70 text-sm">Pencere</span>
                <span className="text-white/70 text-sm">Yardım</span>
              </div>
              
              {/* Right side - System icons */}
              <div className="flex items-center gap-4">
                <div className="text-white/70 text-sm">
                  {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="text-white/70 text-sm">
                  {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            </div>
          </div>

          <main className="relative z-10 flex-1 px-8 py-8 font-mono animate-[fadeIn_0.5s_ease-in]">
            {/* Desktop Icons */}
            <div className="absolute top-8 left-8 flex flex-col gap-6 z-0">
              {/* Folders Icon */}
              <div 
                onClick={() => openWindow('folders')}
                className="flex flex-col items-center gap-2 cursor-pointer hover:bg-white/10 p-3 rounded-lg transition-colors group"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center text-white text-3xl shadow-lg group-hover:scale-110 transition-transform">
                  <FaFolder />
                </div>
                <span className="text-white text-sm font-sans shadow-black/50 drop-shadow-md">Dosyalar</span>
              </div>

              {/* Settings Icon */}
              <div 
                onClick={() => openWindow('settings')}
                className="flex flex-col items-center gap-2 cursor-pointer hover:bg-white/10 p-3 rounded-lg transition-colors group"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-gray-500 to-gray-700 rounded-xl flex items-center justify-center text-white text-3xl shadow-lg group-hover:scale-110 transition-transform">
                  <FaCog />
                </div>
                <span className="text-white text-sm font-sans shadow-black/50 drop-shadow-md">Ayarlar</span>
              </div>
            </div>

            {/* Folders Window */}
            {windows.folders.isOpen && !windows.folders.isMinimized && (
              <div
                onMouseDown={(e) => handleWindowMouseDown('folders', e)}
                className="absolute bg-[#1a1b26] rounded-lg border border-gray-700 shadow-2xl overflow-hidden flex flex-col animate-window-open"
                style={{
                  left: windows.folders.position.x,
                  top: windows.folders.position.y,
                  width: windows.folders.size.width,
                  height: windows.folders.size.height,
                  zIndex: windows.folders.zIndex,
                  transition: 'width 0.2s, height 0.2s'
                }}
              >
                
                {/* Toolbar */}
                <div className="window-header h-10 flex items-center justify-between px-4 bg-[#0f0f12] z-10 relative drag-handle border-b border-gray-800">
                  {/* Title */}
                  <div className="flex items-center pointer-events-none">
                    <span className="text-sm font-bold text-gray-200 font-sans">
                      {currentPath === "/" ? "Ana Sayfa" : currentPath.substring(1)}
                    </span>
                  </div>

                  {/* Window Controls (Right Aligned) */}
                  <div className="flex gap-2 h-full items-center pl-2">
                    <div onClick={(e) => { e.stopPropagation(); minimizeWindow('folders'); }} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full cursor-pointer transition-colors group" title="Minimize">
                      <svg width="10" height="2" viewBox="0 0 10 2" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M0 1H10" stroke="currentColor" strokeWidth="2" className="text-gray-400 group-hover:text-white"/>
                      </svg>
                    </div>

                    <div onClick={(e) => { e.stopPropagation(); closeWindow('folders'); }} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 rounded-full cursor-pointer transition-colors group" title="Close">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-gray-400 group-hover:text-white"/>
                      </svg>
                    </div>
                  </div>
                </div>

                 <div className="flex flex-1 overflow-hidden relative z-10 bg-[#1a1b26]">
                  {/* Main View (Grid) */}
                  {/* Main View (Grid) */}
                  <div className="flex-1 p-6 overflow-y-auto w-full custom-scrollbar">
                     {currentPath !== "/" && (
                       <button 
                         onClick={handleBack}
                         className="mb-6 text-sm text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 font-sans"
                       >
                         {"< .. ("}Geri{")"}
                       </button>
                     )}
                                          <div className="grid grid-cols-4 md:grid-cols-6 gap-6">
                        {getFolderContents().map((item, i) => {
                           const isLocked = (item as any).isLocked;
                           
                           return (
                           <div key={i} 
                                className={`flex flex-col items-center gap-2 group p-2 rounded transition-colors ${isLocked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-white/10'}`}
                                onClick={() => !isLocked && handleItemClick(item)}
                           >
                              <div className="w-16 h-16 flex items-center justify-center text-6xl drop-shadow-sm group-hover:scale-105 transition-transform relative">
                                 {item.type === 'folder' ? (
                                   <FaFolder className="text-blue-500 drop-shadow-md" />
                                 ) : isLocked ? (
                                   <div className="relative">
                                     <FaFileAlt className="text-gray-600 text-5xl" />
                                     <FaLock className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-red-500 text-2xl drop-shadow-md" />
                                   </div>
                                 ) : (
                                   <div className="relative">
                                     <FaFileAlt className="text-gray-400 text-5xl" />
                                    <span className="absolute bottom-2 -right-1 bg-gray-900 border border-gray-700 text-green-400 text-[8px] px-1 py-0.5 rounded font-mono font-bold shadow-md">EXE</span>
                                   </div>
                                 )}
                              </div>
                              <span className="text-xs text-gray-300 font-mono font-medium text-center leading-tight px-1 rounded bg-black/40 group-hover:bg-blue-600 group-hover:text-white transition-colors break-words w-full h-auto py-1 flex flex-col items-center">
                                {item.type === 'file' && item.name.endsWith('.exe') ? (
                                  <>
                                    {isLocked && <span className="text-red-400 font-bold mb-0.5">[KİLİTLİ]</span>}
                                    <span>
                                        {item.name.slice(0, -4)}
                                        <span className="whitespace-nowrap">.exe</span>
                                    </span>
                                  </>
                                ) : item.name}
                              </span>
                           </div>
                           );
                        })}
                     </div>
                  </div>
                </div>
              </div>
            )}

            {/* Loading Modal */}
            {launchingLevel && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <style jsx>{`
                  @keyframes progress {
                    0% { width: 0%; }
                    100% { width: 100%; }
                  }
                `}</style>
                <div className="w-96 bg-[#1a1b26] rounded-lg border border-gray-700 shadow-2xl overflow-hidden flex flex-col animate-window-open">
                  {/* Header */}
                  <div className="window-header h-10 flex items-center justify-between px-4 bg-[#0f0f12] border-b border-gray-800">
                    <span className="text-sm font-bold text-gray-200 font-sans">Sistem Yükleyicisi</span>
                    <div className="flex gap-2 h-full items-center pl-2">
                       <div onClick={() => setLaunchingLevel(null)} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 rounded-full cursor-pointer transition-colors group" title="Close">
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-gray-400 group-hover:text-white"/>
                          </svg>
                       </div>
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="p-6 flex flex-col items-center gap-4">
                    <div className="w-16 h-16 flex items-center justify-center text-6xl drop-shadow-sm relative">
                       <div className="relative">
                         <FaFileAlt className="text-gray-400 text-5xl" />
                         <span className="absolute bottom-2 -right-1 bg-gray-900 border border-gray-700 text-green-400 text-[8px] px-1 py-0.5 rounded font-mono font-bold shadow-md">EXE</span>
                       </div>
                    </div>
                    
                    <div className="text-center">
                      <h3 className="text-lg font-bold text-gray-200 font-mono">{launchingLevel.title}</h3>
                      <p className="text-sm text-gray-400 mt-1 px-2 font-mono">{launchingLevel.description}</p>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-full flex flex-col gap-2 mt-2">
                      <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                        <div className="h-full bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]" style={{ animation: 'progress 5s linear forwards' }}></div>
                      </div>
                      <div className="flex justify-between text-[10px] text-green-500 font-mono uppercase">
                        <span>Kaynaklar yükleniyor...</span>
                        <span>[MEŞGUL]</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Settings Window */}
            {windows.settings.isOpen && !windows.settings.isMinimized && (
              <div
                onMouseDown={(e) => handleWindowMouseDown('settings', e)}
                className="absolute bg-[#1a1b26] rounded-lg border border-gray-700 shadow-2xl overflow-hidden flex flex-col animate-window-open"
                style={{
                  left: windows.settings.position.x,
                  top: windows.settings.position.y,
                  width: windows.settings.size.width,
                  height: windows.settings.size.height,
                  zIndex: windows.settings.zIndex,
                  transition: 'width 0.2s, height 0.2s'
                }}
              >
                {/* Header */}
                <div className="window-header h-10 flex items-center justify-between px-4 bg-[#0f0f12] z-10 relative drag-handle border-b border-gray-800">
                  <div className="flex items-center pointer-events-none">
                    <span className="text-sm font-bold text-gray-200 font-sans">Ayarlar</span>
                  </div>
                  
                  <div className="flex gap-2 h-full items-center pl-2">
                    <div onClick={(e) => { e.stopPropagation(); minimizeWindow('settings'); }} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full cursor-pointer transition-colors group" title="Minimize">
                      <svg width="10" height="2" viewBox="0 0 10 2" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M0 1H10" stroke="currentColor" strokeWidth="2" className="text-gray-400 group-hover:text-white"/>
                      </svg>
                    </div>

                    <div onClick={(e) => { e.stopPropagation(); closeWindow('settings'); }} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 rounded-full cursor-pointer transition-colors group" title="Close">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-gray-400 group-hover:text-white"/>
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 p-6 overflow-y-auto bg-[#1a1b26] custom-scrollbar">
                  <h3 className="text-lg font-bold text-gray-200 mb-4 font-sans">Masaüstü Arkaplanı</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {WALLPAPERS.map((wp) => (
                      <div 
                        key={wp.id}
                        onClick={() => updateSetting('wallpaperId', wp.id)}
                        className={`cursor-pointer group relative rounded-sm overflow-hidden border-2 transition-all ${settings.wallpaperId === wp.id ? 'border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]' : 'border-gray-700 hover:border-gray-500'}`}
                      >
                         <div className={`h-24 w-full ${wp.value}`}></div>
                         <div className="p-2 bg-[#0f0f12] text-xs font-sans font-medium text-gray-300 text-center border-t border-gray-800">
                           {wp.name}
                         </div>
                         {settings.wallpaperId === wp.id && (
                           <div className="absolute top-2 right-2 w-5 h-5 bg-green-500 text-black rounded-full flex items-center justify-center text-[10px] font-bold">✓</div>
                         )}
                      </div>
                    ))}
                  </div>

                  {/* Custom URL Input */}
                  {settings.wallpaperId === 'custom' && (
                    <div className="mt-4 animate-[fadeIn_0.3s_ease-out]">
                      <label className="block text-xs font-bold text-green-500 mb-1 uppercase tracking-wide font-sans">Resim Bağlantısı</label>
                      <input 
                        type="text" 
                        placeholder="https://example.com/image.jpg"
                        value={settings.customUrl || ''}
                        onChange={(e) => updateSetting('customUrl', e.target.value)}
                        className="w-full px-3 py-2 bg-[#0f0f12] border border-gray-700 rounded-sm text-sm text-gray-200 font-mono focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all placeholder-gray-600"
                      />
                      <p className="text-[11px] text-gray-500 mt-1 font-sans">Resmin doğrudan bağlantısını yapıştırın.</p>

                      <div className="flex items-center gap-2 mt-2">
                        <div className="h-px bg-gray-700 flex-1"></div>
                        <span className="text-[10px] text-gray-500 font-bold font-sans">VEYA</span>
                        <div className="h-px bg-gray-700 flex-1"></div>
                      </div>

                      <label className="block mt-2 cursor-pointer">
                        <div className="w-full px-3 py-2 bg-[#0f0f12] border border-dashed border-gray-600 rounded-sm text-sm text-center text-gray-400 hover:bg-gray-800 hover:text-white transition-colors flex items-center justify-center gap-2 font-mono">
                           <FaFileImage />
                           <span>Dosya seç...</span>
                        </div>
                        <input 
                          type="file" 
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                updateSetting('customUrl', reader.result as string);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    </div>
                  )}
                  {/* Unlock Episodes Section */}
                  <div className="mt-8 pt-6 border-t border-gray-800">
                    <h3 className="text-lg font-bold text-gray-200 mb-4 font-sans">Bölüm Kilidi Aç</h3>
                    <div className="flex flex-col gap-3">
                        <p className="text-xs text-gray-400 font-sans">
                            Tamamlanan bölümler otomatik olarak kilitlenir. Tekrar oynamak için kilidini açabilirsin.
                        </p>
                        <div className="flex gap-2">
                             <select
                                className="flex-1 bg-[#0f0f12] border border-gray-700 text-gray-300 text-sm rounded-sm p-2 font-mono focus:border-green-500 focus:outline-none"
                                onChange={(e) => {
                                    // Store selection in a temp variable or state?
                                    // We need a state for the selected value to unlock
                                    const val = e.target.value;
                                    if (val) {
                                        // Update state directly or require button press?
                                        // Requirement: "select boxtan o bölümü seçip bölümün kilidini aç butonunu bas diyince"
                                        // So we need state.
                                        // I'll add a state variable inside the component or simple local logic if I can edit the top.
                                        // I can't edit the top efficiently with replace_file_content unless I do a separate call.
                                        // But I can use a ref or just handle it here if I reconstruct the logic.
                                        // Wait, I can't add state hooks here without re-rendering or changing the top of the file.
                                        // Function component: I must add `const [selectedUnlock, setSelectedUnlock] = useState("")` at the top.
                                        // I will do that in a separate step or try to use existing structure if possible.
                                        // For now, let's assume I will add the state.
                                        // Let's use `updateSetting`? No, settings are for wallpaper.
                                        // I need to add state to the component.
                                        // I'll just use a one-shot approach with a confirm? No, "select then click button".
                                        
                                        // Let's assume I added `selectedLockedEpisode` state at the top.
                                        setSelectedLockedEpisode(val);
                                    }
                                }}
                                value={selectedLockedEpisode}
                             >
                                <option value="">Bir Bölüm Seçin...</option>
                                {completedEpisodes.map(epId => {
                                    // Find level title
                                    const lvl = levels.find(l => (l.folderName || `level_${l.id}`) === epId);
                                    return (
                                        <option key={epId} value={epId}>
                                            {lvl ? `${lvl.title} (${epId})` : epId}
                                        </option>
                                    );
                                })}
                             </select>
                             <button
                                onClick={() => {
                                    if (!selectedLockedEpisode) return;
                                    
                                    // Remove from completed
                                    const newCompleted = completedEpisodes.filter(e => e !== selectedLockedEpisode);
                                    setCompletedEpisodes(newCompleted);
                                    localStorage.setItem('completed_episodes', JSON.stringify(newCompleted));
                                    setSelectedLockedEpisode("");
                                }}
                                disabled={!selectedLockedEpisode}
                                className={`px-4 py-2 rounded-sm font-sans text-xs font-bold transition-colors ${
                                    selectedLockedEpisode 
                                    ? 'bg-green-600 hover:bg-green-500 text-black cursor-pointer' 
                                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                }`}
                             >
                                Kilidi Aç
                             </button>
                        </div>
                    </div>
                  </div>

                  {/* Complete Season Section */}
                  <div className="mt-8 pt-6 border-t border-gray-800">
                    <h3 className="text-lg font-bold text-gray-200 mb-4 font-sans">Sezonu Tamamla</h3>
                    <div className="flex flex-col gap-3">
                        <p className="text-xs text-gray-400 font-sans">
                            Seçtiğiniz sezondaki tüm bölümlerin kilitlerini açar ve onları tamamlanmış olarak işaretler.
                        </p>
                        <div className="flex gap-2">
                             <select
                                className="flex-1 bg-[#0f0f12] border border-gray-700 text-gray-300 text-sm rounded-sm p-2 font-mono focus:border-green-500 focus:outline-none"
                                onChange={(e) => {
                                    setSelectedSeasonToComplete(e.target.value);
                                }}
                                value={selectedSeasonToComplete}
                             >
                                <option value="">Bir Sezon Seçin...</option>
                                {Array.from(new Set(levels.map(l => l.season || 1))).sort().map(s => (
                                    <option key={s} value={s.toString()}>
                                        Sezon {s}
                                    </option>
                                ))}
                             </select>
                             <button
                                onClick={() => {
                                    if (!selectedSeasonToComplete) return;
                                    
                                    const seasonNum = parseInt(selectedSeasonToComplete);
                                    
                                    // Find all episodes in this season
                                    const episodesInSeason = levels
                                        .filter(l => (l.season || 1) === seasonNum)
                                        .map(l => l.folderName || `level_${l.id}`);
                                        
                                    // Add to completed if not already there
                                    const newCompleted = [...completedEpisodes];
                                    let changed = false;
                                    episodesInSeason.forEach(epId => {
                                        if (!newCompleted.includes(epId)) {
                                            newCompleted.push(epId);
                                            changed = true;
                                        }
                                    });
                                    
                                    if (changed) {
                                        setCompletedEpisodes(newCompleted);
                                        localStorage.setItem('completed_episodes', JSON.stringify(newCompleted));
                                    }
                                    setSelectedSeasonToComplete("");
                                    alert(`Sezon ${seasonNum} başarıyla tamamlandı olarak işaretlendi!`);
                                }}
                                disabled={!selectedSeasonToComplete}
                                className={`px-4 py-2 rounded-sm font-sans text-xs font-bold transition-colors ${
                                    selectedSeasonToComplete 
                                    ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer' 
                                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                }`}
                             >
                                Sezonu Bitir
                             </button>
                        </div>
                    </div>
                  </div>

                  {/* Wallet Management */}
                  <div className="mt-8 pt-6 border-t border-gray-800">
                    <h3 className="text-lg font-bold text-yellow-500 mb-2 font-sans flex items-center gap-2">
                      <FaBitcoin className="text-sm" /> Cüzdan Yönetimi
                    </h3>
                    <p className="text-xs text-gray-400 mb-4 font-sans">
                      Oyun içi kripto cüzdan bakiyenizi ve işlem geçmişinizi buradan yönetebilirsiniz.
                    </p>
                  
                    {/* Current Balance Display */}
                    <div className="mb-3 bg-yellow-500/5 border border-yellow-500/20 rounded-sm px-4 py-3">
                      <p className="text-xs text-gray-500 font-mono mb-1">Mevcut Bakiye</p>
                      <p className="text-2xl font-bold text-yellow-400 font-mono">
                        {PlayerStats.getWalletBalance().toLocaleString("en-US", { minimumFractionDigits: 2 })} BTC
                      </p>
                    </div>
                  
                    {/* Add Balance */}
                    <div className="flex gap-2 mb-3">
                      <input
                        id="wallet-set-input"
                        type="number"
                        placeholder="Yeni bakiye girin..."
                        className="flex-1 px-3 py-2 bg-[#0f0f12] border border-gray-700 rounded-sm text-sm text-gray-200 font-mono focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all placeholder-gray-600"
                      />
                      <button
                        onClick={() => {
                          const input = document.getElementById('wallet-set-input') as HTMLInputElement;
                          const val = parseFloat(input?.value);
                          if (!isNaN(val)) {
                            PlayerStats.setWalletBalance(val);
                          }
                        }}
                        className="px-4 py-2 bg-yellow-500/10 border border-yellow-500/40 text-yellow-400 text-sm font-sans hover:bg-yellow-500 hover:text-black transition-all rounded-sm font-bold"
                      >
                        Ayarla
                      </button>
                    </div>
                    <div className="flex gap-2 mb-3">
                      <input
                        id="wallet-add-input"
                        type="number"
                        placeholder="Eklenecek miktarı girin..."
                        className="flex-1 px-3 py-2 bg-[#0f0f12] border border-gray-700 rounded-sm text-sm text-gray-200 font-mono focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all placeholder-gray-600"
                      />
                      <button
                        onClick={() => {
                          const input = document.getElementById('wallet-add-input') as HTMLInputElement;
                          const val = parseFloat(input?.value);
                          if (!isNaN(val)) {
                            PlayerStats.addFunds(val);
                          }
                        }}
                        className="px-4 py-2 bg-yellow-500/10 border border-yellow-500/40 text-yellow-400 text-sm font-sans hover:bg-yellow-500 hover:text-black transition-all rounded-sm font-bold"
                      >
                        Ekle
                      </button>
                    </div>
                  
                    {/* Reset Wallet */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (confirm("Cüzdan bakiyesi varsayılana sıfırlanacak. Emin misiniz?")) {
                            PlayerStats.resetWalletToBase(PlayerStats.DEFAULT_BALANCE);
                          }
                        }}
                        className="flex-1 py-2 bg-yellow-500/5 border border-yellow-500/20 text-yellow-600 text-sm font-sans hover:bg-yellow-500/20 transition-all rounded-sm tracking-wider"
                      >
                        Bakiyeyi Sıfırla
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Tüm işlem geçmişi silinecek. Emin misiniz?")) {
                            localStorage.removeItem('pz_tx_history');
                            localStorage.removeItem('pz_applied_fund_history');
                            window.location.reload();
                          }
                        }}
                        className="flex-1 py-2 bg-red-500/5 border border-red-500/20 text-red-500 text-sm font-sans hover:bg-red-500/20 transition-all rounded-sm tracking-wider"
                      >
                        Geçmişi Temizle
                      </button>
                    </div>
                  </div>

                  {/* Danger Zone */}
                  <div className="mt-8 pt-6 border-t border-gray-800">
                     <h3 className="text-lg font-bold text-red-500 mb-2 font-sans flex items-center gap-2">
                        <FaPowerOff className="text-sm" /> Tehlikeli Bölge
                     </h3>
                     <p className="text-xs text-gray-400 mb-4 font-sans">
                        Oyunu sıfırlamak tüm ilerlemeyi, ayarları ve yerel verileri silecektir. Bu işlem geri alınamaz.
                     </p>
                     <button 
                        onClick={() => {
                           if (confirm("HER ŞEYİ sıfırlamak istediğinize emin misiniz? Tüm ilerleme kaybolacak.")) {
                              localStorage.clear();
                              window.location.href = "/";
                           }
                        }}
                        className="w-full py-2 bg-red-500/10 border border-red-500/50 text-red-500 text-sm font-mono hover:bg-red-500 hover:text-white transition-all rounded-sm uppercase tracking-wider font-bold"
                     >
                        Oyun Verilerini Sıfırla
                     </button>
                  </div>
                </div>
              </div>
            )}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-40">
              <div className="bg-white/10 backdrop-blur-2xl rounded-2xl px-3 py-2 border border-white/20 shadow-2xl">
                <div className="flex items-end gap-2">
                  {/* Log Out Button */}
                  <div 
                    onClick={() => {
                      setIsExiting(false);
                      setLoginProgress(0);
                      setStage("login");
                    }}
                    className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-700 rounded-xl flex items-center justify-center text-white text-xl hover:scale-110 transition-transform cursor-pointer"
                    title="Log Out"
                  >
                    <FaPowerOff />
                  </div>

                  {/* Separator */}
                  <div className="w-1 h-10 bg-white/30 rounded-full mx-1"></div>

                  {/* Folders App */}
                  <div 
                    onClick={() => windows.folders.isOpen ? (windows.folders.isMinimized ? restoreWindow('folders') : minimizeWindow('folders')) : openWindow('folders')}
                    className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center text-white text-2xl hover:scale-110 transition-transform cursor-pointer relative"
                    title="Folders"
                  >
                     <FaFolder />
                  </div>
                  
                  {/* Settings */}
                  <div 
                    onClick={() => windows.settings.isOpen ? (windows.settings.isMinimized ? restoreWindow('settings') : minimizeWindow('settings')) : openWindow('settings')}
                    className="w-12 h-12 bg-gradient-to-br from-gray-500 to-gray-700 rounded-xl flex items-center justify-center text-white text-xl hover:scale-110 transition-transform cursor-pointer"
                    title="Settings"
                  >
                    <FaCog />
                  </div>

                </div>
              </div>
            </div>
          </main>

          <PhoneBar
            phoneOpen={phoneOpen}
            setPhoneOpen={setPhoneOpen}
            setPhoneActiveApp={setPhoneActiveApp}
            phoneConfig={desktopPhoneConfig}
          />

          <PhonePanel
            phoneOpen={phoneOpen}
            setPhoneOpen={setPhoneOpen}
            phoneActiveApp={phoneActiveApp}
            setPhoneActiveApp={setPhoneActiveApp}
            phoneConfig={desktopPhoneConfig}
          />
        </>

      )}
    </div>
  );
}
