"use client";

import React, { useEffect, useRef } from "react";
import Image from "next/image";
import { X } from "lucide-react";

interface ImagePreviewProps {
    file: File | null;
    onClear: () => void;
}

export function ImagePreview({ file, onClear }: ImagePreviewProps) {
    const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

    useEffect(() => {
        if (!file) {
            setPreviewUrl(null);
            return;
        }

        const objectUrl = URL.createObjectURL(file);
        setPreviewUrl(objectUrl);

        return () => URL.revokeObjectURL(objectUrl);
    }, [file]);

    if (!file || !previewUrl) return null;

    return (
        <div className="relative group rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
            <div className="absolute top-2 right-2 z-10">
                <button
                    onClick={onClear}
                    className="p-1.5 bg-white/80 dark:bg-black/50 backdrop-blur-sm rounded-full hover:bg-white dark:hover:bg-black transition-colors text-gray-700 dark:text-gray-200 shadow-sm"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
            <div className="relative aspect-video w-full flex items-center justify-center p-4">
                {/* We use a standard img tag for SVG support and raw object URLs, 
            Next.js Image component requires width/height or fill, 
            but for arbitrary user uploads 'fill' with object-contain is best */}
                <div className="relative w-full h-full">
                    <Image
                        src={previewUrl}
                        alt="Preview"
                        fill
                        className="object-contain"
                        unoptimized // Needed for blob URLs sometimes or SVGs
                    />
                </div>
            </div>
            <div className="p-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-gray-500">
                    {(file.size / 1024).toFixed(1)} KB
                </p>
            </div>
        </div>
    );
}
