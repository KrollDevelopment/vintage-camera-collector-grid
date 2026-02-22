# Vintage Camera Collector Grid

A small web app for generating curated shelf-grid backgrounds containing historically accurate vintage cameras in strict orthographic side views.

## Features

- Choose final output resolution.
- Choose number of cameras to render.
- Pick shelf material (wood, marble, glass, brushed metal).
- Generates each camera per-cell using that cell's background as image input so reflections/contact shadows match the shelf context.
- Download final composited PNG.

## Run

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## OpenAI Image Generation (optional)

Set `OPENAI_API_KEY` to enable model-backed cell generation:

```bash
export OPENAI_API_KEY=your_key_here
npm start
```

Without an API key, the app uses a local fallback renderer (SVG placeholders) so you can still test layout and export flow.
