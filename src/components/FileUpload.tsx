"use client";

import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileImage } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
    onFileSelect: (file: File) => void;
    className?: string;
}

export function FileUpload({ onFileSelect, className }: FileUploadProps) {
    const onDrop = useCallback(
        (acceptedFiles: File[]) => {
            if (acceptedFiles.length > 0) {
                onFileSelect(acceptedFiles[0]);
            }
        },
        [onFileSelect]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            "image/*": [".png", ".jpg", ".jpeg", ".svg", ".webp"],
        },
        multiple: false,
    });

    return (
        <div
            {...getRootProps()}
            className={cn(
                "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors duration-200 ease-in-out flex flex-col items-center justify-center gap-4",
                isDragActive
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-300 hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-600",
                className
            )}
        >
            <input {...getInputProps()} />
            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full">
                {isDragActive ? (
                    <FileImage className="w-8 h-8 text-blue-500" />
                ) : (
                    <Upload className="w-8 h-8 text-gray-500 dark:text-gray-400" />
                )}
            </div>
            <div className="space-y-1">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {isDragActive ? "Drop the file here" : "Click or drag file to upload"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    SVG, PNG, JPG or WEBP (max 10MB)
                </p>
            </div>
        </div>
    );
}
