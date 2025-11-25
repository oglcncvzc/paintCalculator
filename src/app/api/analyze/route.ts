import { NextRequest, NextResponse } from "next/server";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { v4 as uuidv4 } from "uuid";
import os from "os";

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        const ignoreBackground = formData.get("ignoreBackground") === "true";

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Save to temp directory
        const tempDir = os.tmpdir();
        const fileName = `${uuidv4()}-${file.name}`;
        const filePath = join(tempDir, fileName);

        await writeFile(filePath, buffer);

        // Run Python script
        // Assuming script is at src/scripts/color_analysis.py
        const scriptPath = join(process.cwd(), "src", "scripts", "color_analysis.py");

        // Command: python3 script.py image_path
        // We might need to handle arguments like width/height if passed, but for now defaults
        let command = `python3 "${scriptPath}" "${filePath}" --k-min 2 --k-max 10`;
        if (ignoreBackground) {
            command += " --ignore-background";
        }

        console.log("Executing:", command);

        const { stdout, stderr } = await execAsync(command);

        // Clean up temp file
        await unlink(filePath);

        if (stderr) {
            console.error("Python stderr:", stderr);
            // Some warnings might be in stderr, so we don't fail immediately unless stdout is empty or error
        }

        try {
            const result = JSON.parse(stdout);
            if (result.error) {
                return NextResponse.json({ error: result.error }, { status: 500 });
            }
            return NextResponse.json(result);
        } catch (e) {
            console.error("Failed to parse Python output:", stdout);
            return NextResponse.json({ error: "Failed to parse analysis result" }, { status: 500 });
        }

    } catch (error) {
        console.error("Analysis error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
