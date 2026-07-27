# App Deployment Playbook

A generic, repeatable recipe for building, hosting, auto-updating, and
installing small web apps on iPhone. Copy this file into any new app folder
and follow it top to bottom, replacing the placeholders.

Throughout, `<app>` is your app's short name. The **War Room** values are
shown as the worked example:

| Placeholder | War Room value |
|---|---|
| `<app>` | `war-room` |
| App folder | `/Users/fillip/App_test/war-room` |
| GitHub repo | `fillipkja/war-room` (public) |
| Live URL | `https://fillipkja.github.io/war-room/` |
| launchd label | `com.warroom.daily` |
| Local dev port | `8642` |
| iOS bundle id | `no.datafabric.warroom` |
| Swift package | `/Users/fillip/App_test/WarRoom.swiftpm` |

---

## 1. Architecture: static web app, data separated from code

Build the app as a **plain static site** — no build step, no bundler, no
server. Everything deploys by copying files.

```
<app>/
├── index.html            # markup + ALL CSS (single file)
├── app.js                # all app logic / rendering
├── data.js               # THE CONTENT — the only file that changes routinely
├── vendor/               # third-party libs, committed (d3, topojson, map data…)
├── emblems/ | assets/    # images and other static assets
├── manifest.webmanifest  # PWA manifest
├── sw.js                 # service worker (network-first)
├── icons/                # PWA icons
├── scripts/
│   └── daily-update.sh   # the auto-update job (section 5)
├── UPDATE_BRIEF.md       # instructions Claude follows for each update (section 5)
├── logs/                 # update logs (gitignored)
└── .gitignore            # contains: logs/
```

Key principles:

1. **Code vs. content split.** All routine updates touch only `data.js`
   (plus new asset files). App code (`index.html`, `app.js`) only changes
   when you deliberately change design/behavior. This is what makes
   automated updates safe.
2. **Vendor everything.** Commit third-party libraries into `vendor/`
   instead of using CDNs — the app works offline and never breaks because
   a CDN changed.
3. **No build step.** What's in the repo is what's served. Deploy = git push.

## 2. Local development & preview

Serve the folder locally:

```bash
cd /Users/fillip/App_test/<app>
python3 -m http.server 8642        # pick a unique port per app
# open http://localhost:8642
```

**Verification with headless Chrome screenshots** (works for automation too):

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless \
  --disable-gpu --window-size=580,1030 \
  --screenshot=/tmp/<app>_check.png \
  --virtual-time-budget=4000 \
  "http://localhost:8642/?item=1"
```

Tip: animations don't run in headless captures, so build **deep-link query
params** into the app that jump straight to a state you want to inspect.
War Room supports `?item=N`, `?item=N&tight`, `?item=N&stop=2`.

## 3. Hosting: GitHub Pages (deploy = push)

One-time setup per app:

```bash
cd /Users/fillip/App_test/<app>
git init
printf 'logs/\n' > .gitignore
git add -A && git commit -m "Initial commit"

# create a PUBLIC repo and push (public = free GitHub Pages)
gh repo create fillipkja/<app> --public --source=. --push

# enable Pages, serving from the main branch root
gh api repos/fillipkja/<app>/pages -X POST \
  -f 'source[branch]=main' -f 'source[path]=/'
```

The app is then live at `https://fillipkja.github.io/<app>/`.

**The entire deployment cycle from then on is:**

```bash
git add -A
git commit -m "Describe the change"
git push          # GitHub Pages redeploys automatically (~1 min)
```

Never force-push — the automated updater assumes linear history.

## 4. PWA (installable, works fullscreen on phone)

Three small additions make the site installable from Safari/Chrome:

1. `manifest.webmanifest` — name, `display: "standalone"`, theme colors,
   icons. Link it from `index.html`:
   `<link rel="manifest" href="manifest.webmanifest">`
2. `icons/` — at least 192px and 512px PNGs, plus
   `<link rel="apple-touch-icon" ...>` for iOS.
3. `sw.js` — a **network-first** service worker (try network, fall back to
   cache). Network-first matters for apps whose content updates daily;
   cache-first would show stale data.

Also add safe-area CSS for phones:
`padding: env(safe-area-inset-top) ... env(safe-area-inset-bottom)`.

## 5. Automated daily updates (launchd + Claude headless)

The content refresh is done by Claude Code running headless every morning,
driven by two files in the repo and one launchd plist.

### 5a. `UPDATE_BRIEF.md` — the standing instructions

A markdown prompt, committed to the repo, that tells Claude exactly how to
perform one update. Structure it in four sections (see War Room's
`UPDATE_BRIEF.md` for a full example):

1. **Research** — what to look up, how many items, freshness rules.
2. **Rewrite `data.js`** — "keep the exact existing schema, read the
   current file first", plus every field's format rules and any
   validation commands to run. Explicitly say **modify ONLY `data.js`**
   (and assets) — never app code.
3. **Verify** — start the local server, take headless-Chrome screenshots
   of specific deep links, view them, fix and re-check if broken.
4. **Ship** — `git add -A`, commit as `Daily brief — <date>`, `git push`.
   No force-push.

The better this file encodes your validation steps, the safer the
automation. Whenever a manual fix teaches you a new failure mode, add the
rule to `UPDATE_BRIEF.md`.

### 5b. `scripts/daily-update.sh` — the runner

