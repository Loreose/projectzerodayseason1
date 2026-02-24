// Level data types
import type { EpisodePhoneConfig } from "./phoneApps";

export interface LevelMeta {
  id: number;
  title: string;
  description: string;
  target: string;
  objectives?: string;
  objective?: string;
  folderName?: string;
  season?: number;
  episodeNumber?: number;
  vpnReq?: boolean;
  internal_ip?: string;
  /** Phone configuration for this episode — mirrors the `phone` block in meta.json */
  phone?: EpisodePhoneConfig;
}

export interface LevelTask {
  id: string;
  type: "command" | "submit" | "event";
  target: string; // The command string or the value to submit
  completed: boolean;
  required: boolean;
}

// Shared types between level loading and phone apps
import type { CryptoTransaction } from "./phoneApps";

export interface LevelTasks {
  tasks: LevelTask[];
}

export interface FileSystemEntry {
  name: string;
  content?: string;
  executable?: boolean;
  isDirectory?: boolean;
  locked?: boolean;
  files?: FileSystemEntry[];
  directories?: FileSystemEntry[]; // Added for explicit nested directories
}

export interface LevelFileSettings {
  fileSystem: {
    root: string;
    directories: FileSystemEntry[];
    files?: FileSystemEntry[];
    remoteServers?: Array<{
      name?: string;
      hostname: string;
      ip: string;
      services: string[];
      monitoring?: boolean | string;
      security?: string;
      threat_level?: string;
      htmlResponse?: string;
      user?: string;
      password?: string;
      internalOnly?: boolean;
      gateway?: string;
      fileSystem?: {
        root: string;
        directories: FileSystemEntry[];
        files?: FileSystemEntry[];
      };
    }>;
  };
}


/**
 * Load level metadata by folder name
 */
export async function loadLevelMeta(folderName: string): Promise<LevelMeta> {
  const response = await fetch(`/api/levels/${folderName}/meta`);
  if (!response.ok) {
    throw new Error(`Failed to load episode ${folderName} metadata`);
  }

  return response.json();
}

/**
 * Load level tasks by folder name
 */
export async function loadLevelTasks(folderName: string): Promise<LevelTasks> {
  const response = await fetch(`/api/levels/${folderName}/tasks`);
  if (!response.ok) {
    throw new Error(`Failed to load episode ${folderName} tasks`);
  }

  return response.json();
}

/**
 * Load level story by folder name
 */
export async function loadLevelStory(folderName: string): Promise<string> {
  const response = await fetch(`/api/levels/${folderName}/story`);
  if (!response.ok) {
    throw new Error(`Failed to load episode ${folderName} story`);
  }

  return response.text();
}

/**
 * Load level file settings by folder name
 */
export async function loadLevelFileSettings(
  folderName: string
): Promise<LevelFileSettings> {
  const response = await fetch(`/api/levels/${folderName}/fileSettings`);
  if (!response.ok) {
    throw new Error(`Failed to load episode ${folderName} file settings`);
  }

  return response.json();
}

/**
 * Load all level data at once by folder name
 */
export async function loadLevelData(folderName: string) {
  const [meta, tasks, story, fileSettings] = await Promise.all([
    loadLevelMeta(folderName),
    loadLevelTasks(folderName),
    loadLevelStory(folderName),
    loadLevelFileSettings(folderName),
  ]);

  return {
    meta,
    tasks,
    story,
    fileSettings,
  };
}

/**
 * Parse story log for display with color tags and inline styling
 * Converts story.log format into structured lines with colors
 * Supports tags: [CIPHER], [VIPER], [RAZOR], [NOVA], [GHOST], [GÖREV], [ECHO]
 * Supports inline styles: (text) -> Gray Italic
 */
// Updated interface to include className for spacing control
export interface StorySegment {
  text: string;
  color?: string;
  italic?: boolean;
  className?: string; // New property for margin/padding classes
  isChapterEnd?: boolean;
  taskId?: string; // Task ID required to resume story after chapter end
  isEpisodeEnd?: boolean;
  notification?: { app: string; message: string };
  transaction?: CryptoTransaction;
}

