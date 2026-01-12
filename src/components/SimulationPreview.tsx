"use client";

import React, { useEffect, useRef, useState } from "react";
import { ExtractedColor } from "@/lib/image-processing";
import { Eye, EyeOff, LayoutPanelLeft, RefreshCw } from "lucide-react";

interface SimulationPreviewProps {
    originalImage: string | null;
    colors: ExtractedColor[];
    isAnalyzing: boolean;
}

export function SimulationPreview({ originalImage, colors, isAnalyzing }: SimulationPreviewProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [showSimulation, setShowSimulation] = useState(true);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!originalImage || colors.length === 0 || !showSimulation) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        setIsLoading(true);
        const img = new Image();
        img.src = originalImage;
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;

            // Draw original to get data
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            // Standard Simulation: Nearest Neighbor with Source RGB
            // This maps every pixel to the nearest color in our palette (specifically the Extracted RGB).
            // This provides a smooth, "posterized" look that represents the k-means result accurately.
            // Using pantone.rgb can cause color shifts; using .rgb keeps it true to source analysis.

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const a = data[i + 3];

                if (a < 10) continue;

                // Find closest identity across all colors
                let minDist = Infinity;
                let winningColor = colors[0];

                for (const color of colors) {
                    // Check all identities this color "owns"
                    for (const repRgb of color.representativeRgbs) {
                        const dist = Math.pow(r - repRgb[0], 2) + Math.pow(g - repRgb[1], 2) + Math.pow(b - repRgb[2], 2);
                        if (dist < minDist) {
                            minDist = dist;
                            winningColor = color;
                        }
                    }
                }

                // Map to the Pantone RGB of the winning color
                data[i] = winningColor.rgb[0];
                data[i + 1] = winningColor.rgb[1];
                data[i + 2] = winningColor.rgb[2];
            }

            ctx.putImageData(imageData, 0, 0);
            setIsLoading(false);
        };
    }, [originalImage, colors, showSimulation]);

    if (!originalImage) return null;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <LayoutPanelLeft className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold">Baskı Simülasyonu & Karşılaştırma</h3>
                </div>
                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                    <button
                        onClick={() => setShowSimulation(false)}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${!showSimulation ? "bg-white dark:bg-gray-700 shadow-sm text-blue-600" : "text-gray-500"
                            }`}
                    >
                        Orijinal
                    </button>
                    <button
                        onClick={() => setShowSimulation(true)}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${showSimulation ? "bg-white dark:bg-gray-700 shadow-sm text-blue-600" : "text-gray-500"
                            }`}
                    >
                        Simülasyon
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Box 1: Reference */}
                <div className="relative aspect-video bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden group">
                    <div className="absolute top-3 left-3 z-10">
                        <span className="px-2 py-1 bg-black/50 backdrop-blur-md text-[10px] text-white rounded font-bold uppercase tracking-widest">Orijinal Görsel</span>
                    </div>
                    <img
                        src={originalImage}
                        alt="Original"
                        className="w-full h-full object-contain"
                    />
                </div>

                {/* Box 2: Result */}
                <div className="relative aspect-video bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden group">
                    <div className="absolute top-3 left-3 z-10">
                        <span className="px-2 py-1 bg-blue-600/80 backdrop-blur-md text-[10px] text-white rounded font-bold uppercase tracking-widest">Baskı Sonucu (Pantone)</span>
                    </div>
                    {isAnalyzing || isLoading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 dark:bg-black/50 backdrop-blur-sm z-20">
                            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-2" />
                            <span className="text-sm font-medium text-gray-600">Simüle Ediliyor...</span>
                        </div>
                    ) : colors.length === 0 ? (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm italic">
                            Analiz sonrası simülasyon burada görünecek
                        </div>
                    ) : null}
                    <canvas
                        ref={canvasRef}
                        className={`w-full h-full object-contain ${showSimulation ? "block" : "hidden"}`}
                    />
                    {!showSimulation && !isAnalyzing && (
                        <img
                            src={originalImage}
                            alt="Reference"
                            className="w-full h-full object-contain"
                        />
                    )}
                </div>
            </div>

            {colors.length > 0 && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/50 rounded-lg">
                    <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed font-medium">
                        * Bu simülasyon, seçilen Pantone renklerinin görsel üzerindeki dağılımını gösterir. Mercek altına almak istediğiniz renk farklarını buradan gözlemleyebilirsiniz.
                    </p>
                </div>
            )}
        </div>
    );
}
