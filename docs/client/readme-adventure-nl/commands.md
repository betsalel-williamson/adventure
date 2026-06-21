# Commands

```sh
npm install
npm run check
npm run build
```

From repository root, `make clean` removes `adventure-nl/node_modules` for a full reinstall.

### CLI

After `npm run build`:

```sh
npm start
```

Or: `node dist/cli/main.js`

With **`GEMINI_API_KEY`**, the first line can be natural language; after that, classic GETIN input until `.quit` / `:q`.

**`npm start -- --classic`** — Fortran-only TTY (no NL).

**`npm start -- --autoplay`** — self-acting mode with text model planning (requires configured provider; not compatible with `--classic`).

See [`.env.example`](.env.example) for provider configuration.
