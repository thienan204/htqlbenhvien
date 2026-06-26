import pdfplumber
import json
import sys
import re

pdf_path = r'mau/Bang chi tieu.pdf'

def clean_text(text):
    if text is None:
        return ''
    return str(text).replace('\n', ' ').strip()

result = []

try:
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages):
            # table_settings can be tweaked if default extraction fails
            # Default extract_tables uses lines to find tables. 
            # Government PDFs often have hidden lines or weird structures.
            tables = page.extract_tables()
            if tables:
                for t_idx, table in enumerate(tables):
                    for r_idx, row in enumerate(table):
                        # clean row
                        cleaned_row = [clean_text(cell) for cell in row]
                        # Only keep rows that have something
                        if any(cleaned_row):
                            result.append({
                                'page': i + 1,
                                'table': t_idx + 1,
                                'row': r_idx + 1,
                                'data': cleaned_row
                            })

    with open('extracted_tables.json', 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print("Extracted successfully to extracted_tables.json")
except Exception as e:
    print(f"Error: {e}")
