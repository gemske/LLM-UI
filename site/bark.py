import sys
from bark import generate_audio, preload_models, save_as_audio

text = sys.argv[1]
output_path = sys.argv[2]

preload_models()
audio_array = generate_audio(text)
save_as_audio(audio_array, output_path)