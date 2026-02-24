"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FaTerminal, FaStickyNote, FaTimes, FaCog, FaPowerOff, FaCheck, FaFileImage, FaBitcoin } from "react-icons/fa";
import { loadLevelData, parseStoryLog, LevelMeta, LevelTask,
  LevelFileSettings,
  StorySegment,
} from "../utils/levelLoader";
import { useSettings, WALLPAPERS } from "../utils/settings";
import { PhoneBar, PhonePanel, PhoneApp } from "../utils/PhonePanel";
import { PlayerStats } from "../utils/playerStats";

// Window management interface
interface WindowState {
  id: string;
  title: string;
  isOpen: boolean;
  isMinimized: boolean;

  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
}

export default function GamePage() {
  const router = useRouter();
  const { settings, updateSetting, currentWallpaper, mounted } = useSettings();
  const searchParams = useSearchParams();
  const episodeName = searchParams.get("episode") || "episode_0"; // Default to first episode
  
  // Ref for terminal output container
  const terminalOutputRef = useRef<HTMLDivElement>(null);

  const [input, setInput] = useState("");
  // History is now an array of arrays (lines of segments)
  const [history, setHistory] = useState<Array<StorySegment[]>>([]);
  // Queue for animated story lines
  const [storyQueue, setStoryQueue] = useState<Array<StorySegment[]>>([]);
  const [typingLine, setTypingLine] = useState<StorySegment[]>([]);
  const [fullLineTarget, setFullLineTarget] = useState<StorySegment[] | null>(null);
  const [typingIndices, setTypingIndices] = useState({ segment: 0, char: 0 });
  const [loading, setLoading] = useState(true);

  // Level data
  const [levelMeta, setLevelMeta] = useState<LevelMeta | null>(null);
  const [tasks, setTasks] = useState<LevelTask[]>([]);
  const [fileSettings, setFileSettings] = useState<LevelFileSettings | null>(
    null
  );
  const [currentDirectory, setCurrentDirectory] = useState("~");

  // Mission state
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [target, setTarget] = useState("UNKNOWN");
  const [user, setUser] = useState("guest");
  // Remote user for SSH sessions (preserves main user identity)
  const [remoteUser, setRemoteUser] = useState<string | null>(null);
  // Operator name (The computer's name/hostname in story)
  const [operatorName, setOperatorName] = useState("LOCALHOST");

  const [hostname, setHostname] = useState("localhost");
  const [passwordPrompt, setPasswordPrompt] = useState<{
    active: boolean;
    user: string;
    server: any;
  } | null>(null);
  const [chapterEndPause, setChapterEndPause] = useState(false);
  const [chapterEndTaskId, setChapterEndTaskId] = useState<string | null>(null);
  
  // Command history for arrow key navigation
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [vpnConnected, setVpnConnected] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [phoneActiveApp, setPhoneActiveApp] = useState<PhoneApp>(null);

  // Window management state
  const [windows, setWindows] = useState<Record<string, WindowState>>({
    terminal: {
      id: 'terminal',
      title: 'Terminal',
      isOpen: false,
      isMinimized: false,

      position: { x: 150, y: 100 },
      size: { width: 1000, height: 650 },
      zIndex: 1
    },
    notes: {
      id: 'notes',
      title: 'Notlar',
      isOpen: false,
      isMinimized: false,

      position: { x: 200, y: 150 },
      size: { width: 350, height: 400 },
      zIndex: 1
    },
    settings: {
      id: 'settings',
      title: 'Ayarlar',
      isOpen: false,
      isMinimized: false,

      position: { x: 250, y: 200 },
      size: { width: 800, height: 600 },
      zIndex: 1
    }
  });
  const [highestZIndex, setHighestZIndex] = useState(1);
  const [draggingWindow, setDraggingWindow] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Story initialization state
  const [storyStarted, setStoryStarted] = useState(false);
  const [fullStoryData, setFullStoryData] = useState<Array<StorySegment[]>>([]);

  // Auto-scroll to bottom when history changes
  useEffect(() => {
    if (terminalOutputRef.current) {
      terminalOutputRef.current.scrollTop = terminalOutputRef.current.scrollHeight;
    }
  }, [history]);

  // Story typing effect (character by character)
  useEffect(() => {
    // Don't process story if we're paused at chapter end
    if (chapterEndPause) {
      return;
    }
    
    // If we're not typing and queue has data, start typing next line
    if (!fullLineTarget && storyQueue.length > 0) {
      const nextLine = storyQueue[0];

      const hasChapterEnd = nextLine.some(seg => seg.isChapterEnd);
      
      const notificationSegment = nextLine.find(seg => seg.notification);
      if (notificationSegment?.notification) {
        window.dispatchEvent(new CustomEvent('phone_notify', { detail: notificationSegment.notification }));
        
        if (nextLine.every(seg => !seg.text)) {
           // Skip rendering this line, just process the notification
           setStoryQueue(prev => prev.slice(1));
           return;
        }
      }
      
      const transactionSegment = nextLine.find(seg => seg.transaction);
      if (transactionSegment?.transaction) {
        const tx = transactionSegment.transaction;
        // Deduplication: Only apply each unique transaction once.
        // Uses a stable ID based on the tx's own content (not random), so
        // this survives page reloads and does NOT block new episodes.
        
        // Re-construct the stable txId for persistent history check
        // Format: {episodeName}-tx-{type}-{amount}-{title}-{fromTo}
        const txId = `${episodeName}-tx-${tx.type}-${tx.amount}-${tx.title?.replace(/\s+/g, '') || ''}-${tx.fromTo?.replace(/\s+/g, '') || ''}`;
        
        const FUND_HISTORY_KEY = 'pz_applied_fund_history';
        const TX_OBJECTS_KEY = 'pz_tx_history';
        const appliedFunds: string[] = JSON.parse(localStorage.getItem(FUND_HISTORY_KEY) || '[]');
        
        if (!appliedFunds.includes(txId)) {
          if (tx.type === "receive") {
            PlayerStats.addFunds(tx.amount);
          } else if (tx.type === "send") {
            PlayerStats.spendFunds(tx.amount);
          }
          appliedFunds.push(txId);
          localStorage.setItem(FUND_HISTORY_KEY, JSON.stringify(appliedFunds));
          
          const fullTx = { ...tx, id: txId };
          const savedTxs = JSON.parse(localStorage.getItem(TX_OBJECTS_KEY) || '[]');
          savedTxs.unshift(fullTx); // newest first
          localStorage.setItem(TX_OBJECTS_KEY, JSON.stringify(savedTxs));
          
          window.dispatchEvent(new CustomEvent('phone_crypto_tx', { detail: fullTx }));
        }
        
        if (nextLine.every(seg => !seg.text)) {
           setStoryQueue(prev => prev.slice(1));
           return;
        }
      }

      if (hasChapterEnd) {
        // Extract task ID if present
        const chapterEndSegment = nextLine.find(seg => seg.isChapterEnd);
        const taskId = chapterEndSegment?.taskId || null;
        
        // Pause story progression
        setChapterEndPause(true);
        setChapterEndTaskId(taskId);
        
        // Remove it from queue without adding to history
        setStoryQueue(prev => prev.slice(1));
        return;
      }

      const hasEpisodeEnd = nextLine.some(seg => seg.isEpisodeEnd);
      if (hasEpisodeEnd) {
         // Mark episode as completed in localStorage
         const completed = JSON.parse(localStorage.getItem('completed_episodes') || '[]');
         if (!completed.includes(episodeName)) {
             completed.push(episodeName);
             localStorage.setItem('completed_episodes', JSON.stringify(completed));
         }
         // Remove from queue
         setStoryQueue(prev => prev.slice(1));
         return;
      }
      
      // Replace {USER} placeholder with current user in the next line
      const processedLine = nextLine.map(seg => ({
        ...seg,
        text: seg.text
          .replace(/{USER}/g, user.toUpperCase())
          .replace(/{PC_NAME}/g, operatorName.toUpperCase())
      }));

      setFullLineTarget(processedLine);
      setTypingLine(processedLine.map(seg => ({ ...seg, text: "" })));
      setTypingIndices({ segment: 0, char: 0 });
      setStoryQueue(prev => prev.slice(1));
      return;
    }

    // If we have a target we're typing
    if (fullLineTarget) {
      const { segment, char } = typingIndices;
      
      // Check if we've finished the current segment
      if (char >= fullLineTarget[segment].text.length) {
        // Move to next segment if available
        if (segment + 1 < fullLineTarget.length) {
          setTypingIndices({ segment: segment + 1, char: 0 });
        } else {
          // Finished the whole line - add to history and clear typing state
          setHistory(prev => [...prev, fullLineTarget]);
          setFullLineTarget(null);
          setTypingLine([]);
        }
        return;
      }

      // Add one character
      const charDelay = 30;
      const timer = setTimeout(() => {
        const charToAppend = fullLineTarget[segment].text[char];
        setTypingLine(prev => {
          const newLine = [...prev];
          newLine[segment] = { 
            ...newLine[segment], 
            text: newLine[segment].text + charToAppend 
          };
          return newLine;
        });
        setTypingIndices(prev => ({ ...prev, char: prev.char + 1 }));
      }, charDelay);

      return () => clearTimeout(timer);
    }
  }, [storyQueue, fullLineTarget, typingIndices, chapterEndPause]);
  // Effect to resume story when chapter end task is completed
  useEffect(() => {
    if (chapterEndPause && chapterEndTaskId && completedTasks.includes(chapterEndTaskId)) {
        setChapterEndPause(false);
        setChapterEndTaskId(null);
    }
  }, [completedTasks, chapterEndPause, chapterEndTaskId]);

  const loadLevel = async () => {
    try {
      setLoading(true);
      const data = await loadLevelData(episodeName);

      // Determine user identity
      const operatorName = localStorage.getItem('operator_name');
      const savedNick = localStorage.getItem('player_nickname');
      
      let initialUser = "guest";
      if (operatorName) {
          initialUser = operatorName;
      } else if (savedNick && savedNick !== "guest") {
          initialUser = savedNick;
      }
      
      setUser(initialUser);
      setVpnConnected(false);

      // Dynamic File System Update: Rename /home/guest to /home/<user>
      if (initialUser !== "guest") {
          // Update root path if it points to guest home
          if (data.fileSettings.fileSystem.root === "/home/guest") {
              data.fileSettings.fileSystem.root = `/home/${initialUser}`;
          }
          
          // Rename directory in file system tree
          const directories = data.fileSettings.fileSystem.directories || [];
          const homeDir = directories.find((d: any) => d.name === "home");
          if (homeDir) {
              // Check explicit directories array
              const guestDir = homeDir.directories?.find((d: any) => d.name === "guest");
              if (guestDir) {
                  guestDir.name = initialUser;
              } else if (homeDir.files) {
                  // Check legacy/mixed files array
                   const guestDirFile = homeDir.files.find((f: any) => f.name === "guest" && (f.isDirectory || f.files));
                   if (guestDirFile) {
                       guestDirFile.name = initialUser;
                   }
              }
          }
      }

      setLevelMeta(data.meta);
      setTasks(data.tasks.tasks);
      setFileSettings(data.fileSettings);

      // Parse and display story
      const storyLines = parseStoryLog(data.story);

      
      // Initialize with just the header or completely empty?
      // Let's start with nothing and animate everything
      setHistory([]);
      setStoryQueue([]);
      setFullLineTarget(null);
      setTypingLine([]);
      
      const season = data.meta.season || 1;
      const epNum = data.meta.episodeNumber || data.meta.id;
      const headerText = `BÖLÜM ${season}x${epNum.toString().padStart(2, "0")}: ${data.meta.title}`;

      const fullStory = [
        [{ text: "═".repeat(30), color: "#00ff00", className: "tracking-tighter leading-none" }],
        [{ text: headerText, color: "#00ff00", className: "font-bold" }],
        [{ text: "═".repeat(30), color: "#00ff00", className: "tracking-tighter leading-none mb-2" }],
        [{ text: "" }],
        ...storyLines,
        [{ text: "" }],
        [{ text: "─".repeat(30), color: "#00ff00", className: "tracking-tighter leading-none" }],
        [{ text: "" }],
        [{ text: "[GÖREV TAMAMLANDI]", color: "#00ff00", className: "font-bold" }],
        [{ text: "[Bölümden çıkmak için 'exit' yazın]", color: "#00ff00", className: "font-bold" }],
        [{ text: "" }],
        [{ text: "", isEpisodeEnd: true }], // Special marker for locking
      ];

      // Store story data but don't start it yet
      setFullStoryData(fullStory);

      // Extract target from remote servers if available
      if (
        data.fileSettings.fileSystem.remoteServers &&
        data.fileSettings.fileSystem.remoteServers.length > 0
      ) {
        const firstServer = data.fileSettings.fileSystem.remoteServers[0];
        setTarget(firstServer.hostname || firstServer.ip);
      }
      
      // Set initial directory to ~ (which now resolves to /home/initialUser)
      setCurrentDirectory("~");
      
      setLoading(false);
    } catch (error) {
      console.error("Failed to load episode:", error);
      setHistory([
        [{ text: "HATA: Görev verileri yüklenemedi", color: "#ff0000" }],
        [{ text: "Bölüm seçimine dönülüyor...", color: "#ff0000" }],
      ]);
      setTimeout(() => router.push("/levels"), 3000);
    }
  };



  // Load level data on mount or when episode changes (Moved here to access loadLevel)
  useEffect(() => {
    // Load persisted nickname
    // First load operator name (always foundation)
    const savedOpName = localStorage.getItem('operator_name');
    if (savedOpName) {
      setOperatorName(savedOpName);
    }

    // Then try to load nickname - this overrides user display
    const savedNick = localStorage.getItem('player_nickname');
    if (savedNick) {
      setUser(savedNick);
    } else if (savedOpName) {
      // If no nickname yet, default user to operator name
      setUser(savedOpName);
    }
    
    loadLevel();
  }, [episodeName]);

  // Helper to get active file system based on connection
  const getActiveFileSystem = () => {
    if (hostname === "localhost") {
       return fileSettings?.fileSystem;
    }
    return fileSettings?.fileSystem.remoteServers?.find(s => s.hostname === hostname || s.ip === hostname)?.fileSystem;
  };

  // Helper to resolve path to a directory entry
  // Returns:
  // - null if path not found
  // - "root" string if path resolves to root
  // - FileSystemEntry if path resolves to a directory object
  const resolvePath = (fs: any, path: string) => {
    if (!fs) return null;
    
    // Resolve ~ to absolute path
    let absolutePath = path;
    if (path === "~") {
        absolutePath = fs.root || "/";
    }
    
    // Handle root /
    if (absolutePath === "/") return "root";
    
    // Strip leading slash
    if (absolutePath.startsWith("/")) absolutePath = absolutePath.substring(1);
    
    // If empty now, it's root
    if (!absolutePath) return "root";

    const parts = absolutePath.split("/").filter(p => p);
    let current: any = fs; // Start at fs which has directories/files

    for (const part of parts) {
      if (!current) return null;
      // Find in directories
      const dir = current.directories?.find((d: any) => d.name === part);
      if (dir) {
        current = dir;
      } else {
        // Not found in directories
        return null;
      }
    }
    return current;
  };

  const handleCommand = (cmd: string) => {
    // Handle password input
    if (passwordPrompt?.active) {
      const { user: targetUser, server } = passwordPrompt;
      let output = "";
      
      if (cmd === server.password) {
        output = `Giriş Başarılı.`;
        setRemoteUser(targetUser);
        setHostname(server.hostname || server.ip);
        setCurrentDirectory("/");
      } else {
        output = "Erişim Reddedildi";
      }
      
      // Add masked input to history
      setHistory((prev) => [
        ...prev,
        ...output.split('\n').map(line => {
          let color = "#cccccc";
          if (line.includes("Giriş Başarılı")) color = "#00ff00";
          if (line.includes("Erişim Reddedildi")) color = "#ff0000";
          return [{ text: line, color }];
        }),
        [{ text: "" }]
      ]);
      
      setPasswordPrompt(null);
      return;
    }

    const command = cmd.trim().toLowerCase();
    const parts = command.split(" ");
    const mainCmd = parts[0];
    let output = "";
    let isHtmlResponse = false;

    // Check VPN requirement
    if (levelMeta?.vpnReq && !vpnConnected) {
        const allowedCommands = ["vpn", "help", "exit", "clear"];
        if (!allowedCommands.includes(mainCmd)) {
            // Add red error output directly
             setHistory((prev) => [
                ...prev,
                [{ text: `${user}@${hostname}:${currentDirectory}$ ${cmd}`, color: "#00ff00", italic: true }],
                [{ text: "HATA: Bu görev için güvenli VPN bağlantısı gereklidir. Lütfen 'vpn connect' komutunu kullanın.", color: "#ff0000" }],
                [{ text: "" }]
             ]);
             return;
        }
    }

    switch (mainCmd) {
      case "help":
        output = `Kullanılabilir komutlar:
  help      - Bu yardım mesajını göster
  ls        - Dizin içeriğini listele
  cat       - Dosya içeriğini görüntüle
  cd        - Dizin değiştir
  pwd       - Çalışma dizinini yazdır
  curl      - Bir URL'ye HTTP isteği yap
  ssh       - Uzak sunucuya bağlan (kullanım: ssh user@host)
  vpn       - VPN bağlantısı yönetimi (connect/disconnect/check)
  submit    - Dosyanı gönder
  clear     - Terminali temizle
  exit      - Bölüm seçimine dön`;
        break;
      case "pwd":
        output = currentDirectory === "~" ? getActiveFileSystem()?.root || "/home/guest" : currentDirectory;
        break;

      case "ls":
        const fs = getActiveFileSystem();
        if (fs) {
          const effectiveDir = currentDirectory === "~" ? fs.root : currentDirectory;
          const resolved = resolvePath(fs, effectiveDir);

          if (resolved) {
             let dirs: any[] = [];
             let files: any[] = [];

             if (resolved === "root") {
               dirs = fs.directories || [];
               files = fs.files || [];
             } else {
               // It's a directory entry
               // Support both 'directories' property and 'files' property for children
               // The type definition now has 'directories'
               dirs = resolved.directories || [];
               // Also check 'files' for directories if mixed (legacy support or flexible structure)
               if (resolved.files) {
                 const mixedDirs = resolved.files.filter((f: any) => f.isDirectory || f.files || f.directories);
                 dirs = [...dirs, ...mixedDirs];
                 files = resolved.files.filter((f: any) => !f.isDirectory && !f.files && !f.directories);
               }
             }

             // Deduplicate dirs if needed (though structure should avoid it)
             // Format output
             const dirNames = dirs.map((d: any) => {
                const indicator = d.locked ? "🔒 " : "";
                return `${indicator}${d.name}/`;
             });
             const fileNames = files.map((f: any) => {
                const exec = f.executable ? "*" : "";
                return `${f.name}${exec}`;
             });
             
             if (dirNames.length === 0 && fileNames.length === 0) {
               output = "";
             } else {
               output = [...dirNames, ...fileNames].join("  ");
             }

          } else {
            output = `ls: erişilemiyor '${effectiveDir}': Böyle bir dosya veya dizin yok`;
          }
        } else {
           output = "ls: dosya sistemi kullanılamıyor";
        }
        checkTaskCompletion('event', { event: 'TERMINAL_LS' });
        break;

      case "cd":
        if (parts.length < 2) {
          output = "Kullanım: cd <dizin>";
        } else {
          const targetPath = parts[1];
          const fs = getActiveFileSystem();
          if (fs) {
            let newPath = currentDirectory === "~" ? (fs.root || "/home/guest") : currentDirectory;

            if (targetPath === "~") {
              newPath = fs.root || "/home/guest";
            } else if (targetPath.startsWith("/")) {
              newPath = targetPath;
            } else {
               // Relative path resolution
               const currentParts = (newPath || "").split("/").filter(p => p);
               const targetParts = targetPath.split("/").filter(p => p);

               for (const part of targetParts) {
                 if (part === "..") {
                   currentParts.pop();
                 } else if (part === ".") {
                   // do nothing
                 } else {
                   currentParts.push(part);
                 }
               }
               // Reconstruct absolute path
               newPath = "/" + currentParts.join("/");
               // Ensure we didn't go above root (optional, but linux allows /..)
               // Here 'root' is top level. fs.root might be /home/guest.
            }
            
            // Verify path exists using resolvePath
            const resolved = resolvePath(fs, newPath);
            
            if (resolved) {
              // Check lock status
               if (resolved !== "root" && resolved.locked) {
                 output = `Erişim reddedildi: ${targetPath} kilitli`;
               } else {
                 setCurrentDirectory(newPath);
                 output = "";
               }
            } else {
               output = `cd: böyle bir dosya veya dizin yok: ${targetPath}`;
            }

          } else {
            output = "cd: dosya sistemi kullanılamıyor";
          }
        }
        break;

      case "cat":
        if (parts.length < 2) {
          output = "Kullanım: cat <dosyaadı>";
        } else {
          const targetPath = parts[1];
          const fs = getActiveFileSystem();
          
          if (fs) {
             const pathParts = targetPath.split("/");
             const fileName = pathParts.pop();
             const dirPath = pathParts.join("/"); // Empty if just filename

             // Resolve directory path
             let searchPath = currentDirectory === "~" ? fs.root : currentDirectory;
             
             if (targetPath.startsWith("/")) {
                 // Absolute path
                 const lastSlashIndex = targetPath.lastIndexOf("/");
                 searchPath = targetPath.substring(0, lastSlashIndex) || "/";
             } else {
                 // Relative path
                 if (dirPath && dirPath !== ".") {
                    const currentParts = searchPath.split("/").filter(p => p);
                    const targetParts = dirPath.split("/").filter(p => p);
                    
                    for (const part of targetParts) {
                        if (part === "..") currentParts.pop();
                        else if (part !== ".") currentParts.push(part);
                    }
                    searchPath = "/" + currentParts.join("/");
                 }
             }

             const resolvedDir = resolvePath(fs, searchPath);
             
             if (resolvedDir) {
                 // Look for file in the resolved directory
                 let files: any[] = [];
                 if (resolvedDir === "root") {
                     files = fs.files || [];
                 } else {
                     files = resolvedDir.files || [];
                 }
                 
                 const file = files.find((f: any) => f.name === fileName);
                 if (file) {
                    output = file.content || `[İkili dosya: ${fileName}]`;
                    
                    // Check if this cat command completes a task (e.g. read a file)
                    // We can treat this as a 'command' task where target is "cat filename"
                    // OR we could add a 'read_file' type. For now, let's treat it as command.
                    checkTaskCompletion('command', { command: cmd });
                 } else {
                    output = `cat: ${fileName}: Böyle bir dosya yok`;
                 }
              } else {
                 output = `cat: ${dirPath}: Böyle bir dizin yok`;
              }
          } else {
             output = `cat: dosya sistemi hatası`;
          }
        }
        break;

      case "scan":
        if (parts.length > 1 && parts[1] === "--local") {
            // Check if current hostname matches the episode's internal IP gateway
            if (levelMeta?.internal_ip && hostname === levelMeta.internal_ip) {
                 const servers = fileSettings?.fileSystem.remoteServers || [];
                 // Filter servers that belong to this internal network
                 // 1. The Gateway itself (which is us right now)
                 // 2. Servers that have 'internalOnly' true AND gateway matches our internal_ip
                 
                 const internalDevices = servers.filter(s => {
                    if (s.ip === levelMeta.internal_ip) return true; // Gateway
                    if (s.internalOnly && s.gateway === levelMeta.internal_ip) return true;
                    return false;
                 });

                 // Format the output
                 const deviceList = internalDevices.map(s => {
                    const deviceName = s.name || s.hostname || "Unknown Device";
                    const ip = s.ip;
                    const status = "ACTIVE"; // Hardcoded for now, could be dynamic later
                    
                    // Pad strings for table alignment
                    const ipPad = ip.padEnd(16, ' ');
                    const statusPad = status.padEnd(12, ' ');
                    
                    return `${ipPad}${statusPad}${deviceName}`;
                 }).join('\n');

                 output = `
Yerel Ağ Taraması Başlatılıyor...
Kapsam: 192.168.1.0/24

HEDEFLER:
------------------------------------------------
IP              DURUM       CİHAZ
${deviceList}
------------------------------------------------
Tarama Tamamlandı.
                 `;
                 checkTaskCompletion('command', { command: cmd });
            } else {
                 output = "Hata: Yerel ağ arayüzü bulunamadı. Dış ağdasınız.";
            }
        } else {
            output = "Kullanım: scan --local";
        }
        break;

      case "curl":
        if (parts.length < 2) {
          output = "Kullanım: curl <url>";
        } else {
          const url = parts[1];
          
          // Extract domain/hostname from URL
          let hostname = url;
          try {
            // Remove protocol if present
            hostname = url.replace(/^https?:\/\//, "");
            
            // First check if the full path matches a defined server (e.g. ny-port.gov/terminal-7)
            const exactMatch = fileSettings?.fileSystem.remoteServers?.some(
              (s) => s.hostname === hostname || s.ip === hostname
            );
            
            if (!exactMatch) {
              hostname = hostname.split("/")[0];
            }
          } catch (e) {
            hostname = url;
          }
          
          // Check if server exists in fileSettings
          if (fileSettings?.fileSystem.remoteServers) {
            const server = fileSettings.fileSystem.remoteServers.find(
              (s) => s.hostname === hostname || s.ip === hostname
            );
            
            if (server) {
              // Check if server has HTML response
              if (server.htmlResponse) {
                output = server.htmlResponse;
                isHtmlResponse = true;
              } else {
                // Show basic server info
                output = `Sunucu: ${server.hostname}
IP: ${server.ip}`;
              }
            } else {
              output = `curl: (6) Ana makine çözümlenemedi: ${hostname}`;
            }
          } else {
            output = `curl: (6) Ana makine çözümlenemedi: ${hostname}`;
          }
        }
        break;

      case "ssh":
        if (parts.length < 2) {
          output = "Kullanım: ssh <kullanıcı>@<ip>";
        } else {
          const args = parts[1].split("@");
          if (args.length !== 2) {
            output = "Kullanım: ssh <kullanıcı>@<ip>";
          } else {
            const [newUser, targetHost] = args;
            // Check if targetHost exists in remoteServers
            if (fileSettings?.fileSystem.remoteServers) {
              const server = fileSettings.fileSystem.remoteServers.find(
                (s) => s.hostname === targetHost || s.ip === targetHost
              );

              if (server) {
                // Internal Network Check
                if (server.internalOnly && hostname !== server.gateway) {
                    output = `ssh: Bağlantı hatası - ${targetHost} erişilemez (Zaman Aşımı)`;
                } else if (server.password && server.user === newUser) {
                  // Require password
                  output = `${targetHost} sunucusuna bağlanılıyor...`;
                  setPasswordPrompt({
                    active: true,
                    user: newUser,
                    server: server
                  });
                  // Check if this ssh command completes a task
                  checkTaskCompletion('command', { command: cmd });
                  
                  // Add initial output but don't finish yet
                   setHistory((prev) => [
                    ...prev,
                    [{ text: `${user}@${hostname}:${currentDirectory}$ ${cmd}`, color: "#00ff00", italic: true }],
                    [{ text: output, color: "#cccccc" }]
                  ]);
                  return;
                } else {
                  // No password or direct access (if allowed)
                  // For now, let's assume if password exists, we MUST use it. 
                  // If user provided doesn't match server user, we might want to fail or just prompt anyway (security through obscurity)
                  // But for game simplicity:
                  if (server.user && server.user !== newUser) {
                     output = `Erişim reddedildi (publickey,password).`;
                  } else {
                    output = `${targetHost} sunucusuna bağlanılıyor...\nErişim İzni Verildi.\n${newUser} olarak giriş yapıldı`;
                    setRemoteUser(newUser);
                    setHostname(server.hostname || targetHost);
                    setCurrentDirectory("/");
                  }
                }
              } else {
                output = `ssh: Ana makine adı çözümlenemedi ${targetHost}`;
              }
            } else {
              output = `ssh: Ana makine adı çözümlenemedi ${targetHost}`;
            }
          }
        }
        break;
      case "vpn":
        if (parts.length < 2) {
            output = "Kullanım: vpn <connect|disconnect|check>";
        } else {
            const action = parts[1].toLowerCase();
            if (action === "connect") {
                if (vpnConnected) {
                    output = "VPN zaten bağlı.";
                } else {
                    setVpnConnected(true);
                    output = `VPN bağlantısı başlatılıyor...
Yönlendirme sunucusu: 10.8.0.1 (PharmaCorp Secure)
Tünel oluşturuldu.
Durum: BAĞLANDI (Şifreli)`;
                }
            } else if (action === "disconnect") {
                if (!vpnConnected) {
                    output = "VPN zaten bağlı değil.";
                } else {
                    setVpnConnected(false);
                    output = "VPN bağlantısı sonlandırıldı.";
                }
            } else if (action === "check") {
                if (vpnConnected) {
                    output = "VPN Durumu: BAĞLI (Güvenli)";
                } else {
                    output = "VPN Durumu: BAĞLI DEĞİL";
                }
            } else {
                output = "Bilinmeyen vpn komutu. Kullanılabilir: connect, disconnect, check";
            }
        }
        break;

      case "submit":
        if (parts.length < 2) {
          output = "Kullanım: submit <değer>";
        } else {
          // Use original cmd to preserve case (e.g. "4491-SEC" not "4491-sec")
          const originalParts = cmd.trim().split(" ");
          const value = originalParts.slice(1).join(" ");
          checkTaskCompletion('submit', { value: value });
          output = `Gönderiliyor: ${value}...`;
        }
        break;

      case "identity":
        if (parts.length === 1) {
            output = `Mevcut kimlik: ${user}\nAna Makine: ${hostname}`;
        } else if (parts[1] === "--set" && parts.length >= 3) {
            // Check if this is Episode 0 (tutorial/setup)
            // We allow changing identity ONLY in episode 0
            if (levelMeta?.episodeNumber === 0) {
                const newName = parts.slice(2).join(" ");
                const finalName = newName.trim();
                
                if (!finalName) {
                    output = "HATA: Kimlik boş olamaz.";
                } else {
                    // Update state and sync
                    setUser(finalName);
                    setOperatorName(finalName);
                    localStorage.setItem('player_nickname', finalName);
                    localStorage.setItem('operator_name', finalName);
                    
                    output = `Kullanıcı kimliği güncellendi: ${finalName}
Ana Makine: ${hostname}`;
                }
            } else {
                output = "Hata: Kimlik protokolleri kilitli. Değişiklik PharmaCorp güvenlik politikası tarafından devre dışı bırakıldı.";
            }
        } else {
            output = "Kullanım: identity [--set <isim>]";
        }
        break;

      case "clear":
        setHistory([]);
        return;

      case "exit":
        if (remoteUser) {
           setRemoteUser(null);
           // Restore local terminal identity
           setUser(operatorName || "root");
           setHostname("localhost"); 
           setCurrentDirectory("~");
           
           setHistory(prev => [
             ...prev, 
             [{ text: "Bağlantı kapatıldı.", color: "#cccccc" }]
           ]);
           return;
        }
        router.push("/?stage=desktop");
        return;

      default:
        // Check if command matches any task (fallback for simple commands)
        checkTaskCompletion('command', { command: command });
        
        output = `Komut bulunamadı: ${cmd}
Kullanılabilir komutlar için 'help' yazın`;
    }

    // Parse output into lines with individual colors
    const outputLines = output.split('\n').map(line => {
      let lineColor = "#cccccc"; // default gray
      let isItalic = false;
      
      if (isHtmlResponse) {
        lineColor = "#888888";
        isItalic = true;
      } else if (line.includes("HATA") || line.includes("Erişim reddedildi") || line.includes("bulunamadı") || line.includes("erişilemiyor") || line.includes("hatası")) {
        lineColor = "#ff0000"; // red for errors
      } else if (line.match(/\d+\.\d+\.\d+\.\d+/)) {
        lineColor = "#ff6b35"; // orange for IPs
      } else if (line.trim().startsWith("Sunucu:")) {
        lineColor = "#ff6b35"; // orange for Server header
      } else if (line.startsWith("Kullanıcı kimliği güncellendi:")) {
        lineColor = "#00ff00"; // Green for identity success
      } else if (line.startsWith("Ana Makine:")) {
        lineColor = "#888888"; // Gray for info
        isItalic = true;
      }

      return [{ text: line, color: lineColor, italic: isItalic }];
    });

    setHistory((prev) => [
      ...prev,
      [{ text: `${user}@${hostname}:${currentDirectory}$ ${cmd}`, color: "#00ff00", italic: true }], // green prompt
      ...outputLines,
      [{ text: "" }],
    ]);
  };

  // Helper to check task completion
  const checkTaskCompletion = (type: string, context: any) => {
    // Find matching task
    const matchingTask = tasks.find(t => {
      if (t.type !== type) return false;
      if (completedTasks.includes(t.id)) return false;

      if (type === 'command') {
        const cmdInput = context.command.toLowerCase().trim();
        const targetCmd = t.target.toLowerCase().trim();
        return cmdInput === targetCmd || cmdInput.startsWith(targetCmd + " ");
      }

      if (type === 'submit') {
         // Special handling for identity verification task
         if (t.target === "{USER}") {
            // Task requires submitting the current valid username
            // We check if the submitted value matches the current user AND the user is not default 'guest'
            return context.value === user && user !== 'guest';
         }
         
         // Standard handling: Check if submitted value matches target
         // Plain text codes (e.g. "4491-SEC") and filenames are both accepted by value equality alone.
         return t.target === context.value;
      }
      return false;
    });

    if (matchingTask) {
        setCompletedTasks(prev => [...prev, matchingTask.id]);
        
        // Add completion message locally (won't be in history array immediately if called from handleCommand, 
        // but handleCommand adds its own output. We need to inject this.)
        // Actually, better to return the message and let handleCommand append it?
        // Or just modify history here. But handleCommand also modifies history.
        // Let's perform a direct state update for the message, hoping it merges well or appears after.
        // Wait, handleCommand runs synchronously. 
        // If we update state here, it will be batched or sequential.
        
        setHistory(prev => [
           ...prev, 
        ]);

        // Check chapter end
        if (chapterEndPause && chapterEndTaskId === matchingTask.id) {
          setChapterEndPause(false);
          setChapterEndTaskId(null);
        }

        // Check if all required tasks are completed
        const requiredTasks = tasks.filter(t => t.required);
        const newCompletedTasks = [...completedTasks, matchingTask.id];
        const allRequiredCompleted = requiredTasks.every(t => newCompletedTasks.includes(t.id));

        if (allRequiredCompleted) {
             setHistory(prev => [
                ...prev, 
            ]);
        }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      // Add command to history (avoid duplicates of last command)
      if (commandHistory.length === 0 || commandHistory[commandHistory.length - 1] !== input.trim()) {
        setCommandHistory([...commandHistory, input.trim()]);
      }
      // Reset history index
      setHistoryIndex(-1);
      
      handleCommand(input);
      setInput("");
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistory.length === 0) return;
      
      const newIndex = historyIndex === -1 
        ? commandHistory.length - 1 
        : Math.max(0, historyIndex - 1);
      
      setHistoryIndex(newIndex);
      setInput(commandHistory[newIndex]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (commandHistory.length === 0 || historyIndex === -1) return;
      
      const newIndex = historyIndex + 1;
      
      if (newIndex >= commandHistory.length) {
        setHistoryIndex(-1);
        setInput("");
      } else {
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
      }
    }
  };

  // Window management functions
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
    
    // Start story when terminal is opened for the first time
    if (windowId === 'terminal' && !storyStarted && fullStoryData.length > 0) {
      setStoryQueue(fullStoryData);
      setStoryStarted(true);
    }
  };

  const closeWindow = (windowId: string) => {
    if (windowId === 'terminal') {
      // Terminal close button exits to levels
      router.push("/?stage=desktop");
    } else {
      setWindows(prev => ({
        ...prev,
        [windowId]: {
          ...prev[windowId],
          isOpen: false,
          isMinimized: false
        }
      }));
    }
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



  const bringToFront = (windowId: string) => {
    setWindows(prev => ({
      ...prev,
      [windowId]: {
        ...prev[windowId],
        zIndex: highestZIndex + 1
      }
    }));
    setHighestZIndex(prev => prev + 1);
  };

  const handleWindowMouseDown = (windowId: string, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.window-header')) {
      // Only bring to front if not already at the front
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
      // Calculate offset from mouse to window's current position
      setDragOffset({
        x: e.clientX - windows[windowId].position.x,
        y: e.clientY - windows[windowId].position.y
      });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingWindow) {
        const newX = Math.max(0, Math.min(window.innerWidth - windows[draggingWindow].size.width, e.clientX - dragOffset.x));
        const newY = Math.max(0, Math.min(window.innerHeight - windows[draggingWindow].size.height, e.clientY - dragOffset.y));
        
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



  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (terminalOutputRef.current) {
      terminalOutputRef.current.scrollTop = terminalOutputRef.current.scrollHeight;
    }
  }, [history, typingLine, storyQueue, fullLineTarget]);


  const handleDisconnect = () => {
    router.push("/?stage=desktop");
  };

  const calculateProgress = () => {
    if (tasks.length === 0) return 0;
    return Math.round((completedTasks.length / tasks.length) * 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white font-mono text-xl animate-pulse">
          GÖREV VERİLERİ YÜKLENİYOR...
        </div>
      </div>
    );
  }



  // ... (existing code)

  return (
    <div className="relative min-h-screen w-full overflow-hidden flex flex-col">
      {/* Desktop Wallpaper - Dynamic */}
      <div className="absolute inset-0">
        {mounted && settings.wallpaperId === 'custom' && settings.customUrl ? (
           <img src={settings.customUrl} alt="Wallpaper" className="w-full h-full object-cover transition-opacity duration-500" />
        ) : (
           <div className={`w-full h-full transition-colors duration-500 ease-in-out ${mounted ? currentWallpaper.value : 'bg-[#1a1a2e]'}`}></div>
        )}
      </div>
      
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
        backgroundSize: '40px 40px'
      }}></div>

      {/* macOS Menu Bar */}
      <div className="relative z-30 bg-black/20 backdrop-blur-xl border-b border-white/10">
        <div className="px-4 py-2 flex items-center justify-between">
          {/* Left side - Apple logo and app name */}
          <div className="flex items-center gap-4">
            <span className="text-white/90 text-sm font-medium">Terminal</span>
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

      {/* Desktop Content */}
      <main className="relative z-10 flex-1 px-8 py-8 font-mono">
        {/* Desktop Icons */}
        <div className="absolute top-8 left-8 flex flex-col gap-6 z-0">
          {/* Terminal Icon */}
          <div 
            onClick={() => openWindow('terminal')}
            className="flex flex-col items-center gap-2 cursor-pointer hover:bg-white/10 p-3 rounded-lg transition-colors group"
          >
            <div className="w-16 h-16 bg-gradient-to-br from-gray-700 to-gray-900 rounded-xl flex items-center justify-center text-white text-3xl shadow-lg group-hover:scale-110 transition-transform">
              <FaTerminal />
            </div>
            <span className="text-white text-sm font-sans">Terminal</span>
          </div>

          {/* Notes Icon */}
          <div 
            onClick={() => openWindow('notes')}
            className="flex flex-col items-center gap-2 cursor-pointer hover:bg-white/10 p-3 rounded-lg transition-colors group"
          >
            <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-xl flex items-center justify-center text-white text-3xl shadow-lg group-hover:scale-110 transition-transform">
              <FaStickyNote />
            </div>
            <span className="text-white text-sm font-sans">Notlar</span>
          </div>

          {/* Settings Icon */}
          <div 
            onClick={() => openWindow('settings')}
            className="flex flex-col items-center gap-2 cursor-pointer hover:bg-white/10 p-3 rounded-lg transition-colors group"
          >
            <div className="w-16 h-16 bg-gradient-to-br from-gray-600 to-gray-800 rounded-xl flex items-center justify-center text-white text-3xl shadow-lg group-hover:scale-110 transition-transform">
              <FaCog />
            </div>
            <span className="text-white text-sm font-sans">Ayarlar</span>
          </div>
        </div>

        {/* Notes Window */}
        {windows.notes.isOpen && !windows.notes.isMinimized && (
          <div
            onMouseDown={(e) => handleWindowMouseDown('notes', e)}
            className="absolute bg-[#1a1b26] shadow-2xl select-none animate-window-open"
            style={{
              left: windows.notes.position.x,
              top: windows.notes.position.y,
              width: windows.notes.size.width,
              height: windows.notes.size.height,
              zIndex: windows.notes.zIndex,
              transition: 'width 0.2s, height 0.2s',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid #374151'
            }}
          >
            {/* Notes Header - Kali Style */}
            <div className="window-header h-10 flex items-center justify-between px-4 bg-[#0f0f12] z-10 relative drag-handle border-b border-gray-800">
               <div className="flex items-center pointer-events-none">
                <span className="text-sm font-bold text-gray-200 font-sans">
                  {windows.notes.title}
                </span>
              </div>
              <div className="flex gap-2 h-full items-center pl-2">
                <div onClick={(e) => { e.stopPropagation(); minimizeWindow('notes'); }} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full cursor-pointer transition-colors group" title="Minimize">
                  <svg width="10" height="2" viewBox="0 0 10 2" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 1H10" stroke="currentColor" strokeWidth="2" className="text-gray-400 group-hover:text-white"/>
                  </svg>
                </div>

                <div onClick={(e) => { e.stopPropagation(); closeWindow('notes'); }} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 rounded-full cursor-pointer transition-colors group" title="Close">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-gray-400 group-hover:text-white"/>
                  </svg>
                </div>
              </div>
            </div>

            {/* Notes Content */}
            <div className="p-4 overflow-y-auto bg-[#1a1b26] select-text text-gray-200" style={{
              fontFamily: 'Comic Sans MS, cursive',
              fontSize: '13px',
              lineHeight: '1.5',
              height: 'calc(100% - 48px)'
            }}>
              <div className="mb-3">
                <div className="font-bold text-sm">HEDEF:</div>
                <div className="text-red-700 font-bold text-base">
                  {levelMeta?.target || "BİLİNMİYOR"}
                </div>
              </div>

              <div className="mb-3">
                <div className="font-bold text-sm">KULLANICI:</div>
                <div className="text-sm">
                  {user}
                </div>
              </div>

              <div className="mb-3">
                <div className="font-bold text-sm">GÖREV:</div>
                <div className="text-sm whitespace-pre-wrap">
                  {levelMeta?.objective || 
                   (Array.isArray(levelMeta?.objectives) ? levelMeta.objectives.join("\n") : levelMeta?.objectives) || 
                   "Görev hedeflerini tamamlayın"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Terminal Window */}
        {windows.terminal.isOpen && !windows.terminal.isMinimized && (
          <div
            onMouseDown={(e) => handleWindowMouseDown('terminal', e)}
            className="absolute bg-[#1a1b26]/70 shadow-2xl select-none backdrop-blur-md animate-window-open"
            style={{
              left: windows.terminal.position.x,
              top: windows.terminal.position.y,
              width: windows.terminal.size.width,
              height: windows.terminal.size.height,
              zIndex: windows.terminal.zIndex,
              transition: 'width 0.2s, height 0.2s',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid #374151',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
          {/* Terminal Header - Kali Style */}
          <div className="window-header h-10 flex items-center justify-between px-4 bg-[#0f0f12] z-10 relative drag-handle border-b border-gray-800">
             <div className="flex items-center pointer-events-none">
              <span className="text-sm font-bold text-gray-200 font-sans">
                Terminal
              </span>
            </div>
            <div className="flex gap-2 h-full items-center pl-2">
              <div onClick={(e) => { e.stopPropagation(); minimizeWindow('terminal'); }} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full cursor-pointer transition-colors group" title="Minimize">
                <svg width="10" height="2" viewBox="0 0 10 2" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M0 1H10" stroke="currentColor" strokeWidth="2" className="text-gray-400 group-hover:text-white"/>
                </svg>
              </div>

              <div onClick={(e) => { e.stopPropagation(); closeWindow('terminal'); }} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 rounded-full cursor-pointer transition-colors group" title="Close">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-gray-400 group-hover:text-white"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Terminal Content */}
          <div 
            ref={terminalOutputRef}
            className="bg-black/60 p-6 overflow-y-auto flex-1 custom-scrollbar select-text"
          >
          
          {/* Terminal history */}
          <div>
            {history.map((row, index) => {
              // Runtime check for legacy state (HMR support)
              // If row is not an array (old state), wrap it in an array
              const segments = Array.isArray(row) ? row : [row as any];
              
              return (
                <div key={index} className="mb-1 font-mono whitespace-pre-wrap break-words typing-line">
                  {segments.map((segment, segIndex) => (
                    <span
                      key={segIndex}
                      className={segment.className} // Apply margin classes
                      style={{
                        color: segment.color || "#00ff00",
                        fontStyle: segment.italic ? "italic" : "normal",
                      }}
                    >
                      {segment.text}
                    </span>
                  ))}
                </div>
              );
            })}
            
            {/* Animated Typing Line */}
            {typingLine.length > 0 && (
              <div className="mb-1 font-mono whitespace-pre-wrap break-words">
                {typingLine.map((segment, segIndex) => (
                  <span
                    key={segIndex}
                    className={segment.className}
                    style={{
                      color: segment.color || "#00ff00",
                      fontStyle: segment.italic ? "italic" : "normal",
                    }}
                  >
                    {segment.text}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* Input line - Only show when story animation is finished or paused at chapter end */}
          {!loading && ((storyQueue.length === 0) || chapterEndPause) && !fullLineTarget && (
            <div className="bg-black/60 border-t border-[#2d2d2d] px-6 py-4">
              <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <span className="whitespace-nowrap text-white">
                  {passwordPrompt?.active 
                    ? `${passwordPrompt.user}@${passwordPrompt.server.hostname || passwordPrompt.server.ip}'s password: ` 
                    : `${remoteUser || user}@${hostname}:${currentDirectory}$ `}
                </span>
                <input
                  type={passwordPrompt?.active ? "password" : "text"}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-transparent text-white outline-none border-none font-mono"
                  autoFocus
                  spellCheck={false}
                  autoComplete="off"
                />
              </form>
            </div>
          )}
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
              transition: 'width 0.2s, height 0.2s',
              borderRadius: '8px'
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
                       <div className="absolute top-2 right-2 w-5 h-5 bg-green-500 text-black rounded-full flex items-center justify-center text-[10px] font-bold">
                         <FaCheck />
                       </div>
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


      </main>
      
      {/* Taskbar - Shows open windows */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-40">
        <div className="bg-white/10 backdrop-blur-2xl rounded-2xl px-3 py-2 border border-white/20 shadow-2xl">
          <div className="flex items-end gap-2">
            {/* Exit Button */}
            <div 
              onClick={() => router.push('/?stage=desktop')}
              className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-700 rounded-xl flex items-center justify-center text-white text-xl hover:scale-110 transition-transform cursor-pointer relative group"
              title="Exit Level"
            >
              <FaPowerOff />
            </div>

            {/* Separator */}
            <div className="w-1 h-10 bg-white/30 rounded-full mx-1"></div>

            {/* Terminal Window in Taskbar */}
            <div 
              onClick={() => windows.terminal.isOpen ? (windows.terminal.isMinimized ? restoreWindow('terminal') : minimizeWindow('terminal')) : openWindow('terminal')}
              className="w-12 h-12 bg-gradient-to-br from-gray-700 to-gray-900 rounded-xl flex items-center justify-center text-white text-xl hover:scale-110 transition-transform cursor-pointer relative group"
              title="Terminal"
            >
              <FaTerminal />

            </div>

            {/* Notes Window in Taskbar */}
            <div 
              onClick={() => windows.notes.isOpen ? (windows.notes.isMinimized ? restoreWindow('notes') : minimizeWindow('notes')) : openWindow('notes')}
              className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-xl flex items-center justify-center text-white text-xl hover:scale-110 transition-transform cursor-pointer relative group"
              title="Notes"
            >
              <FaStickyNote />

            </div>

            {/* Separator before settings */}
            <div className="w-1 h-10 bg-white/30 rounded-full mx-1"></div>
            
            {/* Settings Button */}
            <div 
              onClick={() => windows.settings.isOpen ? (windows.settings.isMinimized ? restoreWindow('settings') : minimizeWindow('settings')) : openWindow('settings')}
              className="w-12 h-12 bg-gradient-to-br from-gray-600 to-gray-800 rounded-xl flex items-center justify-center text-white text-xl hover:scale-110 transition-transform cursor-pointer relative group"
              title="Settings"
            >
              <FaCog />
            </div>
          </div>
        </div>
      </div>

      <PhoneBar
        phoneOpen={phoneOpen}
        setPhoneOpen={setPhoneOpen}
        setPhoneActiveApp={setPhoneActiveApp}
        phoneConfig={levelMeta?.phone}
      />

      <PhonePanel
        phoneOpen={phoneOpen}
        setPhoneOpen={setPhoneOpen}
        phoneActiveApp={phoneActiveApp}
        setPhoneActiveApp={setPhoneActiveApp}
        phoneConfig={levelMeta?.phone}
      />
    </div>
  );
}
