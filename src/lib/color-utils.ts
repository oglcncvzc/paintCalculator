import { PANTONE_COLORS, PantoneColor } from "./pantone-colors";

// Calculate Euclidean distance between two colors in RGB space
function getColorDistance(rgb1: [number, number, number], rgb2: [number, number, number]): number {
    return Math.sqrt(
        Math.pow(rgb2[0] - rgb1[0], 2) +
        Math.pow(rgb2[1] - rgb1[1], 2) +
        Math.pow(rgb2[2] - rgb1[2], 2)
    );
}

export function findNearestPantone(rgb: [number, number, number]): PantoneColor {
    let minDistance = Infinity;
    let nearestColor = PANTONE_COLORS[0];

    for (const color of PANTONE_COLORS) {
        const distance = getColorDistance(rgb, color.rgb);
        if (distance < minDistance) {
            minDistance = distance;
            nearestColor = color;
        }
    }

    return nearestColor;
}

export function rgbToHex(r: number, g: number, b: number): string {
    return "#" + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    }).join("");
}

export function hexToRgb(hex: string): [number, number, number] | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ] : null;
}

export function getPantoneByCode(code: string): PantoneColor | undefined {
    // Normalize input: remove "PMS", "C", spaces, case-insensitive
    const normalizedInput = code.toUpperCase().replace(/PMS|C|\s/g, "");

    return PANTONE_COLORS.find(p => {
        const normalizedP = p.code.toUpperCase().replace(/PMS|C|\s/g, "");
        return normalizedP === normalizedInput;
    });
}
