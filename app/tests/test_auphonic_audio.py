import sys, unittest, tempfile, wave
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from auphonic_audio import configuration, validate_duration
class AudioTests(unittest.TestCase):
 def preset(self):
  return {'preset_name':'FMT Interview Editor','algorithms':{'denoisemethod':'dynamic','filtermethod':'autoeq','silence_cutter':False},'outgoing_services':[{'uuid':'never-publish'}],'speech_recognition':{'engine':'example'}}
 def test_does_not_inherit_publishing_or_transcription(self):
  c=configuration(self.preset());self.assertEqual(c['outgoing_services'],[]);self.assertIsNone(c['speech_recognition']);self.assertEqual(c['output_files'][0]['format'],'wav')
 def test_blocks_cuts(self):
  p=self.preset();p['algorithms']['silence_cutter']=True
  with self.assertRaises(ValueError):configuration(p)
 def test_blocks_speech_isolation_for_music(self):
  p=self.preset();p['algorithms']['denoisemethod']='speech_isolation'
  with self.assertRaises(ValueError):configuration(p)
 def test_blocks_studio_voice_for_music(self):
  p=self.preset();p['algorithms']['filtermethod']='studiovoice'
  with self.assertRaises(ValueError):configuration(p)
 def test_rejects_time_change(self):
  with tempfile.TemporaryDirectory() as d:
   def audio(name,n):
    p=Path(d)/name
    with wave.open(str(p),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(48000);w.writeframes(b'\0'*n*4)
    return p
   a=audio('a.wav',48000);b=audio('b.wav',48000);self.assertEqual(validate_duration(a,b),0)
   b=audio('b.wav',47000)
   with self.assertRaises(ValueError):validate_duration(a,b)
if __name__=='__main__':unittest.main()
