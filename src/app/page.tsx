"use client";

import React, { useState, useRef } from "react";
import { FileUpload } from "@/components/FileUpload";
import { ImagePreview } from "@/components/ImagePreview";
import { ColorPalette } from "@/components/ColorPalette";
import { CalculatorForm } from "@/components/CalculatorForm";
import { ResultsSummary } from "@/components/ResultsSummary";
import { Palette, Calculator, FileOutput, ArrowRight, Loader2, Download, FileText, Settings } from "lucide-react";
import { extractColorsFromImage, calculateColorCoverage, ExtractedColor, createBlackMask, calculatePaintFromMasks } from "@/lib/image-processing";
import { PaintProperties } from "@/lib/geometry-utils";
import { generatePdfReport, generateSeparationsZip } from "@/lib/export-utils";
import { getPantoneByCode } from "@/lib/color-utils";
import { SimulationPreview } from "@/components/SimulationPreview";
import { API_BASE_URL } from "@/lib/config";
import { useEffect } from "react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [colors, setColors] = useState<ExtractedColor[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Refinement Options
  const [ignoreBackground, setIgnoreBackground] = useState(false);
  const [ignoreBlack, setIgnoreBlack] = useState(false);
  const [numColors, setNumColors] = useState(10);

  const [calculationProps, setCalculationProps] = useState({
    width: 182.0,
    height: 50.0,
    katSayisi: 0.00001,
    threshold: 30
  });

  const [history, setHistory] = useState<ExtractedColor[][]>([]);
  const [calculationResult, setCalculationResult] = useState<any>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setColors([]);
    setHistory([]);
    setCalculationResult(null);
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
    setCalculationResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file, file.name);
      formData.append("numColors", numColors.toString());
      formData.append("ignoreBackground", ignoreBackground.toString());
      formData.append("ignoreBlack", ignoreBlack.toString());

      const response = await fetch(`${API_BASE_URL}/api/analyze-colors-only`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Analysis failed");
      }

      const data = await response.json();

      if (data.success && data.colors) {
        const mappedColors: ExtractedColor[] = data.colors.map((c: any) => ({
          id: c.color_id.toString(),
          rgb: c.rgb,
          hex: c.hex,
          pantone: {
            code: c.pantone.code,
            name: c.pantone.name,
            hex: c.hex,
            rgb: c.rgb
          },
          percentage: c.percentage,
          representativeRgbs: [c.rgb]
        }));
        setColors(mappedColors);
        setHistory([]);
      }

    } catch (error) {
      console.error("Analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFinalCalculate = async (currentColors: ExtractedColor[], targetProps?: typeof calculationProps) => {
    const props = targetProps ?? calculationProps;

    if (!file || !previewUrl || currentColors.length === 0) return;

    setIsCalculating(true);
    try {
      const img = new Image();
      img.src = previewUrl;
      await new Promise(resolve => img.onload = resolve);

      const maskPromises = currentColors.map(async (color) => {
        // Use custom threshold from UI
        const blob = await createBlackMask(img, color.representativeRgbs, props.threshold);
        return { blob, color };
      });

      const masks = await Promise.all(maskPromises);

      // Send raw parameters directly to backend
      const results = await calculatePaintFromMasks(
        masks,
        props.width,
        props.height,
        props.katSayisi,
        props.threshold
      );

      setCalculationResult(results);
    } catch (error) {
      console.error("Calculation failed:", error);
    } finally {
      setIsCalculating(false);
    }
  };

  // Remove the old useEffect that auto-calculated to give user full control with the button

  const saveToHistory = () => {
    setHistory(prev => [...prev, colors]);
  };

  const handleRemoveColor = (index: number) => {
    saveToHistory();
    const newColors = colors.filter((_, i) => i !== index);
    setColors(newColors);
    // Removed auto-triggering handleFinalCalculate
  };

  const handleMergeColors = async (sourceIndex: number, targetIndex: number) => {
    saveToHistory();
    const newColors = [...colors];
    const sourceColor = { ...newColors[sourceIndex] };
    const targetColor = { ...newColors[targetIndex] };

    targetColor.percentage += sourceColor.percentage;
    targetColor.representativeRgbs = [
      ...targetColor.representativeRgbs,
      ...sourceColor.representativeRgbs
    ];

    newColors[targetIndex] = targetColor;
    const filteredColors = newColors.filter((_, index) => index !== sourceIndex);
    setColors(filteredColors);
    // Removed auto-triggering handleFinalCalculate
  };

  const handleUndo = () => {
    if (history.length === 0) return;

    const previousColors = history[history.length - 1];
    setColors(previousColors);
    setHistory(prev => prev.slice(0, -1));
  };

  const handlePantoneChange = (index: number, newCode: string) => {
    saveToHistory();
    setColors(prev => {
      const newColors = [...prev];
      const currentColor = newColors[index];

      const matchedPantone = getPantoneByCode(newCode);

      if (matchedPantone) {
        newColors[index] = {
          ...currentColor,
          hex: matchedPantone.hex,
          rgb: matchedPantone.rgb,
          pantone: matchedPantone
        };
      } else {
        // Fallback: If pantone not found, we update the code for display but can't find the color.
        // Ideally we should alert the user, but inside setState updater we shouldn't side-effect.
        // We will just update the label.
        newColors[index] = {
          ...currentColor,
          pantone: {
            ...currentColor.pantone,
            code: newCode,
            name: "Bilinmiyor" // Unknown
          }
        };
      }
      return newColors;
    });
  };

  const handleCalculate = (props: any, shouldTrigger: boolean = false) => {
    setCalculationProps(props);

    if (shouldTrigger && colors.length > 0) {
      handleFinalCalculate(colors, props);
    }
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
      width: calculationProps.width,
      height: calculationProps.height,
      katSayisi: calculationProps.katSayisi
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

                  <SimulationPreview
                    originalImage={previewUrl}
                    colors={colors}
                    isAnalyzing={isAnalyzing}
                  />

                  {/* Analysis Actions */}
                  <div className="space-y-3">
                    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 space-y-4">
                      <div className="flex items-center gap-3">
                        <Settings className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-semibold">Analiz Ayarları</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={ignoreBackground}
                            onChange={(e) => setIgnoreBackground(e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span>Arkaplanı Yoksay</span>
                        </label>

                        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={ignoreBlack}
                            onChange={(e) => setIgnoreBlack(e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span>Siyahı Yoksay</span>
                        </label>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                        <div className="space-y-1.5">
                          <label className="text-xs text-gray-500 font-medium">Renk Sayısı</label>
                          <input
                            type="number"
                            value={numColors}
                            onChange={(e) => setNumColors(parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={handleAnalyze}
                        disabled={isAnalyzing || isCalculating}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95"
                      >
                        {(isAnalyzing || isCalculating) ? <Loader2 className="w-5 h-5 animate-spin" /> : <Palette className="w-5 h-5" />}
                        {isAnalyzing ? "Renk Analizi Yapılıyor..." : isCalculating ? "Boya Hesaplanıyor..." : "Analiz Et & Hesapla"}
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
                    onPantoneChange={handlePantoneChange}
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

            {colors.length > 0 &&
              <ResultsSummary
                colors={colors}
                width={calculationProps.width}
                height={calculationProps.height}
                katSayisi={calculationProps.katSayisi}
                calculationResult={calculationResult}
              />
            }

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
