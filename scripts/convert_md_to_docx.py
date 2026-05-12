import os
import markdown
from docx import Document
from htmldocx import HtmlToDocx

def convert():
    print("Reading markdown files...")
    docs = [
        'docs_part1.md',
        'docs_part2.md',
        'docs_part3.md',
        'docs_part4.md',
        'docs_part5.md',
        'docs_part6.md'
    ]
    
    full_md = ""
    for doc in docs:
        if os.path.exists(doc):
            with open(doc, 'r', encoding='utf-8') as f:
                full_md += f.read() + "\n\n<br/>\n<hr/>\n<br/>\n\n"
                
    # Convert MD to HTML
    print("Converting md to html...")
    html = markdown.markdown(full_md, extensions=['extra', 'tables'])
    
    print("Generating docx...")
    document = Document()
    new_parser = HtmlToDocx()
    
    # We wrap it in standard HTML tags so HtmlToDocx doesn't fail
    html = f"<html><body>{html}</body></html>"
    
    new_parser.add_html_to_document(html, document)
    
    output_name = 'HospiSync_Documentation.docx'
    document.save(output_name)
    print(f"Successfully saved {output_name}")

if __name__ == "__main__":
    convert()
