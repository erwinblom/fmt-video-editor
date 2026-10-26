"""Preset-based mastering of the final speech and music mix. Original media stays untouched."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import wave

PRESET_NAME = 'FMT Interview Editor'
PRESET_ID = os.environ.get('FMT_AUPHONIC_PRESET_ID', '')


def digest(path):
    h = hashlib.sha256()
    with open(path, 'rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def configuration(preset):
    if preset.get('preset_name') != PRESET_NAME or preset.get('is_multitrack'):
        raise ValueError('De Auphonic-preset FMT Interview Editor ontbreekt of is geen enkelspoorpreset.')
    algorithms = preset['algorithms'].copy()
    if any(algorithms.get(k) for k in ('cutter', 'silence_cutter', 'filler_cutter', 'cough_cutter', 'music_cutter')):
        raise ValueError('Zet automatisch knippen uit in de Auphonic-preset; anders verschuift de video.')
    if algorithms.get('denoisemethod') == 'speech_isolation' or algorithms.get('filtermethod') == 'studiovoice':
        raise ValueError('Gebruik een muziekgeschikte Auphonic-preset voor de eindmix; geen spraakisolatie of Studio Voice.')
    # Copy only audio settings: never inherit publishing, transcription or inserts.
    return {'algorithms': algorithms, 'output_files': [{'format': 'wav', 'filename': 'processed.wav'}],
            'outgoing_services': [], 'speech_recognition': None, 'review_before_publishing': True,
            'metadata': {'title': 'FMT Editor - eindmix'}}


def frames(path):
    with wave.open(str(path)) as audio:
        if (audio.getframerate(), audio.getnchannels(), audio.getsampwidth()) != (48000, 2, 2):
            raise ValueError('Onverwacht audioformaat na conversie.')
        return audio.getnframes()


def validate_duration(original, processed):
    delta = frames(processed) - frames(original)
    if abs(delta) > 48:
        raise ValueError(f'Auphonic veranderde de audioduur met {delta / 48000:.3f} s; export gestopt.')
    return delta


def process_audio(source, cache_root, notify=lambda message: None):
    if os.environ.get('FMT_ALLOW_CLOUD') != '1':
        raise RuntimeError('Cloudverwerking staat uit in deze lokale publicatiekandidaat; lees PRIVACY.md.')
    if not PRESET_ID:
        raise RuntimeError('Stel een eigen FMT_AUPHONIC_PRESET_ID in; er wordt geen persoonlijke preset meegeleverd.')
    cli = os.environ.get('AUPHONIC_CLI') or shutil.which('auphonic') or str(Path.home() / '.local/bin/auphonic')
    ffmpeg = shutil.which('ffmpeg') or '/opt/homebrew/bin/ffmpeg'

    def call(args, timeout=120):
        result = subprocess.run([str(a) for a in args], capture_output=True, text=True, timeout=timeout)
        if result.returncode:
            # CLI output can contain account details or signed download URLs.
            raise RuntimeError('Auphonic-geluidsbewerking mislukt. Controleer verbinding, login en tegoed; probeer daarna opnieuw.')
        return result.stdout.strip()

    preset = json.loads(call([cli, 'preset', 'get', PRESET_ID, '--json']))
    config = configuration(preset)
    source_hash = digest(source)
    key = hashlib.sha256(json.dumps({'source': source_hash, 'config': config, 'version': 1}, sort_keys=True).encode()).hexdigest()
    folder = Path(cache_root) / key
    folder.mkdir(parents=True, exist_ok=True)
    output, receipt = folder / 'master.wav', folder / 'verified.json'
    if output.exists() and receipt.exists():
        info = json.loads(receipt.read_text())
        if info.get('sha256') == digest(output):
            notify('Eerder bewerkte Auphonic-eindmix hergebruiken')
            return output, info
    notify('Eindmix van stemmen en muziek voorbereiden voor Auphonic')
    original = folder / 'input.wav'
    if not original.exists():
        tmp = folder / 'input.tmp.wav'
        call([ffmpeg, '-v', 'error', '-y', '-i', source, '-vn', '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s16le', tmp], 600)
        tmp.replace(original)
    (folder / 'request.json').write_text(json.dumps(config, indent=2))
    production_file = folder / 'production.txt'
    if not production_file.exists():
        notify('Eindmix uploaden naar Auphonic')
        uuid = call([cli, 'create', original, '--from-json', folder / 'request.json', '--quiet'], 900)
        if not uuid or not uuid.isalnum():
            raise RuntimeError('Auphonic gaf geen geldige productiecode terug.')
        production_file.write_text(uuid)
    uuid = production_file.read_text().strip()
    status = json.loads(call([cli, 'get', uuid, '--json']))
    if status.get('status') != 3:
        notify('Auphonic bewerkt geluid voor FMT Editor')
        if status.get('status') == 10:
            call([cli, 'start', uuid], 120)
        elif status.get('status') in (2, 9, 11, 13, 15, 98):
            raise RuntimeError('De Auphonic-productie vraagt controle in je Auphonic-account: ' + uuid)
        call([cli, 'wait', uuid, '--wait-timeout', '3600'], 3660)
    notify('Bewerkt geluid downloaden en tijdsduur controleren')
    call([cli, 'download', uuid, '--dir', folder, '--format', 'wav', '--overwrite'], 600)
    call([ffmpeg, '-v', 'error', '-y', '-i', folder / 'processed.wav', '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s16le', folder / 'master.tmp.wav'], 600)
    delta = validate_duration(original, folder / 'master.tmp.wav')
    (folder / 'master.tmp.wav').replace(output)
    info = {'preset': PRESET_NAME, 'presetId': PRESET_ID, 'productionId': uuid, 'sourceSha256': source_hash,
            'sha256': digest(output), 'durationDifferenceSamples': delta, 'settings': config,
            'humanListeningChecked': False}
    receipt.write_text(json.dumps(info, indent=2))
    original.unlink(missing_ok=True)
    (folder / 'processed.wav').unlink(missing_ok=True)
    return output, info
