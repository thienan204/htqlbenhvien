import os
import json
from docx import Document

def parse_docx(filepath):
    doc = Document(filepath)
    tables = doc.tables
    if not tables:
        return []
        
    table = tables[0]
    results = []
    current_group = "Chung"
    
    # We skip the header row, usually row 0 or 1.
    for i, row in enumerate(table.rows):
        cells = [cell.text.strip().replace('\n', ' ') for cell in row.cells]
        
        # Deduplicate cells
        unique_cells = []
        for c in cells:
            if not unique_cells or unique_cells[-1] != c:
                unique_cells.append(c)
                
        if not unique_cells:
            continue
            
        # Skip header
        if "STT" in unique_cells[0] or "DANH MỤC" in (unique_cells[-1] if unique_cells else ""):
            continue
            
        # Group row detection
        if len(unique_cells) == 1 and unique_cells[0]:
            current_group = unique_cells[0]
            continue
            
        if len(unique_cells) >= 3:
            stt = unique_cells[0]
            code = unique_cells[1]
            name = unique_cells[2]
            
            if name:
                results.append({
                    "group": current_group,
                    "code": code,
                    "name": name
                })
        elif len(unique_cells) == 2:
             results.append({
                 "group": current_group,
                 "code": "",
                 "name": unique_cells[1]
             })
             
    return results

if __name__ == "__main__":
    folder = "mau/MAUTT32"
    all_data = {}
    
    for filename in os.listdir(folder):
        if filename.endswith(".docx") and not filename.startswith("~$"):
            filepath = os.path.join(folder, filename)
            cat_name = filename.replace(".docx", "").split(". ", 1)[-1]
            
            print(f"Parsing {filename}...")
            data = parse_docx(filepath)
            all_data[cat_name] = data
            
    with open("scratch/tt32_data.json", "w", encoding="utf-8") as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)
    print("Done generating scratch/tt32_data.json")
