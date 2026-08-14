# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

## Release (auto-update)

The desktop app ships with auto-update support wired through GitHub Releases. To cut a release:

1. The repo must be on GitHub (the updater endpoint in `src-tauri/tauri.conf.json` currently uses a `<user>/<repo>` placeholder — replace it with your real repository path).
2. Add two GitHub Actions secrets to the repo: `TAURI_SIGNING_PRIVATE_KEY` (contents of `%USERPROFILE%\.tauri\pulse.key`) and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (that key's password). Without them the workflow cannot sign the update manifest.
3. Tag a version (e.g. `v0.1.0`) and push it. The `.github/workflows/release.yml` workflow builds the NSIS installer, signs it, and uploads the installer plus the updater manifest (`latest.json`) to a draft GitHub Release.

The app then checks that Release for updates on launch and prompts the user to install newer versions.