```zsh
#!/bin/zsh
# <App> daily update — invoked by launchd every morning.
set -euo pipefail

cd "/Users/fillip/App_test/<app>"
mkdir -p logs

# launchd has a minimal PATH; add wherever `claude` lives
export PATH="/Users/fillip/.local/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"

echo "=== <App> update $(date) ==="

claude -p "$(cat UPDATE_BRIEF.md)" \
  --allowedTools "Bash,Read,Edit,Write,Glob,Grep,WebSearch,WebFetch" \
  --max-turns 80

echo "=== done $(date) ==="
```

```bash
chmod +x scripts/daily-update.sh
```

### 5c. launchd job — `~/Library/LaunchAgents/com.<app>.daily.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.<app>.daily</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>mkdir -p /Users/fillip/App_test/<app>/logs; /Users/fillip/App_test/<app>/scripts/daily-update.sh >> /Users/fillip/App_test/<app>/logs/update.log 2>&1</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key><integer>6</integer>
    <key>Minute</key><integer>43</integer>
  </dict>
  <key>RunAtLoad</key>
  <false/>
</dict>
</plist>
```

Pick a distinct time per app (stagger them). Load / manage it:

```bash
launchctl load  ~/Library/LaunchAgents/com.<app>.daily.plist   # enable
launchctl unload ~/Library/LaunchAgents/com.<app>.daily.plist  # disable
launchctl list | grep <app>                                    # check loaded
launchctl start com.<app>.daily                                # trigger now (test)
tail -f /Users/fillip/App_test/<app>/logs/update.log           # watch it run
```

launchd behavior to know: if the Mac was **asleep** at the scheduled time,
the job fires on next wake; if it was **shut down**, that day's run is
skipped entirely.

## 6. iPhone app (SwiftUI WKWebView shell)

A thin native wrapper around the hosted URL so the app gets a real home
screen icon and fullscreen presentation.

### 6a. Structure — `/Users/fillip/App_test/<App>.swiftpm`

A Swift Playgrounds-style app package: `Package.swift` +
`Sources/<App>App.swift` + `Sources/ContentView.swift`.

`Package.swift` uses `.iOSApplication` (copy `WarRoom.swiftpm/Package.swift`
and change the fields):

- `bundleIdentifier: "no.datafabric.<app>"`
- `teamIdentifier: "S274CCLJS8"`
- name, icon placeholder, accent color, portrait-only, iPhone-only.

`ContentView.swift` is a `UIViewRepresentable` wrapping a `WKWebView`
pointed at the live URL, with a **reload on foreground** (listen for
`UIApplication.willEnterForegroundNotification`) so users always see the
latest daily content.

### 6b. Build & install from the CLI

`xcode-select` on this machine points at the Command Line Tools, so the
`DEVELOPER_DIR` override is **required**:

```bash
# Build (device must be paired; find id with: xcrun devicectl list devices)
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
xcodebuild -scheme <App> \
  -destination 'platform=iOS,id=2A4EF61A-3626-5B0A-8FEB-155F005B09C3' \
  -derivedDataPath /tmp/<app>-dd \
  -allowProvisioningUpdates build

# Install onto the phone ("Fillip's iPhone 15")
xcrun devicectl device install app \
  --device 2A4EF61A-3626-5B0A-8FEB-155F005B09C3 \
  "/tmp/<app>-dd/Build/Products/Debug-iphoneos/<App Display Name>.app"
```

Notes:
- Run `xcodebuild` from inside the `.swiftpm` folder.
- First install on the phone: Settings → General → VPN & Device Management
  → trust the developer certificate.
- With free-tier signing the app **expires after ~7 days** — just re-run
  the two commands above to reinstall. The web content itself never
  expires (it's the hosted site), only the shell.
- Because the shell just loads the URL, you almost never need to rebuild
  it; all app changes ship via git push.

## 7. Day-to-day cheat sheet

| Task | Command |
|---|---|
| Preview locally | `python3 -m http.server 8642` in the app folder |
| Deploy any change | `git add -A && git commit -m "..." && git push` |
| Force a content update now | `launchctl start com.<app>.daily` |
| Check last auto-update | `tail -50 logs/update.log` |
| See what changed | `git log --oneline -10` |
| Reinstall on iPhone | build + install commands in section 6b |
| Verify live site | open `https://fillipkja.github.io/<app>/` (hard-refresh; sw.js is network-first so content is fresh) |

## 8. New-app checklist

Copy this file into the new folder, then:

- [ ] Build the static app (`index.html` + `app.js` + `data.js` + `vendor/`)
- [ ] Add deep-link query params for automated screenshot verification
- [ ] Add PWA files (`manifest.webmanifest`, `sw.js` network-first, `icons/`)
- [ ] `git init`, `.gitignore` with `logs/`, create public repo, enable Pages
- [ ] Verify the live URL works
- [ ] Write `UPDATE_BRIEF.md` (research → rewrite data.js → verify → ship)
- [ ] Add `scripts/daily-update.sh`, `chmod +x`, test it manually once
- [ ] Create + load the launchd plist (unique label, staggered time)
- [ ] Trigger with `launchctl start`, check `logs/update.log` and the live site
- [ ] Copy `WarRoom.swiftpm` → `<App>.swiftpm`, update Package.swift fields
      and the URL in ContentView, build + install on the phone
- [ ] Trust the developer cert on the phone (first time only)
