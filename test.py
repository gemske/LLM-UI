from bark import generate_audio
from scipy.io.wavfile import write

audio_array = generate_audio("This is a test from Bark.")
write("output.wav", 22050, audio_array)
