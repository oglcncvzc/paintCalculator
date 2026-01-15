"use client";

import React, { useState, useEffect } from "react";
import { Ruler, Settings2, Calculator, Info, Hash } from "lucide-react";

interface PreciseProperties {
    width: number;
    height: number;
    katSayisi: number;
    threshold: number;
}

interface CalculatorFormProps {
    onCalculate: (dimensions: PreciseProperties, shouldTrigger?: boolean) => void;
}

export function CalculatorForm({ onCalculate }: CalculatorFormProps) {
    const [values, setValues] = useState<PreciseProperties>({
        width: 350.0,
        height: 250.0,
        katSayisi: 0.00001,
        threshold: 30,
    });

    // Notify parent of changes (for reporting/state) but don't trigger final calculate
    useEffect(() => {
        onCalculate(values, false);
    }, [values]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setValues(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    };

    return (
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-8 space-y-8 shadow-2xl shadow-gray-200/50 dark:shadow-none animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
                        <Ruler className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-xl font-black italic text-gray-900 dark:text-gray-100 uppercase tracking-tight font-display">Hassas Boyutlar</h3>
                </div>
                <div className="px-3 py-1 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center gap-1.5 border border-green-100 dark:border-green-800/30">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-black text-green-600 dark:text-green-400 uppercase tracking-tighter">Doğrudan Veri</span>
                </div>
            </div>

            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="group space-y-2">
                        <label className="text-[10px] font-black text-gray-400 group-focus-within:text-blue-500 transition-colors uppercase tracking-widest px-1">Genişlik (mm)</label>
                        <input
                            type="number"
                            name="width"
                            step="0.1"
                            value={values.width}
                            onChange={handleChange}
                            className="w-full px-5 py-4 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-black text-xl italic"
                        />
                    </div>
                    <div className="group space-y-2">
                        <label className="text-[10px] font-black text-gray-400 group-focus-within:text-blue-500 transition-colors uppercase tracking-widest px-1">Yükseklik (mm)</label>
                        <input
                            type="number"
                            name="height"
                            step="0.1"
                            value={values.height}
                            onChange={handleChange}
                            className="w-full px-5 py-4 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-black text-xl italic"
                        />
                    </div>
                </div>

                <div className="pt-6 border-t border-gray-50 dark:border-gray-800 space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 flex items-center justify-between">
                            Ağırlık Kat Sayısı
                            <Hash className="w-3 h-3 opacity-30" />
                        </label>
                        <input
                            type="number"
                            name="katSayisi"
                            step="0.00000001"
                            value={values.katSayisi}
                            onChange={handleChange}
                            className="w-full px-5 py-5 rounded-2xl border border-blue-50 dark:border-gray-800 bg-blue-50/20 dark:bg-gray-800 text-blue-900 dark:text-blue-100 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-black text-2xl italic tracking-tight"
                            placeholder="0.00000000"
                        />
                    </div>

                    <div className="space-y-4 p-5 bg-gray-50 dark:bg-gray-800/50 rounded-3xl border border-gray-100 dark:border-gray-800">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Ayrıştırma Hassasiyeti</label>
                            <span className="bg-blue-600 text-white px-2.5 py-1 rounded-lg text-xs font-black shadow-lg shadow-blue-600/20">{values.threshold}</span>
                        </div>
                        <input
                            type="range"
                            name="threshold"
                            min="0" max="255"
                            value={values.threshold}
                            onChange={handleChange}
                            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-blue-600"
                        />
                        <div className="flex justify-between text-[10px] font-bold text-gray-400">
                            <span>MİN</span>
                            <span>MAX</span>
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => onCalculate(values, true)}
                    className="group w-full bg-gray-950 dark:bg-white text-white dark:text-gray-950 py-5 rounded-3xl font-black italic uppercase tracking-[0.2em] hover:bg-black dark:hover:bg-gray-100 transition-all flex items-center justify-center gap-3 shadow-2xl active:scale-[0.98] relative overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full duration-1000 transition-transform" />
                    Gram Hesapla
                    <Calculator className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                </button>
            </div>

            <div className="flex items-center justify-center gap-2 opacity-50">
                <div className="w-1 h-1 rounded-full bg-gray-400" />
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Değerler doğrudan backend'e iletilir</p>
                <div className="w-1 h-1 rounded-full bg-gray-400" />
            </div>
        </div>
    );
}
