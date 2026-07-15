# Vlogger

A simple video trimmer, assembler, and movie maker that helps vloggers turn a collection of raw video files into a concise, coherent edit.

## Idea

The user starts by dropping a collection of video files into the application. Vlogger analyzes every file and creates two artifacts:

1. **Timestamped transcription** — transcribe the spoken content with GPT-4o Mini, retaining timestamps so every line can be mapped back to the relevant part of the source video.
2. **Screen-cap roll** — sample frames throughout the video and combine them into a single time-lapsed thumbnail sheet that provides a quick visual overview of the footage.

The timestamped transcript explains what was said, while the screen-cap roll shows what was happening. These artifacts are sent together to an LLM, which evaluates the complete collection, identifies the strongest moments, and recommends the best sections to include in the final video.

## User interface

The main screen should keep the input process focused around three sections:

- **Footage** — a large drop area for adding all source video files.
- **Vibe** — a text input describing what the user wants the finished video to feel like and which kinds of moments should be kept.
- **Target length** — a duration input defining the desired length of the finished video.

## Workflow

1. Drop in a collection of raw video files.
2. Transcribe each video with timestamps using GPT-4o Mini.
3. Generate a time-lapsed screen-cap roll for each video.
4. Give the transcripts and screen-cap rolls to an LLM for combined semantic and visual analysis.
5. Select the best moments from the source footage.
6. Trim and assemble the selected clips into a finished movie.

## Goal

Make editing a vlog as simple as providing the raw footage: the application should understand the content, find the best minutes, and create a strong first cut that the vlogger can review and refine.
