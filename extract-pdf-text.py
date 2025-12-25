#!/usr/bin/env python3
"""
Скрипт для извлечения текста из PDF файлов с правилами нардов
"""

import sys
import os

def extract_text_pypdf2(pdf_path):
    """Извлекает текст используя PyPDF2"""
    try:
        import PyPDF2
        with open(pdf_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            text = ''
            for page in reader.pages:
                text += page.extract_text() + '\n\n--- PAGE BREAK ---\n\n'
            return text
    except ImportError:
        return None

def extract_text_pdfplumber(pdf_path):
    """Извлекает текст используя pdfplumber"""
    try:
        import pdfplumber
        text = ''
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                text += page.extract_text() + '\n\n--- PAGE BREAK ---\n\n'
        return text
    except ImportError:
        return None

def main():
    pdf_files = [
        'Правила_вида_спорта_нарды_утв_приказом_Минспорта_России.pdf',
        'Nardist_Equipment_Spec_v2_0.pdf'
    ]
    
    for pdf_file in pdf_files:
        if not os.path.exists(pdf_file):
            print(f"[!] File {pdf_file} not found")
            continue
            
        print(f"\n[*] Extracting text from: {pdf_file}")
        
        # Пробуем pdfplumber (лучше для таблиц)
        text = extract_text_pdfplumber(pdf_file)
        if text:
            output_file = pdf_file.replace('.pdf', '_extracted.txt')
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(text)
            print(f"[+] Text saved to: {output_file}")
            continue
        
        # Пробуем PyPDF2
        text = extract_text_pypdf2(pdf_file)
        if text:
            output_file = pdf_file.replace('.pdf', '_extracted.txt')
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(text)
            print(f"[+] Text saved to: {output_file}")
            continue
        
        print(f"[X] Failed to extract text. Install library:")
        print("   pip install pdfplumber  # (recommended)")
        print("   or")
        print("   pip install PyPDF2")

if __name__ == '__main__':
    main()

