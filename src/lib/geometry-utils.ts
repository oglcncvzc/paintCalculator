export interface CupDimensions {
    type: 'cylinder' | 'conical';
    height: number; // cm
    topDiameter: number; // cm
    bottomDiameter: number; // cm (same as top for cylinder)
}

export interface PaintProperties {
    thickness: number; // microns (µm)
    density: number; // g/cm³ (specific gravity)
    wastePercentage: number; // %
}

export function calculateSurfaceArea(dimensions: CupDimensions): number {
    const { height, topDiameter, bottomDiameter, type } = dimensions;
    const r1 = topDiameter / 2;
    const r2 = type === 'cylinder' ? r1 : bottomDiameter / 2;

    // Side Surface Area
    // Cylinder: 2 * pi * r * h
    // Conical Frustum: pi * (r1 + r2) * s

    if (type === 'cylinder') {
        return 2 * Math.PI * r1 * height;
    } else {
        const s = Math.sqrt(Math.pow(r1 - r2, 2) + Math.pow(height, 2));
        return Math.PI * (r1 + r2) * s;
    }
}

export function calculatePaintUsage(
    surfaceArea: number, // cm²
    coveragePercentage: number, // % (0-100)
    properties: PaintProperties
) {
    // Effective Area
    const effectiveArea = surfaceArea * (coveragePercentage / 100);

    // Volume in cm³ (ml)
    // Thickness is in microns. 1 micron = 0.0001 cm
    const thicknessCm = properties.thickness / 10000;
    const volumeCm3 = effectiveArea * thicknessCm;

    // Weight in grams
    // Mass = Volume * Density
    const weightGrams = volumeCm3 * properties.density;

    // Add waste
    const totalWeight = weightGrams * (1 + properties.wastePercentage / 100);

    return {
        effectiveArea,
        volumeCm3,
        weightGrams,
        totalWeight
    };
}
