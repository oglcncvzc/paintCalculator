"use client";

import React from "react";
import { ExtractedColor } from "@/lib/image-processing";
import { PaintProperties, calculatePaintUsage } from "@/lib/geometry-utils";
import { Droplet, DollarSign, Scale } from "lucide-react";

interface ResultsSummaryProps {
    colors: ExtractedColor[];
    surfaceArea: number;
    properties: PaintProperties;
}

export function ResultsSummary({ colors, surfaceArea, properties }: ResultsSummaryProps) {
    if (colors.length === 0 || surfaceArea === 0) return null;

    const totalUsage = colors.map(color => {
        // If percentage is 0 (not calculated), assume equal distribution or just 0?
        // For now, if percentage is 0, we might want to warn or use a default.
        // But let's use the percentage from extraction.
        const usage = calculatePaintUsage(surfaceArea, color.percentage, properties);
        return { ...color, usage };
    });

    const totalWeight = totalUsage.reduce((acc, curr) => acc + curr.usage.totalWeight, 0);

    return (
        <div className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800">
                <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">Toplam Tahmini Kullanım</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-xs text-blue-600 dark:text-blue-300">Toplam Ağırlık</p>
                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-200">{totalWeight.toFixed(2)} g</p>
                    </div>
                    <div>
                        <p className="text-xs text-blue-600 dark:text-blue-300">Yüzey Alanı</p>
                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-200">{surfaceArea.toFixed(1)} cm²</p>
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Droplet className="w-4 h-4 text-gray-500" />
                    Renk Bazlı Dağılım
                </h4>
                <div className="space-y-2">
                    {totalUsage.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg">
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm"
                                    style={{ backgroundColor: item.hex }}
                                />
                                <div>
                                    <p className="text-sm font-medium">{item.pantone.code}</p>
                                    <p className="text-xs text-gray-500">{item.percentage.toFixed(1)}% Kaplama</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold">{item.usage.totalWeight.toFixed(3)} g</p>
                                <p className="text-xs text-gray-500">{item.usage.volumeCm3.toFixed(3)} ml</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
