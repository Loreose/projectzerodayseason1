import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ folder: string; file: string }> }
) {
  try {
    // Await params in Next.js 15+
    const { folder, file } = await context.params;

    // Validate file names to prevent path traversal
    const validFiles = ["meta", "tasks", "story", "fileSettings"];

    if (!validFiles.includes(file)) {
      return NextResponse.json(
        { error: "Invalid file" },
        { status: 400 }
      );
    }

    // Map file parameter to actual filename
    const fileMap: { [key: string]: string } = {
      meta: "meta.json",
      tasks: "tasks.json",
      story: "story.log",
      fileSettings: "fileSettings.json",
    };

    const filename = fileMap[file];
    const episodesDir = path.join(process.cwd(), "episodes");
    const filePath = path.join(episodesDir, folder, filename);

    // Read the file
    const content = await readFile(filePath, "utf-8");

    // Return JSON files as JSON, story.log as text
    if (file === "story") {
      return new NextResponse(content, {
        headers: {
          "Content-Type": "text/plain",
        },
      });
    } else {
      return NextResponse.json(JSON.parse(content));
    }
  } catch (error) {
    console.error("Error loading episode file:", error);
    return NextResponse.json(
      { error: "Failed to load episode file", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
