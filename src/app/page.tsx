"use client";

import React, { useState, useRef } from "react";
import { FileUpload } from "@/components/FileUpload";
import { ImagePreview } from "@/components/ImagePreview";
import { ColorPalette } from "@/components/ColorPalette";
import { CalculatorForm } from "@/components/CalculatorForm";
import { ResultsSummary } from "@/components/ResultsSummary";
import { Palette, Calculator, FileOutput, ArrowRight, Loader2, Download, FileText, Settings } from "lucide-react";
import { extractColorsFromImage, calculateColorCoverage, ExtractedColor } from "@/lib/image-processing";
import { PaintProperties } from "@/lib/geometry-utils";
import { generatePdfReport, generateSeparationsZip } from "@/lib/export-utils";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [colors, setColors] = useState<ExtractedColor[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Refinement Options
  const [ignoreBackground, setIgnoreBackground] = useState(false);

  const [surfaceArea, setSurfaceArea] = useState<number>(0);
  const [paintProperties, setPaintProperties] = useState<PaintProperties>({
    thickness: 20,
    density: 1.2,
    wastePercentage: 10
  });

  const [history, setHistory] = useState<ExtractedColor[][]>([]);

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setColors([]);
    setHistory([]);
    setPreviewUrl(URL.createObjectURL(selectedFile));
  };

  const handleClear = () => {
    setFile(null);
    setColors([]);
    setHistory([]);
    setPreviewUrl(null);
  };

  const handleAnalyze = async () => {
    if (!file || !previewUrl) return;

    setIsAnalyzing(true);
    try {
      // 1. Load Image
      const img = new Image();
      img.src = previewUrl;
      await new Promise((resolve) => { img.onload = resolve; });

      // 2. Draw to Canvas (to convert SVG to PNG and resize if needed)
      const canvas = document.createElement("canvas");
      // Limit max dimension to 1000px for performance if needed, or keep original
      // Keeping original for now to ensure quality
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas context");

      // Fill white background first (for transparent SVGs)
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      // 3. Convert to Blob (PNG)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Failed to create image blob");

      // 4. Send to API
      const formData = new FormData();
      formData.append("file", blob, "image.png"); // Send as png
      formData.append("ignoreBackground", ignoreBackground.toString());

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Analysis failed");
      }

      const data = await response.json();

      // Map Python result to ExtractedColor interface
      if (data.kmeans && data.kmeans.colors) {
        const mappedColors: ExtractedColor[] = data.kmeans.colors.map((c: any) => ({
          rgb: c.rgb,
          hex: c.hex,
          pantone: {
            code: c.pantone.code,
            name: c.pantone.name,
            hex: c.hex, // Using the detected hex as approximation
            rgb: c.rgb
          },
          percentage: c.percentage
        }));
        setColors(mappedColors);
        setHistory([]); // Reset history on new analysis
      }

    } catch (error) {
      console.error("Analysis failed:", error);
      // TODO: Show error toast
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveToHistory = () => {
    setHistory(prev => [...prev, colors]);
  };

  const handleRemoveColor = (indexToRemove: number) => {
    saveToHistory();
    setColors(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleMergeColors = (sourceIndex: number, targetIndex: number) => {
    if (sourceIndex === targetIndex) return;

    saveToHistory();

    setColors(prev => {
      const newColors = [...prev];
      const sourceColor = newColors[sourceIndex];
      // Create a copy of the target color to avoid mutating the object in history
      const targetColor = { ...newColors[targetIndex] };

      // Update target color percentage
      targetColor.percentage += sourceColor.percentage;

      // Update the target color in the array
      newColors[targetIndex] = targetColor;

      // Remove source color
      return newColors.filter((_, index) => index !== sourceIndex);
    });
  };

  const handleUndo = () => {
    if (history.length === 0) return;

    const previousColors = history[history.length - 1];
    setColors(previousColors);
    setHistory(prev => prev.slice(0, -1));
  };

  const handleCalculate = (area: number, props: PaintProperties) => {
    setSurfaceArea(area);
    setPaintProperties(props);
  };

  const handleGenerateReport = async () => {
    if (!file || !previewUrl || colors.length === 0) return;

    const img = new Image();
    img.src = previewUrl;
    await new Promise((resolve) => { img.onload = resolve; });

    await generatePdfReport({
      fileName: file.name,
      imageElement: img,
      colors,
      surfaceArea,
      properties: paintProperties
    });
  };

  const handleDownloadSeparations = async () => {
    if (!file || !previewUrl || colors.length === 0) return;

    const img = new Image();
    img.src = previewUrl;
    await new Promise((resolve) => { img.onload = resolve; });

    await generateSeparationsZip(img, colors);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Palette className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">Dekor Görsel Renk Ayrımı</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Upload & Preview */}
          <div className="lg:col-span-8 space-y-6">
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold tracking-tight">Proje Dosyaları</h2>

              {!file ? (
                <FileUpload onFileSelect={handleFileSelect} className="h-64" />
              ) : (
                <div className="space-y-6">
                  <ImagePreview file={file} onClear={handleClear} />

                  {/* Analysis Actions */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
                      <Settings className="w-4 h-4 text-gray-500" />
                      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={ignoreBackground}
                          onChange={(e) => setIgnoreBackground(e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>Arkaplanı Yoksay</span>
                      </label>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={handleAnalyze}
                        disabled={isAnalyzing}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                      >
                        {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Palette className="w-4 h-4" />}
                        {isAnalyzing ? "Analiz Ediliyor..." : "Analiz Et"}
                      </button>
                      <button
                        onClick={handleDownloadSeparations}
                        disabled={colors.length === 0}
                        className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 dark:text-gray-100 px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Ayrıştırmaları İndir
                      </button>
                    </div>
                  </div>

                  {/* Results */}
                  <ColorPalette
                    colors={colors}
                    isLoading={isAnalyzing}
                    onRemove={handleRemoveColor}
                    onMerge={handleMergeColors}
                    onUndo={handleUndo}
                    canUndo={history.length > 0}
                    onDownload={(color) => {
                      const img = new Image();
                      if (previewUrl) {
                        img.src = previewUrl;
                        img.onload = () => {
                          import("@/lib/export-utils").then(mod => {
                            mod.generateSingleSeparation(img, color, colors, "svg");
                          });
                        };
                      }
                    }}
                  />
                </div>
              )}
            </section>
          </div>

          {/* Right Column: Summary / Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            <CalculatorForm onCalculate={handleCalculate} />

            {colors.length > 0 && (
              <ResultsSummary
                colors={colors}
                surfaceArea={surfaceArea}
                properties={paintProperties}
              />
            )}

            {colors.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={handleGenerateReport}
                  className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  PDF Raporu Oluştur
                  <FileText className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
