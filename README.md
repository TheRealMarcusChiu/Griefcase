# Griefcase

*Familiar things. For unfamiliar days.*

A play on *briefcase*: a small, private case in your browser for the familiar things that console you while grieving — photos, words, songs and people or places that feel like home — plus a quiet-moment space with an optional one-minute paced breath.

Griefcase is a personal keepsake tool. It is **not therapy, medical care or a crisis service**. If you or someone else is in immediate danger, contact your local emergency services.

## What it does

- **Open my case** — four compartments: *Memories & photos*, *Words to keep*, *Familiar sounds* (optional http/https music link, opened in a new tab; nothing autoplays) and *People & places* (optional contact note or location). Add, edit and remove items. Each form shows only the fields for that compartment.
- **Photos** — JPEG, PNG or WebP up to 15 MB, resized and re-encoded as JPEG on your device (canvas). No SVG and no remote image URLs.
- **Sample ideas** — four clearly labelled, removable suggestions. They are not real records.
- **Backups** — export a JSON file; import validates the whole file before asking to replace your case. Malformed or oversized files change nothing.
- **Take a quiet moment** — optional sensory prompts, a 60-second breathing cue (in 4, out 6, no holding) that starts only when you press start and can be stopped anytime, and a small card of practical comforts. No streaks, scores or reminders.

## Privacy

- Everything is stored in this browser’s `localStorage` on this device. Nothing is sent anywhere: no accounts, analytics, trackers, fonts or network requests (enforced with a Content Security Policy, `connect-src 'none'`).
- Storage is **not encrypted**. Anyone using the same device and browser profile can see it.
- **Browser data can disappear** — clearing site data, private browsing, storage pressure or switching browsers will lose it. **Export backups regularly** and keep them somewhere private (they contain your photos and words unencrypted).
- If saving fails (e.g. storage is full), Griefcase says so, keeps your change in the open tab, and asks you to export. If saved data can’t be read, it is never overwritten until you import a backup or clear all data.
- *Clear all data* (with confirmation) removes everything Griefcase stored.

## Develop

No dependencies, no build step. Plain HTML, CSS and JavaScript ES modules.

```sh
npm test          # Node built-in test runner (model, storage, breathing schedule)
npm run check     # syntax check of all modules
python3 -m http.server 8000   # then open http://localhost:8000 (ES modules don't load from file://)
```

## Deploy (GitHub Pages)

Settings → Pages → *Deploy from a branch* → branch `main`, folder `/ (root)`. `.nojekyll` is included so files are served as-is. No Actions workflow is needed.

## License

MIT — see [LICENSE](LICENSE).
