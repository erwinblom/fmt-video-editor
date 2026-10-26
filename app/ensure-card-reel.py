"""Prepare the exact approved FMT card reel; reuse only matching HTML and assets."""
import sys,json,shutil,subprocess,hashlib,os
from pathlib import Path
ROOT=Path(__file__).resolve().parent

def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def run(cmd,cwd=None):
    result=subprocess.run([str(x) for x in cmd],cwd=cwd,capture_output=True)
    if result.returncode:raise RuntimeError(result.stderr.decode(errors='replace')[-500:])
def main(folder):
    data=json.loads((folder/'request.json').read_text());cfg=data['config'];generated=folder/'generated'
    (folder/'interview.json').write_text(json.dumps(cfg,ensure_ascii=False))
    if generated.exists():shutil.rmtree(generated)
    run([sys.executable,ROOT/'make-cards.py','--config',folder/'interview.json','--output',generated])
    html=(generated/'index.html').read_text().replace('width:1920px;height:1080px','width:100%;height:100%');(generated/'index.html').write_text(html)
    exports=Path(data['root'])/'data/exports'
    if exports.exists():
        for job in exports.iterdir():
            reel=job/'graphics/cards.mp4'
            try:
                if not reel.exists() or json.loads((job/'interview.json').read_text())!=cfg:continue
                if (job/'graphics/index.html').read_text()!=html:continue
                assets=list((generated/'assets').rglob('*'))
                if any(p.is_file() and (not (job/'graphics/assets'/p.relative_to(generated/'assets')).is_file() or digest(p)!=digest(job/'graphics/assets'/p.relative_to(generated/'assets'))) for p in assets):continue
                shutil.copy2(reel,folder/'cards.tmp.mp4');(folder/'cards.tmp.mp4').replace(folder/'cards.mp4')
                (folder/'receipt.json').write_text(json.dumps({'reusedExport':job.name,'htmlAndAssetsVerified':True}));return
            except (OSError,ValueError):continue
    node=shutil.which('node') or str(Path.home()/'.local/bin/node');cli=Path(os.environ.get('FMT_HYPERFRAMES_CLI',str(ROOT.parent/'node_modules/hyperframes/bin/hyperframes.mjs')));graphics=folder/'graphics'
    if not (graphics/'package.json').exists():run([node,cli,'init',graphics,'--non-interactive','--example=blank','--skill=general-video'],cwd=folder)
    for name in ['index.html','template.json','interview.json','graphics-plan.json']:shutil.copy2(generated/name,graphics/name)
    shutil.copytree(generated/'assets',graphics/'assets',dirs_exist_ok=True)
    (graphics/'BRIEF.md').write_text('---\nworkflow: general-video\nflow: automation\n---\n# Bestaande vaste FMT-kaarten\nOngewijzigde template, actuele interviewtitels. Lokale kaartpreview.\n')
    run([node,cli,'check','--json'],cwd=graphics)
    run([node,cli,'render','--quality','looks','--fps','25','--output',folder/'cards.tmp.mp4'],cwd=graphics)
    (folder/'cards.tmp.mp4').replace(folder/'cards.mp4');(folder/'receipt.json').write_text(json.dumps({'renderedLocally':True}))
if __name__=='__main__':main(Path(sys.argv[1]))
