import { findNearestPantone, rgbToHex } from "./color-utils";
import { PantoneColor } from "./pantone-colors";

export interface ExtractedColor {
    rgb: [number, number, number];
    hex: string;
    pantone: PantoneColor;
    percentage: number;
}

export interface CoverageOptions {
    tolerance: number;
    ignoreWhite: boolean;
}

// Helper: Euclidean distance
function getRgbDistance(rgb1: [number, number, number], rgb2: [number, number, number]): number {
    return Math.sqrt(
        Math.pow(rgb2[0] - rgb1[0], 2) +
        Math.pow(rgb2[1] - rgb1[1], 2) +
        Math.pow(rgb2[2] - rgb1[2], 2)
    );
}

// Helper: RGB to HSV
function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, v = max;
    const d = max - min;
    s = max === 0 ? 0 : d / max;

    if (max !== min) {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h * 360, s, v];
}

// Simple K-Means Implementation with Deterministic Initialization
function kMeans(data: Uint8ClampedArray, k: number, maxIterations: number = 10): { centroids: [number, number, number][], assignments: number[] } {
    const pixels: [number, number, number][] = [];
    // Map to track frequency for initialization
    const colorCounts = new Map<string, number>();

    // 1. Sample pixels (every 4th pixel to speed up)
    for (let i = 0; i < data.length; i += 16) { // stride of 4 pixels (4 * 4 bytes)
        if (data[i + 3] < 128) continue; // Skip transparent
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        pixels.push([r, g, b]);

        // Quantize slightly for frequency map to group noise (5-bit color)
        const key = `${r & 0xF8},${g & 0xF8},${b & 0xF8}`;
        colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
    }

    if (pixels.length === 0) return { centroids: [], assignments: [] };

    // 2. Deterministic Initialization
    // Sort colors by frequency
    const sortedColors = Array.from(colorCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(entry => {
            const parts = entry[0].split(',').map(Number);
            return [parts[0], parts[1], parts[2]] as [number, number, number];
        });

    let centroids: [number, number, number][] = [];

    // Pick the most frequent color as first centroid
    if (sortedColors.length > 0) {
        centroids.push(sortedColors[0]);
    }

    // Pick remaining centroids: most frequent that is far enough from existing ones
    let colorIndex = 1;
    while (centroids.length < k && colorIndex < sortedColors.length) {
        const candidate = sortedColors[colorIndex];
        let isDistinct = true;

        for (const c of centroids) {
            if (getRgbDistance(candidate, c) < 60) { // Min distance to be a new seed
                isDistinct = false;
                break;
            }
        }

        if (isDistinct) {
            centroids.push(candidate);
        }
        colorIndex++;
    }

    let assignments = new Array(pixels.length).fill(0);

    for (let iter = 0; iter < maxIterations; iter++) {
        // Assignment Step
        let changes = 0;
        const newSums = centroids.map(() => [0, 0, 0]);
        const newCounts = centroids.map(() => 0);

        for (let i = 0; i < pixels.length; i++) {
            const p = pixels[i];
            let minDist = Infinity;
            let closestCentroid = 0;

            for (let c = 0; c < centroids.length; c++) {
                const dist = Math.pow(p[0] - centroids[c][0], 2) +
                    Math.pow(p[1] - centroids[c][1], 2) +
                    Math.pow(p[2] - centroids[c][2], 2);
                if (dist < minDist) {
                    minDist = dist;
                    closestCentroid = c;
                }
            }

            if (assignments[i] !== closestCentroid) {
                assignments[i] = closestCentroid;
                changes++;
            }

            newSums[closestCentroid][0] += p[0];
            newSums[closestCentroid][1] += p[1];
            newSums[closestCentroid][2] += p[2];
            newCounts[closestCentroid]++;
        }

        // Update Step
        for (let c = 0; c < centroids.length; c++) {
            if (newCounts[c] > 0) {
                centroids[c] = [
                    Math.round(newSums[c][0] / newCounts[c]),
                    Math.round(newSums[c][1] / newCounts[c]),
                    Math.round(newSums[c][2] / newCounts[c])
                ];
            }
        }

        if (changes === 0) break;
    }

    return { centroids, assignments };
}

export async function extractColorsFromImage(imageElement: HTMLImageElement, colorCount: number = 8): Promise<ExtractedColor[]> {
    // Use a canvas to get pixel data
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return [];

    // Resize for speed (max 200px dimension)
    const scale = Math.min(1, 200 / Math.max(imageElement.width, imageElement.height));
    canvas.width = imageElement.width * scale;
    canvas.height = imageElement.height * scale;

    ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Run K-Means
    // K=10 to catch enough distinct starting points
    const { centroids, assignments } = kMeans(imageData.data, 10);

    // Calculate counts for each centroid
    const counts = new Array(centroids.length).fill(0);
    assignments.forEach(a => counts[a]++);

    // Create cluster objects
    let clusters = centroids.map((rgb, index) => ({
        rgb,
        hsv: rgbToHsv(rgb[0], rgb[1], rgb[2]),
        count: counts[index],
        originalIndex: index
    }));

    // Sort by count (Descending) - Largest clusters first
    clusters.sort((a, b) => b.count - a.count);

    // HSV-BASED SMART MERGING
    const mergedClusters: typeof clusters = [];
    const backgroundCluster = clusters[0]; // Largest is background

    for (const current of clusters) {
        if (current.count === 0) continue;

        let merged = false;

        for (const target of mergedClusters) {
            // 1. Background Protection: If target is background, be strict (RGB distance)
            if (target === backgroundCluster) {
                if (getRgbDistance(current.rgb, target.rgb) < 30) {
                    target.count += current.count;
                    merged = true;
                    break;
                }
                continue;
            }

            // 2. HSV Merging for Details
            const hDiff = Math.abs(current.hsv[0] - target.hsv[0]);
            const hueDist = Math.min(hDiff, 360 - hDiff); // Wrap around 360

            // Check if both are "colored" (Saturation > 15%)
            const isColored = current.hsv[1] > 0.15 && target.hsv[1] > 0.15;

            if (isColored) {
                // If Hues are close (e.g. within 30 degrees), merge!
                if (hueDist < 30) {
                    target.count += current.count;
                    merged = true;
                    break;
                }
            } else {
                // One or both are grayscale. Merge if RGB is reasonably close (shades of gray)
                if (getRgbDistance(current.rgb, target.rgb) < 60) {
                    target.count += current.count;
                    merged = true;
                    break;
                }
            }
        }

        if (!merged) {
            mergedClusters.push(current);
        }
    }

    // Map to Pantone
    const extractedColors: ExtractedColor[] = mergedClusters.map((cluster) => {
        const pantone = findNearestPantone(cluster.rgb);
        return {
            rgb: cluster.rgb,
            hex: rgbToHex(cluster.rgb[0], cluster.rgb[1], cluster.rgb[2]),
            pantone,
            percentage: 0 // Will be calculated precisely later
        };
    });

    return extractedColors;
}

export function calculateColorCoverage(
    canvas: HTMLCanvasElement,
    targetColors: ExtractedColor[],
    options: CoverageOptions = { tolerance: 45, ignoreWhite: false }
): ExtractedColor[] {
    const ctx = canvas.getContext("2d");
    if (!ctx) return targetColors;

    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Add White if missing and not ignored
    let processedColors = [...targetColors];
    const hasWhite = processedColors.some(c => c.rgb[0] > 230 && c.rgb[1] > 230 && c.rgb[2] > 230);

    if (!options.ignoreWhite && !hasWhite) {
        const whitePantone = findNearestPantone([255, 255, 255]);
        processedColors.push({
            rgb: [255, 255, 255],
            hex: "#FFFFFF",
            pantone: whitePantone,
            percentage: 0
        });
    }

    const counts = new Array(processedColors.length).fill(0);
    let nonTransparentPixels = 0;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a < 128) continue; // Skip transparent
        nonTransparentPixels++;

        // If ignoreWhite is true, skip white-ish pixels
        if (options.ignoreWhite && r > 200 && g > 200 && b > 200) {
            continue;
        }

        // Find closest color
        let minDist = Infinity;
        let closestIndex = -1;

        for (let j = 0; j < processedColors.length; j++) {
            const targetRgb = processedColors[j].rgb;
            const dist = Math.sqrt(
                Math.pow(r - targetRgb[0], 2) +
                Math.pow(g - targetRgb[1], 2) +
                Math.pow(b - targetRgb[2], 2)
            );

            if (dist < minDist) {
                minDist = dist;
                closestIndex = j;
            }
        }

        if (closestIndex !== -1) {
            counts[closestIndex]++;
        }
    }

    // Filter out colors with very low coverage (noise)
    let result = processedColors.map((color, index) => ({
        ...color,
        percentage: (counts[index] / nonTransparentPixels) * 100
    })).filter(c => c.percentage > 2.0); // Filter out < 2.0% coverage

    // Normalize percentages to sum to 100%
    const totalPercentage = result.reduce((sum, c) => sum + c.percentage, 0);
    if (totalPercentage > 0) {
        result = result.map(c => ({
            ...c,
            percentage: (c.percentage / totalPercentage) * 100
        }));
    }

    // Re-sort by percentage desc
    return result.sort((a, b) => b.percentage - a.percentage);
}
