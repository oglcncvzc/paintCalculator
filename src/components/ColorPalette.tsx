"use client";

import React from "react";
import { ExtractedColor } from "@/lib/image-processing";
import { Check, Copy, X, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface ColorPaletteProps {
    colors: ExtractedColor[];
    isLoading?: boolean;
    onRemove?: (index: number) => void;
    onMerge?: (sourceIndex: number, targetIndex: number) => void;
    onUndo?: () => void;
    canUndo?: boolean;
    onDownload?: (color: ExtractedColor) => void;
}

export function ColorPalette({ colors, isLoading, onRemove, onMerge, onUndo, canUndo, onDownload }: ColorPaletteProps) {
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    const handleDragStart = (e: React.DragEvent, index: number) => {
        e.dataTransfer.setData("text/plain", index.toString());
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        setDragOverIndex(index);
    };

    const handleDragLeave = () => {
        setDragOverIndex(null);
    };

    const handleDrop = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        setDragOverIndex(null);
        const sourceIndex = parseInt(e.dataTransfer.getData("text/plain"));

        if (!isNaN(sourceIndex) && onMerge) {
            onMerge(sourceIndex, targetIndex);
        }
    };

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
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                    Çıkarılan Palet
                    <span className="text-xs font-normal text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                        {colors.length} Renk
                    </span>
                </h3>
                {onUndo && (
                    <button
                        onClick={onUndo}
                        disabled={!canUndo}
                        className="flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Undo2 className="w-4 h-4" />
                        Geri Al
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {colors.map((color, index) => (
                    <div
                        key={index}
                        draggable={!!onMerge}
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, index)}
                        className={cn(
                            "group relative bg-white dark:bg-gray-900 border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200",
                            dragOverIndex === index
                                ? "border-blue-500 ring-2 ring-blue-500/20 scale-105 z-10"
                                : "border-gray-200 dark:border-gray-800"
                        )}
                    >
                        {/* Remove Button */}
                        {onRemove && (
                            <button
                                onClick={() => onRemove(index)}
                                className="absolute top-2 right-2 z-20 p-1 bg-white/80 dark:bg-black/50 backdrop-blur-sm rounded-full hover:bg-red-50 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                title="Rengi Kaldır"
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
                                <p className="text-xs text-gray-500 uppercase tracking-wider">Pantone Eşleşmesi</p>
                                <p className="font-bold text-gray-900 dark:text-gray-100 truncate" title={color.pantone.name}>
                                    {color.pantone.code}
                                </p>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-gray-400">HEX</span>
                                    <span className="text-xs font-mono text-gray-600 dark:text-gray-300">{color.hex}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {onDownload && (
                                        <button
                                            onClick={() => onDownload(color)}
                                            className="text-gray-400 hover:text-blue-500 transition-colors p-1"
                                            title="SVG Ayrıştırmasını İndir"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-download"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
                                        </button>
                                    )}
                                    <button
                                        onClick={() => navigator.clipboard.writeText(color.pantone.code)}
                                        className="text-gray-400 hover:text-blue-500 transition-colors p-1"
                                        title="Pantone Kodunu Kopyala"
                                    >
                                        <Copy className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            {onMerge && (
                <p className="text-xs text-center text-gray-400 dark:text-gray-500 italic">
                    İpucu: Renkleri birleştirmek için sürükleyip bırakın.
                </p>
            )}
        </div>
    );
}
