# Research Intelligence Engine

A 10-stage AI-powered research pipeline that turns a brand brief into structured, evidence-based strategic intelligence. It runs as a Slack bot, conducts web research via Tavily, processes everything through Claude, and exports results incrementally to Notion.

This goes beyond "deep research." It doesn't just search and summarize — it extracts atomic insights, clusters them, maps tensions and contradictions, scores for strategic decision-relevance, and synthesizes across topics. The output is a structured intelligence foundation ready for strategy work.

## What It Does

1. You DM the Slack bot with a brand brief and optional file attachments
2. The pipeline defines 6 research topics, then researches each one in parallel
3. Each topic goes through deep web research, insight extraction, clustering, tension mapping, scoring, and synthesis
4. Results publish to Notion incrementally — you can start reading before it finishes
5. A final cross-topic synthesis ties everything together
6. A "shared brain" markdown export is uploaded to Slack for use in Claude Projects

A full run takes roughly 15–25 minutes.

## Pipeline Stages

| Stage | Name | What It Does |
|-------|------|-------------|
| 0 | Brand Overview | Passthrough — combines your message and attached documents |
| 1 | Topic Definition | Generates 6 non-overlapping, decision-critical research topics |
| 2 | Deep Research | Web search (Tavily) + evidence-based analysis per topic |
| 3 | Atomic Extraction | Breaks findings into 15 discrete, testable claims per topic |
| 4 | Normalize & Tag | Standardizes format, adds domain/polarity/confidence tags |
| 5 | Clustering | Groups related insights into thematic clusters |
| 6 | Tension Mapping | Identifies contradictions, structural tensions, boundary conditions |
| 7 | Insight Synthesis | Generates non-obvious strategic insights with evidence chains |
| 8 | Decision Scoring | Scores insights on positioning, trust, economics, GTM, risk |
| 9 | Cross-Topic Synthesis | Finds reinforcing patterns, cross-topic tensions, and open strategic questions |

Stages 2–8 run in parallel across all 6 topics.

## Supported File Types

Attach files to your Slack message for richer research context:

- **PDF** — brand briefs, pitch decks, reports
- **DOCX** — Word documents
- **XLSX / CSV** — spreadsheets, competitive data
- **Images** (PNG, JPG, GIF, WEBP) — screenshots, mood boards (parsed with Claude Vision)
- **TXT / MD** — plain text

Google Drive folder and file links in your message are also downloaded automatically (requires Google Drive setup).

