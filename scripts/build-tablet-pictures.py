"""Index the tablet photo folder for static hosting without changing images."""
import json
from pathlib import Path
folder = Path(__file__).resolve().parent.parent / 'gamepoem' / 'site' / 'pictures'
extensions = {'.jpg', '.jpeg', '.png', '.webp', '.avif'}
files = sorted((p.name for p in folder.iterdir() if p.is_file() and p.suffix.lower() in extensions), key=str.casefold)
(folder / 'manifest.json').write_text(json.dumps(files, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('Indexed {} tablet photos'.format(len(files)))
