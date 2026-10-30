# greifcase

The site is a single static page showing one quote, centred on a warm dark background:

> The opposite of grief isn't happiness. The opposite of grief is forgetting, and as painful as grief is, you wouldn't wanna forget. The only way out isn't through, grief will always be with you and you'll be okay.

Plain HTML and CSS only: no JavaScript, forms, fonts, analytics or network requests (enforced with a Content Security Policy).

## Earlier comfort-case app and your browser data

Griefcase used to be a local-only "comfort case" app that kept photos, words, sounds and people in the browser's `localStorage`. That app has been retired; its code remains in git history (commit `948da50`).

The new page does not read, clear or migrate that data. Anything you stored is left untouched in your browser under the same site, but it is no longer viewable from this page. Clearing site data in your browser will remove it.

## Develop

No dependencies, no build step.

```sh
npm test          # static checks: exact sole visible text, no scripts/forms/buttons, CSS link, mobile-safe quote styles
npm run check     # syntax check of the test file
python3 -m http.server 8000   # then open http://localhost:8000
```

## Deploy (GitHub Pages)

Settings → Pages → *Deploy from a branch* → branch `main`, folder `/ (root)`. `.nojekyll` is included so files are served as-is. No Actions workflow is needed.

## License

MIT — see [LICENSE](LICENSE).
