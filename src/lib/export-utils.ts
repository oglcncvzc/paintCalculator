import jsPDF from "jspdf";
import JSZip from "jszip";
import { ExtractedColor } from "./image-processing";
import { generateVectorSvg } from "./vector-utils";

interface ReportData {
    fileName: string;
    imageElement: HTMLImageElement;
    colors: ExtractedColor[];
    width: number;
    height: number;
    katSayisi: number;
}

export async function generatePdfReport(data: ReportData) {
    const doc = new jsPDF();
    const { fileName, imageElement, colors, width, height, katSayisi } = data;

    // Header
    doc.setFontSize(20);
    doc.text("Boya Hesaplama Raporu", 20, 20);

    doc.setFontSize(10);
    doc.text(`Dosya: ${fileName}`, 20, 30);
    doc.text(`Tarih: ${new Date().toLocaleDateString("tr-TR")}`, 20, 35);

    // Image Preview
    const maxWidth = 100;
    const maxHeight = 80;
    let w = imageElement.width;
    let h = imageElement.height;
    const ratio = Math.min(maxWidth / w, maxHeight / h);
    w = w * ratio;
    h = h * ratio;

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
    doc.text("Hassas Parametreler", 20, yPos);
    yPos += 10;

    const areaMm2 = width * height;
    doc.setFontSize(10);
    doc.text(`Resim Genişliği: ${width.toFixed(1)} mm`, 20, yPos);
    yPos += 5;
    doc.text(`Resim Yüksekliği: ${height.toFixed(1)} mm`, 20, yPos);
    yPos += 5;
    doc.text(`Desen Alanı: ${areaMm2.toFixed(4)} mm²`, 20, yPos);
    yPos += 5;
    doc.text(`Ağırlık Kat Sayısı: ${katSayisi.toFixed(8)}`, 20, yPos);
    yPos += 15;

    // Colors Table
    doc.setFontSize(14);
    doc.text("Renk Dağılımı", 20, yPos);
    yPos += 10;

    const headers = ["Pantone", "Hex", "Kaplama %", "Hesaplanan Ağırlık (g)"];
    const colWidths = [50, 40, 40, 50];
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
        const weight = areaMm2 * (color.percentage / 100) * katSayisi;

        xPos = 20;
        doc.text(color.pantone.code, xPos, yPos); xPos += colWidths[0];
        doc.text(color.hex, xPos, yPos); xPos += colWidths[1];
        doc.text(`${color.percentage.toFixed(1)}%`, xPos, yPos); xPos += colWidths[2];
        doc.text(`${weight.toFixed(6)}`, xPos, yPos); xPos += colWidths[3];

        yPos += 7;
    });

    doc.save("boya-raporu.pdf");
}

export async function generateSeparationsZip(imageElement: HTMLImageElement, colors: ExtractedColor[]) {
    const zip = new JSZip();

    for (let j = 0; j < colors.length; j++) {
        try {
            const svgContent = await generateVectorSvg(imageElement, j, colors);
            const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
            zip.file(`${colors[j].pantone.code.replace(/\s+/g, '_')}.svg`, blob);
        } catch (e) {
            console.error("Vector generation failed for color", colors[j], e);
        }
    }

    const content = await zip.generateAsync({ type: "blob" });
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
    const link = document.createElement("a");
    const filename = `${color.pantone.code.replace(/\s+/g, '_')}`;

    if (format === 'svg') {
        try {
            const targetIndex = allColors.indexOf(color);
            if (targetIndex === -1) throw new Error("Color not found in palette");

            const svgContent = await generateVectorSvg(imageElement, targetIndex, allColors);
            const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
            link.href = URL.createObjectURL(blob);
            link.download = `${filename}.svg`;
        } catch (e) {
            console.error("Vector generation failed", e);
            return;
        }
    } else {
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

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            if (a < 128) continue;

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

            if (allColors[closestIndex] === color) {
                maskData[i] = 0;
                maskData[i + 1] = 0;
                maskData[i + 2] = 0;
                maskData[i + 3] = 255;
            } else {
                maskData[i] = 0;
            }
        }

        maskCtx.putImageData(maskImageData, 0, 0);

        const blob = await new Promise<Blob | null>(resolve => maskCanvas.toBlob(resolve, "image/png"));
        if (!blob) return;
        link.href = URL.createObjectURL(blob);
        link.download = `${filename}.png`;
    }

    link.click();
}
