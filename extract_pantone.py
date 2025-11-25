import re
import json
import math

def lab_to_rgb(L, a, b):
    # Simple Lab to RGB conversion (D50)
    # This is an approximation. For better results use colormath, but this avoids dependencies for this script.
    
    # Reference White D50
    Xn = 96.4212
    Yn = 100.0
    Zn = 82.5188

    fy = (L + 16) / 116
    fx = fy + (a / 500)
    fz = fy - (b / 200)

    def decode_f(t):
        if t > 6/29:
            return t * t * t
        else:
            return (t - 4/29) * (108/841)

    X = Xn * decode_f(fx)
    Y = Yn * decode_f(fy)
    Z = Zn * decode_f(fz)

    # XYZ to RGB (sRGB)
    # Transformation matrix for D50 to sRGB (Bradford adapted)
    # Actually, standard sRGB uses D65. We need XYZ(D50) -> XYZ(D65) -> RGB.
    # Or simplified matrix.
    
    # Let's use a standard D50 -> sRGB matrix directly if possible, or assume D65 if the PDF implies it.
    # Pantone usually uses D50.
    
    # Using a common D50 to sRGB matrix:
    # r_l =  3.2404542 * (X/100) - 1.5371385 * (Y/100) - 0.4985314 * (Z/100)
    # g_l = -0.9692660 * (X/100) + 1.8760108 * (Y/100) + 0.0415560 * (Z/100)
    # b_l =  0.0556434 * (X/100) - 0.2040259 * (Y/100) + 1.0572252 * (Z/100)
    
    # Wait, that matrix is for D65.
    # Let's use colormath if available in the environment (it is used in color_analysis.py).
    # But I want this script to be standalone if possible.
    # I'll try to import colormath.
    
    try:
        from colormath.color_objects import LabColor, sRGBColor
        from colormath.color_conversions import convert_color
        import numpy as np
        
        # Patch numpy
        if not hasattr(np, 'asscalar'):
            np.asscalar = lambda x: x.item()
            
        lab = LabColor(L, a, b, illuminant='d50')
        rgb = convert_color(lab, sRGBColor)
        
        r = int(max(0, min(255, round(rgb.clamped_rgb_r * 255))))
        g = int(max(0, min(255, round(rgb.clamped_rgb_g * 255))))
        b = int(max(0, min(255, round(rgb.clamped_rgb_b * 255))))
        return r, g, b
    except ImportError:
        # Fallback to simple approximation (D65 assumption or simple matrix)
        # This is risky for Pantone.
        print("Warning: colormath not found, using rough approximation")
        return 0, 0, 0 # Should not happen in this env

def parse_pantone_strings(filename):
    with open(filename, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    # Regex to find blocks
    # <rdf:li rdf:parseType="Resource">
    #    <xmpG:swatchName>PANTONE 7582 C</xmpG:swatchName>
    #    ...
    #    <xmpG:mode>LAB</xmpG:mode>
    #    <xmpG:L>33.725491</xmpG:L>
    #    <xmpG:A>13</xmpG:A>
    #    <xmpG:B>25</xmpG:B>
    # </rdf:li>

    # We can regex for swatchName and then look ahead for L, A, B
    
    pattern = re.compile(r'<xmpG:swatchName>(.*?)</xmpG:swatchName>.*?<xmpG:mode>LAB</xmpG:mode>.*?<xmpG:L>(.*?)</xmpG:L>.*?<xmpG:A>(.*?)</xmpG:A>.*?<xmpG:B>(.*?)</xmpG:B>', re.DOTALL)
    
    matches = pattern.findall(content)
    
    database = []
    seen = set()
    
    print(f"Found {len(matches)} matches")
    
    for name, l_str, a_str, b_str in matches:
        if name in seen:
            continue
        seen.add(name)
        
        try:
            L = float(l_str)
            a = float(a_str)
            b = float(b_str)
            
            # Convert to RGB? Or keep Lab?
            # color_analysis.py uses Lab for matching, so keeping Lab is best!
            # But it also needs RGB for display?
            # Actually, color_analysis.py converts RGB input to Lab to match against Lab DB.
            # So Lab in DB is perfect.
            
            # But we might want RGB for frontend display if we export it.
            # Let's store both.
            
            # r, g, b_val = lab_to_rgb(L, a, b)
            
            entry = {
                "name": name,
                "code": name.replace("PANTONE ", ""),
                "L": L,
                "a": a,
                "b": b
            }
            database.append(entry)
        except ValueError:
            continue
            
    return database

if __name__ == "__main__":
    db = parse_pantone_strings("pantone_strings.txt")
    
    # Save to JSON
    with open("src/scripts/pantone_database.json", "w") as f:
        json.dump(db, f, indent=2)
        
    print(f"Saved {len(db)} colors to src/scripts/pantone_database.json")
