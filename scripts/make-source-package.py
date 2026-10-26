from pathlib import Path
import zipfile,hashlib,shutil,sys
root=Path(__file__).resolve().parent
if root.name=='scripts':root=root.parent
prefix='FMT-Video-Editor'
label=sys.argv[1] if len(sys.argv)>1 else 'actueel'
if not label.replace('-','').isalnum():raise SystemExit('Ongeldige pakketnaam')
import json
for name,expected in json.loads((root/'app/public/app-icon-hashes.json').read_text()).items():
 if hashlib.sha256((root/'app/public'/name).read_bytes()).hexdigest()!=expected:raise SystemExit('Afwijkende FMT-icoonbron: '+name)
files=(root/'release-files.txt').read_text().splitlines()
for name in files:
 p=Path(name)
 if p.is_absolute() or '..' in p.parts or not (root/p).is_file():raise SystemExit('Ontbrekend of onveilig pakketbestand: '+name)
 if any(x in p.parts for x in ['.git','app/data','node_modules','.venv','controle']) or (p.parts[0]=='app' and 'data' in p.parts):raise SystemExit('Privébestand geweigerd: '+name)
output=root/f'{prefix}-bron-{label}.zip'
with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as z:
 for name in files:
  p=root/name
  info=zipfile.ZipInfo.from_file(p,prefix+'/'+name)
  info.compress_type=zipfile.ZIP_DEFLATED
  z.writestr(info,p.read_bytes())
with zipfile.ZipFile(output) as z:
 assert z.testzip() is None
 for name in files:assert z.read(prefix+'/'+name)==(root/name).read_bytes()
shutil.copy2(output,root/f'{prefix}-bron-kandidaat.zip')
digest=hashlib.sha256(output.read_bytes()).hexdigest()
(output.with_suffix('.zip.sha256')).write_text(digest+'  '+output.name+'\n')
print(f'{output.name}: {len(files)} bestanden uitgepakt en bytegelijk gecontroleerd; SHA256 '+digest)
