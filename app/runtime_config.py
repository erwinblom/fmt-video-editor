"""Machine-local paths; no project data or credentials in shared configuration."""
import json, os
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
local_file = ROOT / '.fmt-local.json'
if local_file.exists():
    for key, value in json.loads(local_file.read_text()).items():
        if key.startswith('FMT_') and isinstance(value, str):
            os.environ.setdefault(key, value)
TEMPLATE = Path(os.environ.get('FMT_TEMPLATE_DIR', str(ROOT / 'template')))
