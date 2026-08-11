# Markdawn

Markdawn is a web-based Markdown editor where the **preview is the editor**. It uses a rich-text Markdown editor so headings, lists, links, tables, code blocks, and images are directly editable in their styled form.

## Stack

- React + Vite
- TailwindCSS + DaisyUI
- `@mdxeditor/editor` for Markdown-aware rich text editing
- `vite-plugin-pwa` for offline support

## Features

- Editable rendered Markdown (not textarea + separate preview)
- Multiple open files represented as tabs
- Open local Markdown files (`.md`, `.markdown`, `.txt`)
- Save files with File System Access API when available
- Fallback download save flow when picker APIs are unavailable (Save and Save As collapse to one action)
- Session auto-recovery using `sessionStorage`
- Image insertion with local files embedded as **data URLs**
- YAML front matter metadata support (including toolbar insert action)
- GitHub Pages friendly static build

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy to GitHub Pages

Two options are included:

1. **GitHub Actions Pages workflow** (`.github/workflows/deploy-pages.yml`)
2. **Manual publish script** with `gh-pages`:

```bash
npm run deploy
```

The Vite `base` is set to `./` so the app works from project pages and custom static hosting paths.

## Offline behavior

After the first successful load, the generated service worker caches app assets so the editor can open without network.

## Browser compatibility notes

- File open/save picker APIs are used when available in Chromium-based browsers.
- In unsupported browsers, open uses file input and save uses file download.
- Multiple files can be opened at once and switched via tabs.
- `sessionStorage` draft recovery works broadly in modern browsers.