export function parseStoryLog(storyContent: string): Array<StorySegment[]> {
  const colorMap: Record<string, { color: string; lightColor: string }> = {
    'GÖREV': { color: '#73ff00ff', lightColor: '#afff6dff' },  
    'SYSTEM': { color: '#00ff00', lightColor: '#00ff00' },
    '{USER}': { color: '#00d9ff', lightColor: '#80ebff' },
    '{PC_NAME}': { color: '#00d9ff', lightColor: '#80ebff' }, 
    'SPEC': { color: '#bdc3c7', lightColor: '#ecf0f1' },
    'MEDUSA': { color: '#786effff', lightColor: '#a29bfe' },
    'GLITCH': { color: '#ff0000', lightColor: '#ff6666' },
    'STALKER': { color: '#e84393', lightColor: '#fd79a8' },  
    'NINE': { color: '#f1c40f', lightColor: '#f7dc6f' },  
    'DUCKY': { color: '#c67700ff', lightColor: '#ffba52ff' },   
    'TUCO': { color: '#880101ff', lightColor: '#d61f1fff' },
    'LEVAN': { color: '#880101ff', lightColor: '#d61f1fff' },  
    'ELIAS': { color: '#880101ff', lightColor: '#d61f1fff' },  
    'CHLOE': { color: '#880101ff', lightColor: '#d61f1fff' },  
    'GRIGORI': { color: '#880101ff', lightColor: '#d61f1fff' },
  };

  const lines = storyContent
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const result: Array<StorySegment[]> = [];
  let lastChapterEndIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check for [NOTIFY, app, message] pattern
    const notifyMatch = line.match(/^\[NOTIFY,\s*([^,]+),\s*(?:description:\s*)?["']?(.*?)["']?\]$/i);
    if (notifyMatch) {
      result.push([{
        text: "",
        notification: {
          app: notifyMatch[1].trim(),
          message: notifyMatch[2].trim()
        }
      }]);
      continue;
    }

    // Check for [ADDFUND, amount, title, fromTo] — using simple string check for reliability
    const upperLine = line.toUpperCase();
    if (upperLine.startsWith('[ADDFUND,') && line.endsWith(']')) {
      const inner = line.slice(1, -1); // strip [ and ]
      const parts = inner.split(',').map((p: string) => p.trim());
      if (parts.length >= 4) {
        const amount = parseFloat(parts[1]);
        const title = parts[2];
        const fromTo = parts.slice(3).join(',').trim();
        result.push([{
          text: "",
          transaction: {
            id: `tx-receive-${amount}-${title.replace(/\s+/g, '')}-${fromTo.replace(/\s+/g, '')}`,
            type: "receive",
            amount,
            title,
            fromTo
          }
        }]);
        continue;
      }
    }

    // Check for [SENDFUND, amount, title, fromTo] — using simple string check for reliability
    if (upperLine.startsWith('[SENDFUND,') && line.endsWith(']')) {
      const inner = line.slice(1, -1);
      const parts = inner.split(',').map((p: string) => p.trim());
      if (parts.length >= 4) {
        const amount = parseFloat(parts[1]);
        const title = parts[2];
        const fromTo = parts.slice(3).join(',').trim();
        result.push([{
          text: "",
          transaction: {
            id: `tx-send-${amount}-${title.replace(/\s+/g, '')}-${fromTo.replace(/\s+/g, '')}`,
            type: "send",
            amount,
            title,
            fromTo
          }
        }]);
        continue;
      }
    }

    // Check for [TASK:task_id] pattern
    const taskMatch = line.match(/^\[TASK:([^\]]+)\]$/);
    if (taskMatch) {
      const taskId = taskMatch[1];
      // Attach task ID to the last chapter end trigger
      if (lastChapterEndIndex >= 0 && result[lastChapterEndIndex]) {
        const chapterEndLine = result[lastChapterEndIndex];
        const chapterEndSegment = chapterEndLine.find(seg => seg.isChapterEnd);
        if (chapterEndSegment) {
          chapterEndSegment.taskId = taskId;
        }
      }
      // Don't add [TASK:task_id] to the output, it's metadata
      continue;
    }
    
    // Check if line starts with a tag like [CIPHER]:
    const tagMatch = line.match(/^\[([^\]]+)\]:\s*(.+)$/);
    
    if (tagMatch) {
      const tag = tagMatch[1].toUpperCase();
      const content = tagMatch[2];
      const colorInfo = colorMap[tag];
      
      if (colorInfo) {
        // Split by parenthesis groups like (text)
        // We want to capture the parentheses and content separately
        const parts = content.split(/(\([^\)]+\))/g);
        
        const segments: StorySegment[] = [
          { text: `[${tag}]: `, color: colorInfo.color, italic: false} // Add margin after tag
        ];

        // Filter and process parts first to create a clean list of segments
        const processableParts: { text: string; type: 'action' | 'dialogue' }[] = [];

        parts.forEach((part) => {
          if (!part) return; // Skip empty strings from split
          
          if (part.startsWith('(') && part.endsWith(')')) {
            // Action part
            const cleanPart = part.substring(1, part.length - 1).trim();
            if (cleanPart) {
              processableParts.push({ text: cleanPart, type: 'action' });
            }
          } else {
            // Dialogue part
            const cleanPart = part.trim();
            if (cleanPart) {
              processableParts.push({ text: cleanPart, type: 'dialogue' });
            }
          }
        });

        // Now construct the final segments using MARGINS for spacing
        // We don't add spaces to text string anymore
        // Now construct the final segments using dynamic spacing logic
        processableParts.forEach((part, index) => {
          let text = part.text;
          let prefix = "";

          if (index > 0) {
             // Add space before segment if it doesn't start with punctuation
             if (!/^[.,!?:;]/.test(text)) {
                prefix = " ";
             }
          }

          if (part.type === 'action') {
            segments.push({
              text: prefix + text,
              color: '#888888', // Gray for actions
              italic: true,
            });
          } else {
            segments.push({
              text: prefix + text,
              color: colorInfo.lightColor,
              italic: false
            });
          }
        });
        
        result.push(segments);
        continue;
      }
    }
    
    if (line === '[SAHNE SONU]') {
      lastChapterEndIndex = result.length;
      result.push([{
        text: '[SAHNE SONU]',
        color: '#ff0000',
        italic: false,
        className: 'font-bold',
        isChapterEnd: true,
      }]);
      continue;
    }
    
    // Check if line is italicized (surrounded by [ ])
    if (line.startsWith('[') && line.endsWith(']') && !line.includes(':')) {
      const cleanPart = line.substring(1, line.length - 1).trim();
      result.push([{
        text: cleanPart,
        color: '#aaaaaa',
        italic: true,
      }]);
      continue;
    }
    
    // Default color for untagged lines
    result.push([{
      text: line,
      color: '#cccccc',
    }]);
  }

  return result;
}
