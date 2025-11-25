#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SVG Renk Analiz Aracı
- Renk tespiti (RGB + Pantone)
- Alan hesaplama
- Boya miktarı hesaplama
- KMeans optimal renk sayısı
"""

import argparse
import json
import sys
from pathlib import Path
from collections import Counter
import os

# Suppress warnings
import warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
from PIL import Image, ImageDraw
import io

from sklearn.cluster import KMeans

from colormath.color_objects import sRGBColor, LabColor
from colormath.color_conversions import convert_color
from colormath.color_diff import delta_e_cie2000

# Numpy compatibility patch for colormath with newer numpy versions
if not hasattr(np, 'asscalar'):
    np.asscalar = lambda x: x.item()

class NumpyEncoder(json.JSONEncoder):
    """ Special json encoder for numpy types """
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        return super(NumpyEncoder, self).default(obj)

# ============================================================================
# PANTONE VERİTABANI (Genişletilebilir)
# ============================================================================

# Load Pantone Database from JSON
try:
    db_path = Path(__file__).parent / "pantone_database.json"
    with open(db_path, "r") as f:
        pantone_data = json.load(f)
    PANTONE_DATABASE = pd.DataFrame(pantone_data)
except Exception as e:
    # Fallback or exit
    # print(json.dumps({"error": f"Pantone veritabanı yüklenemedi: {e}"}))
    # sys.exit(1)
    # Create a dummy DB if missing for testing
    PANTONE_DATABASE = pd.DataFrame([
        {"code": "Black C", "name": "Black C", "L": 0, "a": 0, "b": 0},
        {"code": "White", "name": "White", "L": 100, "a": 0, "b": 0},
    ])

# Ensure White is in the database if it wasn't loaded
if 'name' in PANTONE_DATABASE.columns:
    if not PANTONE_DATABASE['name'].str.contains('White', case=False).any():
        # Add White manually
        white_row = pd.DataFrame([{"code": "White", "name": "White", "L": 100, "a": 0, "b": 0}])
        PANTONE_DATABASE = pd.concat([PANTONE_DATABASE, white_row], ignore_index=True)
else:
     # Fallback if columns are missing
     pass


# ============================================================================
# YARDIMCI FONKSİYONLAR
# ============================================================================

def rgb_to_lab(r, g, b):
    """RGB'yi LAB renk uzayına çevir"""
    rgb = sRGBColor(r/255.0, g/255.0, b/255.0, is_upscaled=False)
    lab = convert_color(rgb, LabColor, target_illuminant='d50')
    return lab


def lab_to_rgb(L, a, b):
    """LAB'den RGB'ye çevir"""
    lab = LabColor(L, a, b, illuminant='d50')
    rgb = convert_color(lab, sRGBColor)
    r = int(np.clip(round(rgb.clamped_rgb_r * 255), 0, 255))
    g = int(np.clip(round(rgb.clamped_rgb_g * 255), 0, 255))
    b = int(np.clip(round(rgb.clamped_rgb_b * 255), 0, 255))
    return (r, g, b)


def find_closest_pantone(r, g, b, pantone_df):
    """En yakın Pantone rengini bul (Delta E 2000 ile)"""
    lab_color = rgb_to_lab(r, g, b)

    min_delta_e = float('inf')
    best_match = None

    for _, row in pantone_df.iterrows():
        pantone_lab = LabColor(row["L"], row["a"], row["b"], illuminant='d50')
        delta_e = float(delta_e_cie2000(lab_color, pantone_lab))

        if delta_e < min_delta_e:
            min_delta_e = delta_e
            best_match = {
                "name": row["name"],
                "code": row["code"],
                "delta_e": round(delta_e, 2)
            }

    return best_match


def analyze_pixel_colors(img_array):
    """Piksel renklerini analiz et"""
    h, w, _ = img_array.shape
    total_pixels = h * w

    color_counts = Counter()

    # Flatten the array for faster processing
    # img_array is (H, W, 4) or (H, W, 3)
    
    if img_array.shape[2] == 4:
        # Filter alpha < 128
        mask = img_array[:, :, 3] >= 128
        valid_pixels = img_array[mask]
    else:
        valid_pixels = img_array.reshape(-1, 3)

    # Convert to hex for counting
    # This might be slow for very large images, but accurate
    for pixel in valid_pixels:
        r, g, b = pixel[:3]
        hex_color = f"#{r:02X}{g:02X}{b:02X}"
        color_counts[hex_color] += 1

    return color_counts, total_pixels, (w, h)


