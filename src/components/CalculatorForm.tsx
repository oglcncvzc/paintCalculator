"use client";

import React, { useState, useEffect } from "react";
import { CupDimensions, PaintProperties, calculateSurfaceArea } from "@/lib/geometry-utils";
import { Ruler, Cylinder, Settings2 } from "lucide-react";

interface CalculatorFormProps {
    onCalculate: (area: number, properties: PaintProperties) => void;
}

export function CalculatorForm({ onCalculate }: CalculatorFormProps) {
    const [dimensions, setDimensions] = useState<CupDimensions>({
        type: "cylinder",
        height: 10,
        topDiameter: 8,
        bottomDiameter: 8,
    });

    const [properties, setProperties] = useState<PaintProperties>({
        thickness: 20, // 20 microns default
        density: 1.2, // 1.2 g/cm3 default
        wastePercentage: 10, // 10% waste
    });

    // Auto-calculate when values change
    useEffect(() => {
        const area = calculateSurfaceArea(dimensions);
        onCalculate(area, properties);
    }, [dimensions, properties, onCalculate]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;

        if (name === "type") {
            setDimensions(prev => ({ ...prev, type: value as "cylinder" | "conical" }));
        } else if (name in dimensions) {
            setDimensions(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
        } else if (name in properties) {
            setProperties(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
        }
    };

    return (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-6">
            <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-4">
                <Ruler className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold">Dimensions & Properties</h3>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Object Shape</label>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => setDimensions(prev => ({ ...prev, type: "cylinder" }))}
                            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors flex items-center justify-center gap-2 ${dimensions.type === "cylinder"
                                    ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300"
                                    : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
                                }`}
                        >
                            <Cylinder className="w-4 h-4" />
                            Cylinder
                        </button>
                        <button
                            onClick={() => setDimensions(prev => ({ ...prev, type: "conical" }))}
                            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors flex items-center justify-center gap-2 ${dimensions.type === "conical"
                                    ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300"
                                    : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
                                }`}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M10 20h4" />
                                <path d="M4 20h16" />
                                <path d="m19 20-5-16" />
                                <path d="m5 20 5-16" />
                            </svg>
                            Conical
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Height (cm)</label>
                        <input
                            type="number"
                            name="height"
                            value={dimensions.height}
                            onChange={handleChange}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Top Diameter (cm)</label>
                        <input
                            type="number"
                            name="topDiameter"
                            value={dimensions.topDiameter}
                            onChange={handleChange}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                    </div>
                    {dimensions.type === "conical" && (
                        <div className="col-span-2">
                            <label className="block text-xs text-gray-500 mb-1">Bottom Diameter (cm)</label>
                            <input
                                type="number"
                                name="bottomDiameter"
                                value={dimensions.bottomDiameter}
                                onChange={handleChange}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>
                    )}
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2 mb-3">
                        <Settings2 className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium">Paint Properties</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Thickness (µm)</label>
                            <input
                                type="number"
                                name="thickness"
                                value={properties.thickness}
                                onChange={handleChange}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Density (g/cm³)</label>
                            <input
                                type="number"
                                name="density"
                                step="0.1"
                                value={properties.density}
                                onChange={handleChange}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs text-gray-500 mb-1">Waste Margin (%)</label>
                            <input
                                type="number"
                                name="wastePercentage"
                                value={properties.wastePercentage}
                                onChange={handleChange}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
