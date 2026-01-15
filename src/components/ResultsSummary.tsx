"use client";

import React from "react";
import { ExtractedColor, CalculationResult } from "@/lib/image-processing";
import { Droplet, DollarSign, Scale } from "lucide-react";

interface ResultsSummaryProps {
    colors: ExtractedColor[];
    width: number;
    height: number;
    katSayisi: number;
    calculationResult?: CalculationResult | null;
}

export function ResultsSummary({ colors, width, height, katSayisi, calculationResult }: ResultsSummaryProps) {
    if (colors.length === 0) return null;

    // Reporting from dimensions logic
    const totalAreaMm2 = width * height;
    const currentAreaCm2 = totalAreaMm2 / 100;

    const totalUsage = colors.map(color => {
        // Fallback local weight calculation: (Area_mm2 * Percentage/100 * KatSayisi)
        const localWeight = totalAreaMm2 * (color.percentage / 100) * katSayisi;
        return { ...color, localWeight };
    });

    // Use backend results if available
    const totalWeight = calculationResult ? calculationResult.total_paint_grams : totalUsage.reduce((acc, curr) => acc + curr.localWeight, 0);
    const displaySurfaceAreaCm2 = calculationResult ? calculationResult.total_area_mm2 / 100 : currentAreaCm2;

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Main Stats Card */}
            <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 to-gray-800 dark:from-blue-600 dark:to-blue-700 rounded-2xl p-6 text-white shadow-xl">
                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <p className="text-blue-100/70 text-xs font-bold uppercase tracking-wider mb-1">Toplam Boya İhtiyacı</p>
                            <h3 className="text-4xl font-black italic tracking-tight">
                                {totalWeight.toFixed(6)}
                                <span className="text-xl ml-1 opacity-70">g</span>
                            </h3>
                        </div>
                        {calculationResult && (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-green-400/20 backdrop-blur-sm rounded-lg border border-green-400/30">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                <span className="text-[10px] font-bold text-green-100 uppercase tracking-tighter">Hassas Hesaplama</span>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/10 rounded-lg">
                                <Scale className="w-4 h-4 text-blue-200" />
                            </div>
                            <div>
                                <p className="text-blue-100/50 text-[10px] font-bold uppercase">Net Alan</p>
                                <p className="text-sm font-bold">{displaySurfaceAreaCm2.toFixed(4)} cm²</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/10 rounded-lg">
                                <DollarSign className="w-4 h-4 text-blue-200" />
                            </div>
                            <div>
                                <p className="text-blue-100/50 text-[10px] font-bold uppercase">Kat Sayısı</p>
                                <p className="text-sm font-bold">{katSayisi.toFixed(8)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Decorative background circle */}
                <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
            </div>

            {/* Individual Colors List */}
            <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        <Droplet className="w-3 h-3" />
                        Renk Dağılımı
                    </h4>
                </div>

                <div className="grid gap-2">
                    {totalUsage.map((item, index) => {
                        // Find match in backend result if available
                        const backendColor = calculationResult?.colors.find(c => c.code === item.pantone.code);
                        const displayWeight = backendColor ? backendColor.paint_grams : item.localWeight;
                        const displayPercentage = backendColor ? backendColor.coverage_percentage : item.percentage;

                        return (
                            <div key={index} className="group relative bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-3 hover:shadow-md transition-all duration-300">
                                <div className="flex items-center gap-3 relative z-10">
                                    <div className="relative">
                                        <div
                                            className="w-12 h-12 rounded-lg shadow-inner border border-black/5"
                                            style={{ backgroundColor: item.hex }}
                                        />
                                        <div className="absolute -bottom-1 -right-1 bg-white dark:bg-gray-800 rounded-md px-1 py-0.5 text-[8px] font-black border border-gray-100 dark:border-gray-700 shadow-sm">
                                            #{item.hex.replace('#', '')}
                                        </div>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-black text-gray-900 dark:text-gray-100 truncate">
                                                {item.pantone.code}
                                            </span>
                                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                                                %{displayPercentage.toFixed(1)}
                                            </span>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-1000"
                                                style={{ width: `${displayPercentage}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="text-right pl-4 border-l border-gray-100 dark:border-gray-800">
                                        <p className="text-lg font-black italic text-gray-900 dark:text-gray-100 leading-none">
                                            {displayWeight.toFixed(6)}
                                            <span className="text-[10px] ml-0.5 opacity-50 not-italic">g</span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
