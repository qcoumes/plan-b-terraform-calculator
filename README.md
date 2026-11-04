# Plan B: Terraform calculator

A production planner for Plan B: Terraform.

Use it online: **https://qcoumes.github.io/plan-b-terraform-calculator/**

## Running the app locally

Each release is published as a Docker image (the built site, served by nginx on port 8080):

```sh
docker run --rm -p 8080:8080 ghcr.io/qcoumes/plan-b-terraform-calculator:latest
```

Then open http://127.0.0.1:8080.

With Docker Compose, put this in a `compose.yaml` and run `docker compose up -d`:

```yaml
services:
  calculator:
    image: ghcr.io/qcoumes/plan-b-terraform-calculator:latest
    ports:
      - "8080:8080"
    restart: unless-stopped
```

- Replace `latest` with a version (e.g. `1.0.0`) to stay on a given release.

## Development

You only need Docker with Compose:

```sh
docker compose up
```

Edit the code on your machine and the page reloads. The first start installs the dependencies; later starts reuse them.

Run other commands in the same container, always with `-u node` so the files they create belong to you:

```sh
docker compose exec -u node app <command>
```

| Command | What it does |
|---|---|
| `yarn verify` | Type check, lint and tests |
| `yarn check-data` | Checks `src/assets/data.json` |
| `yarn center-icons` | Lines up new icons with the text next to them |
| `yarn build` | Builds the site into `dist/` |
| `yarn add <package>` | Adds a dependency |
| `bash` | Opens a shell |

## Reading the results

Durations are in in-game **days** and rates are **per year**, like in the game ("Process duration: 10 days", "Annual production cycles: 30"). One year is 300 days.

## Updating the game data

After a game update, edit `src/assets/data.json` by hand, then run `yarn check-data`. The file has one entry per line:

```json
{
  "game": {"version": "1.1.4", "build": "1397"},
  "daysPerYear": 300,
  "ui": { "UI_Selection_Progress": {"en": "Process duration: {0} days", "fr": "…"} },
  "items": {
    "steel": {"names": {"en": "Steel Bar", "fr": "…"}, "group": "construction", "icon": "icons/steel.png"},
    "factory": {"names": {"en": "Factory", "fr": "…"}, "group": "transformation", "isBuilding": true, "icon": "icons/factory.png"}
  },
  "recipes": [
    {"id": 7, "building": "factory", "inputs": {"iron": 3}, "outputs": {"steel": 1}, "days": 10}
  ]
}
```

- `game`: the game version the data matches, shown in Options.
- `ui`: strings copied from the game's localization file (`Plan B Terraform_Data/StreamingAssets/Localization/PlanB_Localization.txt`), so the wording matches the game.
- `items`, keyed by the game's item id:
  - `names`: `en` is required; the other languages (`fr`, `de`, `es`, `it`, `pt`) fall back to English. Copy them from the localization file rather than translating them.
  - `group`: the game's `uiGroup`, which sets the item's colour and section.
  - `isBuilding`: `true` for buildings and other placeable things.
  - `icon`: a path relative to `src/assets/` (e.g. `icons/steel.png`), or `null`. After adding an icon, run `yarn center-icons`.
- `recipes`:
  - `id`: a stable key, since saved recipe choices refer to it. Give a new recipe an unused id, and never reuse a removed recipe's id.
  - `inputs` and `outputs`: item ids mapped to quantities per production cycle.
  - `days`: how long one production cycle takes, in in-game days.
  - Optional flags, `false` by default: `locked` (never picked as an item's default recipe), `extraction` (output boosted by the "extraction" tech), `synthetic` (not in the game's recipe files; used for the ground and floating Extractors).
