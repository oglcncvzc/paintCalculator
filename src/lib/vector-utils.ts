import { imageToTracedata, getsvgstring } from 'imagetracerjs';
import { ExtractedColor } from './image-processing';

// Define options interface for ImageTracer
interface ImageTracerOptions {
    ltres?: number;
    qtres?: number;
    pathomit?: number;
    rightangleenhance?: boolean;
    colorsampling?: number;
    numberofcolors?: number;
    mincolorratio?: number;
    colorquantcycles?: number;
    layering?: number;
    strokewidth?: number;
    viewbox?: boolean;
    desc?: boolean;
    scale?: number;
    blurradius?: number;
    blurdelta?: number;
    pal?: { r: number; g: number; b: number; a: number }[];
    [key: string]: any;
}

export async function generateVectorSvg(
    imageElement: HTMLImageElement,
    targetIndex: number,
    allColors: ExtractedColor[]
): Promise<string> {
    return new Promise((resolve, reject) => {
        // 1. SETUP: UPSCALED MASK CANVAS
        // We upscale the original image 4x first to get smooth, interpolated edges.
        const scaleFactor = 4;
        const canvas = document.createElement('canvas');
        canvas.width = imageElement.width * scaleFactor;
        canvas.height = imageElement.height * scaleFactor;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            reject(new Error("Could not get canvas context"));
            return;
        }

        // Draw original image upscaled with interpolation
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const md = imageData.data;

        const targetColor = allColors[targetIndex];
        const targetR = targetColor.rgb[0];
        const targetG = targetColor.rgb[1];
        const targetB = targetColor.rgb[2];

        // 2. CREATE MASK AT HIGH RESOLUTION
        // This is the key: we classify pixels AFTER upscaling.
        // The interpolated pixels at the edges will naturally create smooth curves.
        for (let i = 0; i < md.length; i += 4) {
            const r = md[i];
            const g = md[i + 1];
            const b = md[i + 2];
            const a = md[i + 3];

            if (a < 128) {
                // Background -> White
                md[i] = 255; md[i + 1] = 255; md[i + 2] = 255; md[i + 3] = 255;
                continue;
            }

            // Optimization: check exact match first (happens often in flat areas)
            if (r === targetR && g === targetG && b === targetB) {
                md[i] = 0; md[i + 1] = 0; md[i + 2] = 0; md[i + 3] = 255;
                continue;
            }

            // Find closest color to determine if it belongs to our target group
            let closestIndex = 0;
            let minDistance = Infinity;

            for (let j = 0; j < allColors.length; j++) {
                const c = allColors[j].rgb;
                // Squared Euclidean distance
                const dist = Math.pow(r - c[0], 2) + Math.pow(g - c[1], 2) + Math.pow(b - c[2], 2);
                if (dist < minDistance) {
                    minDistance = dist;
                    closestIndex = j;
                }
            }

            if (closestIndex === targetIndex) {
                // Belong to target -> Black
                md[i] = 0; md[i + 1] = 0; md[i + 2] = 0; md[i + 3] = 255;
            } else {
                // Belong to others -> White
                md[i] = 255; md[i + 1] = 255; md[i + 2] = 255; md[i + 3] = 255;
            }
        }
        ctx.putImageData(imageData, 0, 0);

        const dataUrl = canvas.toDataURL('image/png');

        // 3. TRACE: Trace the high-resolution B/W mask
        const options: ImageTracerOptions = {
            ltres: 0.5, // Lower threshold for more detail on curves
            qtres: 0.5,
            pathomit: 4,
            rightangleenhance: false,
            colorsampling: 1,
            numberofcolors: 2,
            strokewidth: 0,
            viewbox: true,
            desc: false,
            scale: 1,
            blurradius: 0.5, // Slight internal smoothing to round off any remaining pixelation
            blurdelta: 20
        };

        imageToTracedata(dataUrl, (tracedata: any) => {
            if (!tracedata || !tracedata.layers) {
                reject(new Error("Trace data generation failed"));
                return;
            }

            // Generate SVG string
            const svgString = getsvgstring(tracedata, options);

            // POST-PROCESS: Remove white background and cleanup
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgString, "image/svg+xml");
            const svgElement = doc.documentElement;

            svgElement.setAttribute("width", imageElement.width.toString());
            svgElement.setAttribute("height", imageElement.height.toString());

            const allPaths = svgElement.querySelectorAll('path');
            allPaths.forEach(path => {
                const fill = path.getAttribute('fill');
                // The background is white. ffffff or rgb(255,255,255).
                if (fill && (fill.toLowerCase().includes('ffffff') || fill.includes('255,255,255') || fill === 'none')) {
                    path.remove();
                } else {
                    // This is our separation -> Force Black
                    path.setAttribute('fill', '#000000');
                    path.setAttribute('stroke', 'none');
                }
            });

            const serializer = new XMLSerializer();
            resolve(serializer.serializeToString(doc));
        }, options);
    });
}
