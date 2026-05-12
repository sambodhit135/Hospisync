import pypandoc
import os

print("Starting documentation generation...")
try:
    print("Downloading pandoc if not exists...")
    pypandoc.download_pandoc()
    
    docs = [
        'docs_part1.md',
        'docs_part2.md',
        'docs_part3.md',
        'docs_part4.md',
        'docs_part5.md',
        'docs_part6.md'
    ]
    
    full_content = []
    
    for doc in docs:
        if os.path.exists(doc):
            with open(doc, 'r', encoding='utf-8') as f:
                full_content.append(f.read())
                full_content.append('\n\n\\pagebreak\n\n')
                
    combined_md = "".join(full_content)
    
    with open('combined_docs.md', 'w', encoding='utf-8') as f:
        f.write(combined_md)
        
    print("Converting to DOCX...")
    pypandoc.convert_file('combined_docs.md', 'docx', outputfile='HospiSync_Documentation.docx')
    print("Successfully generated HospiSync_Documentation.docx!")
    
except Exception as e:
    print(f"Error: {e}")