# ============================================================================
# K-MEANS OPTIMAL RENK SAYISI
# ============================================================================

def find_optimal_k_advanced(rgb_array, k_min=2, k_max=10):
    """Elbow Method ile optimal k bul"""
    # LAB renk uzayına çevir
    lab_array = []
    for r, g, b in rgb_array:
        lab = rgb_to_lab(int(r), int(g), int(b))
        lab_array.append([lab.lab_l, lab.lab_a, lab.lab_b])

    X = np.array(lab_array, dtype=float)
    n = X.shape[0]

    if n < k_min:
        return k_min, None, None

    # Elbow Method: Her k için inertia hesapla
    inertias = []
    kmeans_models = []

    # If we have very few unique colors in the sample, don't try to find more clusters than unique colors
    unique_samples = len(np.unique(X, axis=0))
    effective_k_max = min(k_max, unique_samples)
    
    if effective_k_max < k_min:
        effective_k_max = k_min

    for k in range(k_min, min(effective_k_max + 1, n + 1)):
        kmeans = KMeans(n_clusters=k, n_init=10, random_state=42)
        kmeans.fit(X)
        inertias.append(kmeans.inertia_)
        kmeans_models.append(kmeans)

    # Elbow noktasını bul (inertia düşüş hızı en çok azaldığı nokta)
    if len(inertias) < 2:
        best_k = k_min
    else:
        # İkinci türev (düşüş hızındaki değişim)
        deltas = np.diff(inertias)  # Birinci türev
        second_deltas = np.diff(deltas)  # İkinci türev

        # İkinci türevin en büyük olduğu yer = en keskin dirsek
        if len(second_deltas) > 0:
            elbow_idx = np.argmax(second_deltas) + 1
            best_k = k_min + elbow_idx
        else:
            best_k = k_min

    # Ensure best_k is within bounds
    best_k = max(k_min, min(best_k, effective_k_max))
    
    # If we only have one model, use it
    if len(kmeans_models) == 1:
        best_kmeans = kmeans_models[0]
    else:
        # Index might be out of bounds if effective_k_max changed loop range
        # Map best_k back to index
        idx = best_k - k_min
        if idx < len(kmeans_models):
             best_kmeans = kmeans_models[idx]
        else:
             best_kmeans = kmeans_models[-1]

    # Cluster centers ve shares
    centers_lab = best_kmeans.cluster_centers_
    labels = best_kmeans.labels_

    centers_rgb = []
    shares = []

    for i in range(best_kmeans.n_clusters):
        L, a, b = centers_lab[i]
        rgb = lab_to_rgb(L, a, b)
        centers_rgb.append(rgb)
        shares.append((labels == i).sum() / len(labels))

    return best_k, centers_rgb, shares


# ============================================================================
# BOYA MİKTARI HESAPLAMA
# ============================================================================

def calculate_paint(area_mm2, kat_sayisi=1.0):
    """
    Boya miktarını hesapla (gram cinsinden)

    area_mm2: Alan (mm²)
    kat_sayisi: Ağırlık kat sayısı
    """
    if area_mm2 <= 0:
        return {"grams": 0.0}

    grams = area_mm2 * kat_sayisi

    return {
        "grams": round(grams, 2)
    }


# ============================================================================
# ANA ANALİZ FONKSİYONU
# ============================================================================

