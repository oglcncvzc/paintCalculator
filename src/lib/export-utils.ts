import jsPDF from "jspdf";
import JSZip from "jszip";
import { ExtractedColor } from "./image-processing";
import { PaintProperties } from "./geometry-utils";

interface ReportData {
    fileName: string;
    imageElement: HTMLImageElement;
    colors: ExtractedColor[];
    surfaceArea: number;
    properties: PaintProperties;
}

export async function generatePdfReport(data: ReportData) {
    const doc = new jsPDF();
    const { fileName, imageElement, colors, surfaceArea, properties } = data;

    // Header
    doc.setFontSize(20);
    doc.text("Boya Hesaplama Raporu", 20, 20);

    doc.setFontSize(10);
    doc.text(`Dosya: ${fileName}`, 20, 30);
    doc.text(`Tarih: ${new Date().toLocaleDateString("tr-TR")}`, 20, 35);

    // Image Preview
    // Calculate aspect ratio to fit in 100x100 box
    const maxWidth = 100;
    const maxHeight = 80;
    let w = imageElement.width;
    let h = imageElement.height;
    const ratio = Math.min(maxWidth / w, maxHeight / h);
    w = w * ratio;
    h = h * ratio;

    // Draw image
    // We need base64 data url. If imageElement.src is blob, we might need to draw to canvas first.
    const canvas = document.createElement("canvas");
    canvas.width = imageElement.width;
    canvas.height = imageElement.height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
        ctx.drawImage(imageElement, 0, 0);
        const imgData = canvas.toDataURL("image/jpeg", 0.8);
        doc.addImage(imgData, "JPEG", 20, 45, w, h);
    }

    let yPos = 45 + h + 20;

    // Summary
    doc.setFontSize(14);
    doc.text("Özet", 20, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.text(`Toplam Yüzey Alanı: ${surfaceArea.toFixed(1)} cm²`, 20, yPos);
    yPos += 5;
    doc.text(`Boya Kalınlığı: ${properties.thickness} µm`, 20, yPos);
    yPos += 5;
    doc.text(`Fire Payı: ${properties.wastePercentage}%`, 20, yPos);
    yPos += 15;

    // Colors Table
    doc.setFontSize(14);
    doc.text("Renk Dağılımı", 20, yPos);
    yPos += 10;

    const headers = ["Pantone", "Hex", "Kaplama %", "Tahmini Ağırlık (g)", "Tahmini Hacim (ml)"];
    const colWidths = [40, 30, 30, 35, 35];
    let xPos = 20;

    // Draw Headers
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    headers.forEach((header, i) => {
        doc.text(header, xPos, yPos);
        xPos += colWidths[i];
    });
    yPos += 2;
    doc.line(20, yPos, 190, yPos);
    yPos += 8;

    // Draw Rows
    doc.setFont("helvetica", "normal");
    colors.forEach((color) => {
        // Recalculate usage here or pass it in. 
        // Ideally we pass the full calculated object, but for now we re-calc or assume it's attached.
        // Since ExtractedColor doesn't have usage, we need to calculate it or update the type.
        // For simplicity, let's just use the percentage to calc on fly or assume caller passed enriched data.
        // But `colors` is `ExtractedColor[]`.
        // Let's import calculatePaintUsage to be safe.
        const { calculatePaintUsage } = require("./geometry-utils");
        const usage = calculatePaintUsage(surfaceArea, color.percentage, properties);

        xPos = 20;
        doc.text(color.pantone.code, xPos, yPos); xPos += colWidths[0];
        doc.text(color.hex, xPos, yPos); xPos += colWidths[1];
        doc.text(`${color.percentage.toFixed(1)}%`, xPos, yPos); xPos += colWidths[2];
        doc.text(`${usage.totalWeight.toFixed(2)}`, xPos, yPos); xPos += colWidths[3];
        doc.text(`${usage.volumeCm3.toFixed(2)}`, xPos, yPos); xPos += colWidths[4];

        yPos += 7;
    });

    doc.save("boya-raporu.pdf");
}

