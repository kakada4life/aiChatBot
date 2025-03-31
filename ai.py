import os
import subprocess
import wave
import numpy as np
from flask import Flask, request, jsonify, render_template
import requests
from langdetect import detect
from google.cloud import speech

# Initialize Google Cloud Speech client
client = speech.SpeechClient()

app = Flask(__name__)
UPLOAD_FOLDER = 'uploads/'

# Set your Google Translate API Key (replace with actual key)
API_KEY = 'AIzaSyB7K5gZJGE0sR_4adpxkudJVc2Mhh1wzSs'
TRANSLATE_URL = "https://translation.googleapis.com/language/translate/v2"


def detect_language(text):
    try:
        return detect(text)
    except Exception as e:
        print(f"Error detecting language: {e}")
        return "en"


def save_wav(file_path, audio_data, sample_rate=16000):
    try:
        with wave.open(file_path, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes(np.frombuffer(audio_data, dtype=np.int16).tobytes())
        print(f"WAV file saved: {file_path}")
    except Exception as e:
        print(f"Error in save_wav: {e}")


def simple_chatbot(message):
    try:
        response = requests.post("http://localhost:11434/api/generate", json={
            "model": "gemma:2b",
            "prompt": message,
            "stream": False
        })
        return response.json().get("response", "I'm sorry, I couldn't generate a response.")
    except Exception as e:
        print(f"Ollama error: {e}")
        return "Error communicating with the AI model."


def transcribe_audio(file_path):
    with open(file_path, 'rb') as audio_file:
        content = audio_file.read()

    audio = speech.RecognitionAudio(content=content)

    # Try Khmer first
    config_khmer = speech.RecognitionConfig(
        encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
        sample_rate_hertz=16000,
        language_code="km-KH",
    )

    response = client.recognize(config=config_khmer, audio=audio)

    if response.results:  # If Khmer transcription succeeds, return it
        return response.results[0].alternatives[0].transcript

    # If Khmer fails, try English
    config_english = speech.RecognitionConfig(
        encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
        sample_rate_hertz=16000,
        language_code="en-US",
    )

    response = client.recognize(config=config_english, audio=audio)

    if response.results:
        return response.results[0].alternatives[0].transcript

    return ""  # Return empty string if no transcription is found



def translate_text(text, source, target):
    try:
        response = requests.post(TRANSLATE_URL, data={
            'q': text, 'source': source, 'target': target, 'key': API_KEY
        }).json()
        return response['data']['translations'][0]['translatedText']
    except Exception as e:
        print(f"Translation error ({source} to {target}): {e}")
        return text


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/upload", methods=["POST"])
def upload():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    ext = file.filename.rsplit('.', 1)[-1].lower()
    if ext not in ['wav', 'webm', 'ogg']:
        return jsonify({"error": "Unsupported audio format"}), 400

    input_file, converted_path = "received_input." + ext, "fixed_audio.wav"
    file.save(input_file)

    try:
        subprocess.run(["ffmpeg", "-y", "-i", input_file, "-ar", "16000", "-ac", "1", converted_path], check=True)
        transcription = transcribe_audio(converted_path)

        if not transcription:
            return jsonify({"error": "Transcription failed"}), 500

        # **Force Khmer detection based on Unicode range**
        is_khmer = any('\u1780' <= c <= '\u17ff' for c in transcription)

        if is_khmer:
            transcription = translate_text(transcription, 'km', 'en')

        reply = simple_chatbot(transcription)

        if is_khmer:
            print("Detected Khmer, translating back to Khmer...")
            reply = translate_text(reply, 'en', 'km')
            transcription = translate_text(transcription, 'en', 'km')

        return jsonify({"reply": reply, "transcription": transcription, "language": 'km' if is_khmer else 'en'})

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500




@app.route("/chat", methods=["POST"])
def chat():
    message = request.json.get("message", "")
    lang = 'km' if any('\u1780' <= c <= '\u17ff' for c in message) else 'en'

    if lang == 'km':
        message = translate_text(message, 'km', 'en')

    reply = simple_chatbot(message)

    if lang == 'km':
        reply = translate_text(reply, 'en', 'km')

    return jsonify({"reply": reply, "original_language": lang})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