def analyze_svg(image_path, total_area_mm2, dpi=300, k_min=2, k_max=10, pantone_df=None, kat_sayisi=1.0, ignore_background=False, ignore_black=False):
    """Resmi tam analiz et"""

    if pantone_df is None:
        pantone_df = PANTONE_DATABASE

    # 2. Resmi Yükle (Rasterizasyon Node tarafında yapılmış olabilir veya doğrudan resim gelir)
    try:
        img = Image.open(image_path).convert("RGBA")
        img_array = np.array(img)
    except Exception as e:
        return {"error": str(e)}

    # 3. Piksel analizi
    color_counts, total_pixels, (w, h) = analyze_pixel_colors(img_array)

    # 4. Background Filtering
    filtered_counts = {}
    
    # Helper to check if color is black-ish
    def is_blackish(r, g, b):
        return max(r, g, b) < 50

    # Helper to check similarity (Euclidean distance in RGB)
    def is_similar(hex1, hex2, threshold=30):
        r1, g1, b1 = int(hex1[1:3], 16), int(hex1[3:5], 16), int(hex1[5:7], 16)
        r2, g2, b2 = int(hex2[1:3], 16), int(hex2[3:5], 16), int(hex2[5:7], 16)
        return ((r1-r2)**2 + (g1-g2)**2 + (b1-b2)**2)**0.5 < threshold

    colors_to_ignore = [] # List of (hex, threshold)
    
    if ignore_background:
        # Try Spatial Floodfill first
        try:
            # Create a copy of the image for floodfill
            img_flood = img.copy()
            w, h = img.size
            
            # Define corners for floodfill
            corners = [(0, 0), (w-1, 0), (0, h-1), (w-1, h-1)]
            
            # Tolerance for floodfill
            tolerance = 5
            fill_color = (0, 0, 0, 0)
            
            for corner in corners:
                try:
                    seed_color = img_flood.getpixel(corner)
                    if seed_color[3] == 0:
                        continue
                    ImageDraw.floodfill(img_flood, corner, fill_color, thresh=tolerance)
                except Exception:
                    pass
            
            # Re-analyze
            img_array_flood = np.array(img_flood)
            color_counts, total_pixels, _ = analyze_pixel_colors(img_array_flood)
            
            # If successful, we don't need to ignore colors manually
            colors_to_ignore = []
            
        except Exception as e:
            # Fallback to statistical method
            if color_counts:
                most_common_color, most_common_count = color_counts.most_common(1)[0]
                most_common_ratio = most_common_count / total_pixels
                
                if most_common_ratio > 0.20:
                    colors_to_ignore.append((most_common_color, 40))
                    
                    # Check for secondary background
                    for next_color, next_count in color_counts.most_common(10):
                        if next_color == most_common_color:
                            continue
                        if is_similar(next_color, most_common_color, 40):
                            continue
                        
                        next_ratio = next_count / total_pixels
                        r, g, b = int(next_color[1:3], 16), int(next_color[3:5], 16), int(next_color[5:7], 16)
                        
                        if is_blackish(r, g, b) and next_ratio > 0.10:
                            colors_to_ignore.append((next_color, 60))
                            break

    # Legacy ignore_black
    if ignore_black:
        # We will handle this in the loop
        pass

    for hex_color, count in color_counts.items():
        r = int(hex_color[1:3], 16)
        g = int(hex_color[3:5], 16)
        b = int(hex_color[5:7], 16)
        
        # Check against ignore list with similarity
        should_ignore = False
        for ignore_hex, threshold in colors_to_ignore:
            if is_similar(hex_color, ignore_hex, threshold):
                should_ignore = True
                break
        
        if should_ignore:
            continue
            
        # Legacy Black detection
        if ignore_black:
            if max(r, g, b) < 60:
                continue
            
        filtered_counts[hex_color] = count

    # 5. K-Means optimal renkler
    
    # Improved Sampling Strategy
    sample_limit = 50000 # Increased from 25000 to capture more detail
    rgb_samples = []
    total_count = sum(filtered_counts.values())
    
    if total_count == 0:
         return {"error": "No colors found after filtering"}

    # Sort colors by count descending
    sorted_colors = sorted(filtered_counts.items(), key=lambda x: x[1], reverse=True)
    
    # Dynamic k_min adjustment
    # Count significant distinct colors to set a better floor for k
    significant_colors = 0
    for hex_c, count in sorted_colors:
        # If > 1% OR (> 50 pixels and very distinct)
        # For now, just lower the threshold to 0.1% to catch small details like stars
        if count / total_count > 0.001 or count > 50: 
            significant_colors += 1
            
    # Cap significant_colors to k_max to avoid forcing k=100
    significant_colors = min(significant_colors, k_max)
    
    # Adjust k_min if we see more significant colors
    if significant_colors > k_min:
        k_min = min(significant_colors, k_max)

    
    # We want to ensure that even small distinct colors get represented.
    # Strategy:
    # 1. Base quota: Proportional to count
    # 2. Minimum quota: At least N samples for any color that has > M pixels
    
    distinct_colors_count = len(sorted_colors)
    
    for hex_color, count in sorted_colors:
        r = int(hex_color[1:3], 16)
        g = int(hex_color[3:5], 16)
        b = int(hex_color[5:7], 16)

        ratio = count / total_count
        
        # Proportional quota
        quota = int(sample_limit * ratio)
        
        # BOOST SMALL DETAILS:
        # If a color is small (e.g. < 600 pixels) but visible (> 20 pixels), 
        # take ALL of it to ensure it's fully represented and not washed out.
        if 20 < count < 600:
            quota = count
        # For larger colors, ensure a minimum representation
        elif count >= 600:
             quota = max(quota, 200) 
        
        # Cap to prevent domination (e.g. max 20% of samples for one color)
        # This allows other colors to exist in the sample set
        # But only apply cap if we have enough distinct colors
        if distinct_colors_count > 5:
            quota = min(quota, int(sample_limit * 0.20))
        
        # Final safety check: don't take more than actual pixels
        quota = min(quota, count)
        
        if quota > 0:
            rgb_samples.extend([[r, g, b]] * quota)
        
        if len(rgb_samples) > sample_limit * 1.2:
            break

    # FORCE INCLUSION:
    # If we have very distinct colors that are small (like White stars), 
    # and they haven't been added (or added enough), force add them.
    # Check for White specifically or high brightness colors if they exist in filtered_counts
    
    for hex_c, count in sorted_colors:
        r, g, b = int(hex_c[1:3], 16), int(hex_c[3:5], 16), int(hex_c[5:7], 16)
        # Check if it's a "star" (bright)
        if (r+g+b)/3 > 200:
             # Add 100 samples of this star color to ensure K-Means sees it
             rgb_samples.extend([[r, g, b]] * 100)

    if not rgb_samples:
        return {"error": "No colors found"}

    rgb_array = np.array(rgb_samples, dtype=np.uint8)
    
    # Adjust k_max if we found more distinct significant colors
    # This helps if the user asked for k=10 but we clearly see 12 distinct clusters
    # But we stick to user limits for now
    
    optimal_k, centers_rgb, shares = find_optimal_k_advanced(rgb_array, k_min, k_max)

    # KMeans renkleri
    kmeans_colors = []
    if centers_rgb and shares:
        for rgb, share in zip(centers_rgb, shares):
            r, g, b = rgb
            pantone = find_closest_pantone(r, g, b, pantone_df)
            area_mm2 = share * total_area_mm2
            paint = calculate_paint(area_mm2, kat_sayisi)

            kmeans_colors.append({
                "rgb": [int(r), int(g), int(b)],
                "hex": f"#{int(r):02X}{int(g):02X}{int(b):02X}",
                "pantone": pantone,
                "area_mm2": round(area_mm2, 2),
                "percentage": round(share * 100, 2),
                "paint": paint
            })

    # Toplam boya
    total_paint = calculate_paint(total_area_mm2, kat_sayisi)

    return {
        "total_area_mm2": round(total_area_mm2, 2),
        "unique_colors_count": len(filtered_counts),
        "kmeans": {
            "optimal_k": optimal_k,
            "colors": kmeans_colors
        },
        "total_paint": total_paint
    }


