"use client";

import React from "react";
import { ExtractedColor } from "@/lib/image-processing";
import { Check, Copy, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ColorPaletteProps {
    colors: ExtractedColor[];
    isLoading?: boolean;
    onRemove?: (index: number) => void;
}

export function ColorPalette({ colors, isLoading, onRemove }: ColorPaletteProps) {
    if (isLoading) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 animate-pulse">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-xl"></div>
                ))}
            </div>
        );
    }

    if (colors.length === 0) return null;

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                Extracted Palette
                <span className="text-xs font-normal text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                    {colors.length} Colors
                </span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {colors.map((color, index) => (
                    <div
                        key={index}
                        className="group relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                    >
                        {/* Remove Button */}
                        {onRemove && (
                            <button
                                onClick={() => onRemove(index)}
                                className="absolute top-2 right-2 z-20 p-1 bg-white/80 dark:bg-black/50 backdrop-blur-sm rounded-full hover:bg-red-50 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                title="Remove Color"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        )}

                        {/* Color Swatch */}
                        <div
                            className="h-24 w-full relative"
                            style={{ backgroundColor: color.hex }}
                        >
                            <div className="absolute inset-0 bg-gradient-to-b from-black/0 to-black/10" />
                            <div className="absolute bottom-2 right-2 bg-white/90 dark:bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded text-xs font-mono">
                                {color.percentage > 0 ? `${color.percentage.toFixed(1)}%` : ""}
                            </div>
                        </div>

                        {/* Details */}
                        <div className="p-3 space-y-2">
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wider">Pantone Match</p>
                                <p className="font-bold text-gray-900 dark:text-gray-100 truncate" title={color.pantone.name}>
                                    {color.pantone.code}
                                </p>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-gray-400">HEX</span>
                                    <span className="text-xs font-mono text-gray-600 dark:text-gray-300">{color.hex}</span>
                                </div>
                                <button
                                    onClick={() => navigator.clipboard.writeText(color.pantone.code)}
                                    className="text-gray-400 hover:text-blue-500 transition-colors"
                                    title="Copy Pantone Code"
                                >
                                    <Copy className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
