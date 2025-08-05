import sys
import whisper

if len(sys.argv) != 3:
    print("Usage: python3 wsp.py <input.wav> <output.txt>")
    sys.exit(1)

audio_path = sys.argv[1]
output_path = sys.argv[2]

model = whisper.load_model("base")
result = model.transcribe(audio_path)

# ✅ Write the result to the specified output file
with open(output_path, "w", encoding="utf-8") as f:
    f.write(result['text'])