# ============================================================================
# MAIN
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description="SVG Renk Analiz Aracı")
    parser.add_argument("image", help="Resim dosya yolu")
    parser.add_argument("--genislik", type=float, default=100, help="Resim genişliği (mm) - varsayılan: 100")
    parser.add_argument("--yukseklik", type=float, default=100, help="Resim yüksekliği (mm) - varsayılan: 100")
    parser.add_argument("--kat-sayisi", type=float, default=1.0, help="Ağırlık kat sayısı - varsayılan: 1.0")
    parser.add_argument("--k-min", type=int, default=2, help="Minimum renk sayısı (varsayılan: 2)")
    parser.add_argument("--k-max", type=int, default=10, help="Maksimum renk sayısı (varsayılan: 10)")
    parser.add_argument("--ignore-black", action="store_true", help="Siyah arka planı yoksay (Legacy)")
    parser.add_argument("--ignore-background", action="store_true", help="Otomatik arka plan algıla ve yoksay")

    args = parser.parse_args()

    image_path = Path(args.image)
    if not image_path.exists():
        print(json.dumps({"error": f"Dosya bulunamadı: {image_path}"}))
        sys.exit(1)

    # Alan hesapla
    total_area_mm2 = args.genislik * args.yukseklik

    # Analiz et
    result = analyze_svg(
        image_path, 
        total_area_mm2=total_area_mm2, 
        k_min=args.k_min, 
        k_max=args.k_max, 
        kat_sayisi=args.kat_sayisi, 
        ignore_black=args.ignore_black,
        ignore_background=args.ignore_background
    )

    # JSON yazdır
    print(json.dumps(result, ensure_ascii=False, indent=2, cls=NumpyEncoder))


if __name__ == "__main__":
    main()
