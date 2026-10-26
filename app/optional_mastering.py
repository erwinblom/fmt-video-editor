"""Optional mastering must never make the local export depend on a service."""
import os

def optional_mastering(source, cache, notify, provider, env=None):
    env = os.environ if env is None else env
    if env.get('FMT_AUDIO_MASTERING', 'local') != 'auphonic':
        return source, {'provider': 'local', 'cloud': False, 'message': 'Lokale mix.'}
    if env.get('FMT_ALLOW_CLOUD') != '1':
        return source, {'provider': 'local', 'cloud': False, 'fallback': True, 'message': 'Cloud staat uit; lokale mix gebruikt.'}
    try:
        return provider(source, cache, notify)
    except Exception:
        notify('Auphonic niet beschikbaar; de lokale mix wordt gebruikt.')
        return source, {'provider': 'local', 'cloud': False, 'fallback': True, 'message': 'Auphonic niet beschikbaar; lokale mix gebruikt.'}