export async function generateSeparationsZip(imageElement: HTMLImageElement, colors: ExtractedColor[]) {
    const zip = new JSZip();
    const canvas = document.createElement("canvas");
    canvas.width = imageElement.width;
    canvas.height = imageElement.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(imageElement, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Create a mask for each color
    const masks: Uint8ClampedArray[] = colors.map(() => new Uint8ClampedArray(canvas.width * canvas.height * 4));

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a < 128) {
            // Transparent - leave all masks transparent (0,0,0,0 is default)
            continue;
        }

        // Find closest color
        let closestIndex = 0;
        let minDistance = Infinity;

        for (let j = 0; j < colors.length; j++) {
            const targetRgb = colors[j].rgb;
            const dist = Math.sqrt(
                Math.pow(r - targetRgb[0], 2) +
                Math.pow(g - targetRgb[1], 2) +
                Math.pow(b - targetRgb[2], 2)
            );
            if (dist < minDistance) {
                minDistance = dist;
                closestIndex = j;
            }
        }

        // Assign to closest color's mask
        // We want black (ink) on transparent background? Or white?
        // Usually separations are black ink on white/transparent.
        // Let's stick to the previous format: Black (0,0,0,255) for match.
        const maskData = masks[closestIndex];
        maskData[i] = 0;
        maskData[i + 1] = 0;
        maskData[i + 2] = 0;
        maskData[i + 3] = 255;
    }

    // Create canvases and add to zip
    for (let j = 0; j < colors.length; j++) {
        const maskCanvas = document.createElement("canvas");
        maskCanvas.width = canvas.width;
        maskCanvas.height = canvas.height;
        const maskCtx = maskCanvas.getContext("2d");
        if (!maskCtx) continue;

        const maskImageData = maskCtx.createImageData(canvas.width, canvas.height);
        maskImageData.data.set(masks[j]);
        maskCtx.putImageData(maskImageData, 0, 0);

        const dataUrl = maskCanvas.toDataURL("image/png");
        const svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <image width="${canvas.width}" height="${canvas.height}" xlink:href="${dataUrl}"/>
</svg>`;

        const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
        zip.file(`${colors[j].pantone.code.replace(/\s+/g, '_')}.svg`, blob);
    }

    const content = await zip.generateAsync({ type: "blob" });

    // Trigger download
    const link = document.createElement("a");
    link.href = URL.createObjectURL(content);
    link.download = "separations.zip";
    link.click();
}

export async function generateSingleSeparation(
    imageElement: HTMLImageElement,
    color: ExtractedColor,
    allColors: ExtractedColor[],
    format: 'png' | 'svg' = 'png'
) {
    const canvas = document.createElement("canvas");
    canvas.width = imageElement.width;
    canvas.height = imageElement.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(imageElement, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = canvas.width;
    maskCanvas.height = canvas.height;
    const maskCtx = maskCanvas.getContext("2d");
    if (!maskCtx) return;

    const maskImageData = maskCtx.createImageData(canvas.width, canvas.height);
    const maskData = maskImageData.data;

    // Find closest color for each pixel (Global assignment logic)
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a < 128) {
            continue; // Transparent
        }

        let closestIndex = 0;
        let minDistance = Infinity;

        for (let j = 0; j < allColors.length; j++) {
            const targetRgb = allColors[j].rgb;
            const dist = Math.sqrt(
                Math.pow(r - targetRgb[0], 2) +
                Math.pow(g - targetRgb[1], 2) +
                Math.pow(b - targetRgb[2], 2)
            );
            if (dist < minDistance) {
                minDistance = dist;
                closestIndex = j;
            }
        }

        // If this pixel belongs to the requested color
        if (allColors[closestIndex] === color) {
            maskData[i] = 0;
            maskData[i + 1] = 0;
            maskData[i + 2] = 0;
            maskData[i + 3] = 255;
        } else {
            // Transparent
            maskData[i] = 0;
            maskData[i + 1] = 0;
            maskData[i + 2] = 0;
            maskData[i + 3] = 0;
        }
    }

    maskCtx.putImageData(maskImageData, 0, 0);

    const link = document.createElement("a");
    const filename = `${color.pantone.code.replace(/\s+/g, '_')}`;

    if (format === 'svg') {
        const dataUrl = maskCanvas.toDataURL("image/png");
        const svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <image width="${canvas.width}" height="${canvas.height}" xlink:href="${dataUrl}"/>
</svg>`;
        const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
        link.href = URL.createObjectURL(blob);
        link.download = `${filename}.svg`;
    } else {
        const blob = await new Promise<Blob | null>(resolve => maskCanvas.toBlob(resolve, "image/png"));
        if (!blob) return;
        link.href = URL.createObjectURL(blob);
        link.download = `${filename}.png`;
    }

    link.click();
}