---

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20.0.0
- [pnpm](https://pnpm.io/) (recommended) or npm
- API keys for: [Anthropic (Claude)](https://console.anthropic.com/), [Tavily](https://tavily.com/), [Slack](https://api.slack.com/), [Notion](https://www.notion.so/my-integrations)

---

## Setup

### 1. Clone and Install

```bash
git clone https://github.com/DanBatten/research-intelligence-engine.git
cd research-intelligence-engine
pnpm install
```

### 2. Create Your Slack App

Go to [api.slack.com/apps](https://api.slack.com/apps) and click **Create New App** > **From scratch**.

#### Enable Socket Mode

1. Go to **Settings > Socket Mode** in the left sidebar
2. Toggle **Enable Socket Mode** to On
3. You'll be prompted to create an App-Level Token — name it anything (e.g., `research-engine-socket`) and add the scope `connections:write`
4. Copy the token — this is your `SLACK_APP_TOKEN` (starts with `xapp-`)

#### Set Bot Token Scopes

Go to **Features > OAuth & Permissions** and add these **Bot Token Scopes**:

| Scope | Why |
|-------|-----|
| `chat:write` | Post progress updates and results |
| `files:read` | Download files users attach to messages |
| `files:write` | Upload the shared brain markdown export |
| `im:history` | Read DM messages sent to the bot |
| `im:read` | Access DM conversation metadata |
| `im:write` | Open DMs with users |

#### Enable Events

Go to **Features > Event Subscriptions**:

1. Toggle **Enable Events** to On
2. Under **Subscribe to bot events**, add: `message.im`
3. Click **Save Changes**

#### Enable DMs

Go to **Features > App Home**:

1. Under **Show Tabs**, make sure **Messages Tab** is checked
2. Check **Allow users to send Slash commands and messages from the messages tab**

#### Install to Workspace

1. Go to **Settings > Install App**
2. Click **Install to Workspace** and authorize
3. Copy the **Bot User OAuth Token** — this is your `SLACK_BOT_TOKEN` (starts with `xoxb-`)

### 3. Create Your Notion Integration

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click **New integration**
3. Name it (e.g., "Research Intelligence Engine") and select your workspace
4. Under **Capabilities**, enable:
   - **Read content**
   - **Update content**
   - **Insert content**
5. Copy the **Internal Integration Secret** — this is your `NOTION_API_KEY` (starts with `secret_`)

#### Connect a Parent Page

The bot creates a sub-page for each research project under a parent page you choose:

1. Create a page in Notion where you want research projects to live (e.g., "Research Hub")
2. Click the **...** menu on that page > **Connections** > search for your integration name and connect it
3. Copy the page ID from the URL — it's the 32-character hex string after the page title:
   ```
   https://www.notion.so/Your-Page-Title-abc123def456...
                                       ^^^^^^^^^^^^^^^^
                                       this is the page ID
   ```
   This is your `NOTION_PARENT_PAGE_ID`

### 4. Get Your API Keys

#### Anthropic (Claude)

1. Go to [console.anthropic.com](https://console.anthropic.com/)
2. Navigate to **API Keys** and create a new key
3. Copy it — this is your `ANTHROPIC_API_KEY` (starts with `sk-ant-`)

#### Tavily (Web Search)

1. Go to [tavily.com](https://tavily.com/) and create an account
2. Copy your API key from the dashboard — this is your `TAVILY_API_KEY` (starts with `tvly-`)

### 5. Configure Environment

```bash
cp .env.example .env
```

Fill in the required values:

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...
TAVILY_API_KEY=tvly-...
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
NOTION_API_KEY=secret_...
NOTION_PARENT_PAGE_ID=abc123def456...
```

### 6. Build and Run

```bash
pnpm build
pnpm start
```

You should see: `Deep Research V2 Slack bot is running (Socket Mode)`

DM the bot in Slack to start your first research project.

---

## Google Drive Setup (Optional)

If you want the bot to automatically download files from Google Drive links shared in Slack messages:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or select an existing one)
3. Enable the **Google Drive API** (APIs & Services > Library > search "Google Drive API")
4. Go to **IAM & Admin > Service Accounts** and create a service account
5. Create a JSON key for the service account and download it
6. Share any Google Drive folders/files you want the bot to access with the service account email address (e.g., `my-bot@my-project.iam.gserviceaccount.com`)
7. Set the `GOOGLE_SERVICE_ACCOUNT_KEY` environment variable to the **full JSON contents** of the key file:

```bash
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}
```

---

## Deploy on Railway

[Railway](https://railway.com/) is the simplest way to deploy this. The repo includes a `Procfile` that Railway uses automatically.

### Step-by-Step

1. **Create a Railway account** at [railway.com](https://railway.com/) and connect your GitHub

2. **Create a new project** — click **New Project** > **Deploy from GitHub repo** > select this repository

3. **Add environment variables** — go to your service's **Variables** tab and add all required env vars:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   TAVILY_API_KEY=tvly-...
   SLACK_BOT_TOKEN=xoxb-...
   SLACK_APP_TOKEN=xapp-...
   NOTION_API_KEY=secret_...
   NOTION_PARENT_PAGE_ID=...
   ```

4. **Configure the build** — Railway should auto-detect the Procfile. If not, set these in **Settings**:
   - **Build Command:** `pnpm install && pnpm build`
   - **Start Command:** `node dist/integrations/slack/app.js`

5. **Deploy** — Railway will build and start the bot. Check the **Logs** tab to confirm you see:
   ```
   Deep Research V2 Slack bot is running (Socket Mode)
   ```

6. **Done** — the bot connects to Slack via Socket Mode (outbound WebSocket), so no public URL or port configuration is needed.

### Notes

- **No public URL required** — Socket Mode means the bot initiates the connection to Slack. Railway doesn't need to expose a port.
- **Sessions are ephemeral** — Railway's filesystem resets on redeploy. This only affects the resume-from-session feature; completed research is already exported to Notion.
- **Auto-deploy** — Railway will redeploy on every push to `main` if you enable it.
- **Cost** — the bot is idle most of the time (no CPU when waiting for messages), so Railway's usage-based pricing keeps costs low. The main cost is the Anthropic API usage.

---

## CLI Mode

You can also run the pipeline locally from the command line without Slack:

```bash
pnpm dev "Your brand overview text here" path/to/brief.pdf path/to/data.xlsx
```

Results are saved to `sessions/cli-{timestamp}/` as JSON files.

---

## Environment Variables Reference

### Required

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key (`sk-ant-...`) |
| `TAVILY_API_KEY` | Tavily web search API key (`tvly-...`) |
| `SLACK_BOT_TOKEN` | Slack Bot User OAuth Token (`xoxb-...`) |
| `SLACK_APP_TOKEN` | Slack App-Level Token (`xapp-...`) |
| `NOTION_API_KEY` | Notion integration secret (`secret_...`) |
| `NOTION_PARENT_PAGE_ID` | Notion page ID where projects are created |

### Optional — Model Overrides

Override which Claude model is used at each stage. Defaults are tuned for quality vs cost:

| Variable | Default | Used For |
|----------|---------|----------|
| `MODEL_STAGE_1` | `claude-opus-4-6` | Topic definition |
| `MODEL_STAGE_2` | `claude-opus-4-6` | Deep research |
| `MODEL_STAGE_3` | `claude-sonnet-4-6` | Atomic extraction |
| `MODEL_STAGE_4` | `claude-haiku-4-5-20251001` | Normalize & tag |
| `MODEL_STAGE_5` | `claude-opus-4-6` | Clustering |
| `MODEL_STAGE_6` | `claude-opus-4-6` | Tension mapping |
| `MODEL_STAGE_7` | `claude-opus-4-6` | Insight synthesis |
| `MODEL_STAGE_8` | `claude-opus-4-6` | Decision scoring |
| `MODEL_STAGE_9` | `claude-opus-4-6` | Cross-topic synthesis |
| `MODEL_INTENT_PARSE` | `claude-haiku-4-5-20251001` | Slack message intent parsing |
| `MODEL_IMAGE_PARSE` | `claude-haiku-4-5-20251001` | Image-to-text (vision) |

To reduce costs, you can swap some stages to `claude-sonnet-4-6` — stages 5, 6, and 8 work well with Sonnet.

### Optional — Pipeline Tuning

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_CONCURRENT_API_CALLS` | `3` | Max parallel Claude API calls (rate limiting) |
| `MAX_RETRIES_PER_STAGE` | `2` | Retry count for failed stages |
| `RETRY_DELAY_MS` | `5000` | Delay between retries (ms) |
| `TAVILY_MAX_RESULTS` | `5` | Search results per query |
| `TAVILY_SEARCH_DEPTH` | `advanced` | Tavily search depth (`basic` or `advanced`) |
| `SESSIONS_DIR` | `./sessions` | Where session state is saved |
| `LOG_LEVEL` | `info` | Log verbosity (`debug`, `info`, `warn`, `error`) |

### Optional — Google Drive

| Variable | Default | Description |
|----------|---------|-------------|
| `GOOGLE_SERVICE_ACCOUNT_KEY` | — | Full JSON content of a service account key |
| `GDRIVE_MAX_FILES` | `25` | Max files to download from a Drive folder |

---

## Cost Considerations

The primary cost is Anthropic API usage. A single research run (6 topics) makes roughly 50–70 Claude API calls. With default model assignments:

- **Opus stages** (1, 2, 5–9): highest quality, highest cost
- **Sonnet stages** (3): good balance of quality and cost
- **Haiku stages** (4, intent, vision): lowest cost, used for simpler tasks

To reduce costs, swap model overrides in your `.env` — stages 4, 5, 6, and 8 are good candidates for Sonnet. Tavily's free tier includes 1,000 searches/month.

---

## Development

```bash
# Install dependencies
pnpm install

# Run in dev mode (CLI)
pnpm dev "brand overview text"

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Type check
pnpm typecheck

# Build for production
pnpm build
```

### Project Structure

```
src/
├── index.ts                  # CLI entry point
├── config.ts                 # Environment config (Zod validation)
├── integrations/
│   ├── slack/
│   │   ├── app.ts            # Slack bot startup (Socket Mode)
│   │   ├── handlers.ts       # Message handling + pipeline orchestration
│   │   └── progress.ts       # Slack thread progress updates
│   └── notion/
│       ├── exporter.ts       # Incremental Notion export
│       └── blocks.ts         # Notion block rendering
├── lib/
│   ├── llm.ts               # Claude API wrapper (structured + freeform)
│   ├── tavily.ts            # Web search integration
│   ├── gdrive.ts            # Google Drive download
│   ├── logger.ts            # Pino logger
│   └── semaphore.ts         # Concurrency control
├── parsers/
│   ├── index.ts             # Multi-format file parser
│   └── vision.ts            # Image-to-text via Claude Vision
├── pipeline/
│   ├── runner.ts            # Pipeline orchestrator
│   ├── types.ts             # Pipeline state types
│   ├── stages/              # Stage implementations (s0–s9)
│   └── schemas/             # Zod output schemas
└── export/
    └── shared-brain.ts      # Markdown export compiler
```

---

## License

[MIT](LICENSE)
