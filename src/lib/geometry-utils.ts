export interface CupDimensions {
    type: 'cylinder' | 'conical';
    height: number; // mm
    topDiameter: number; // mm
    bottomDiameter: number; // mm (same as top for cylinder)
}

export interface PaintProperties {
    thickness: number; // microns (µm)
    density: number; // g/cm³ (specific gravity)
    wastePercentage: number; // %
}

/**
 * Calculates surface area in mm2
 */
export function calculateSurfaceArea(dimensions: CupDimensions): number {
    const { height, topDiameter, bottomDiameter, type } = dimensions;
    const r1 = topDiameter / 2;
    const r2 = type === 'cylinder' ? r1 : bottomDiameter / 2;

    // Side Surface Area (mm2)
    if (type === 'cylinder') {
        return 2 * Math.PI * r1 * height;
    } else {
        const s = Math.sqrt(Math.pow(r1 - r2, 2) + Math.pow(height, 2));
        return Math.PI * (r1 + r2) * s;
    }
}

export function calculatePaintUsage(
    surfaceAreaMm2: number, // mm²
    coveragePercentage: number, // % (0-100)
    katSayisi: number
) {
    const effectiveAreaMm2 = surfaceAreaMm2 * (coveragePercentage / 100);
    const weightGrams = effectiveAreaMm2 * katSayisi;

    return {
        effectiveAreaMm2,
        weightGrams
    };
}
