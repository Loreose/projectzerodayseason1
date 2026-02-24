import { NextResponse } from "next/server";
import { readdir, readFile } from "fs/promises";
import path from "path";

export async function GET() {
  try {
    const episodesDir = path.join(process.cwd(), "episodes");
    
    // Read all folders in episodes directory
    const entries = await readdir(episodesDir, { withFileTypes: true });
    const episodeFolders = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    // Load meta.json from each episode folder
    const allEpisodes = [];
    for (const folder of episodeFolders) {
      try {
        const metaPath = path.join(episodesDir, folder, "meta.json");
        const content = await readFile(metaPath, "utf-8");
        const meta = JSON.parse(content);
        
        // Add folder name to the metadata for easy reference
        allEpisodes.push({
          ...meta,
          folderName: folder,
        });
      } catch (error) {
        console.error(`Error loading episode ${folder}:`, error);
        // Skip episodes that don't have valid meta.json
        continue;
      }
    }

    // Sort episodes by ID
    allEpisodes.sort((a, b) => a.id - b.id);

    return NextResponse.json(allEpisodes);
  } catch (error) {
    console.error("Error loading episodes:", error);
    return NextResponse.json(
      { error: "Failed to load episodes" },
      { status: 500 }
    );
  }
}
