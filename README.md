# AutoJob — Custom Job Application Automation Engine

A self-hosted, 24/7 background job application automation engine specifically engineered for **LinkedIn** and **Internshala**. It strictly enforces an anti-ban cap of **5 applications per day**, incorporates dynamic LLM-based cover letter tailoring and form questionnaire answering via **free APIs (Google Gemini 2.5 Flash / Groq Llama 3.3 70B)**, provides **human-in-the-loop CAPTCHA/OTP bypass over Telegram**, and features a modern high-performance **Next.js 15 + Tailwind CSS v4 + Shadcn UI** web dashboard.

---

## 🏛️ System Architecture & 5-Phase Blueprint

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Phase 1: Onboarding                             │
│   Master Resume (PDF) ──> LLM Text Extractor ──> SQLite Profile Matrix │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│                    Phase 2: Job Monitoring & Scraper                   │
│   Target Keywords ──> Playwright (Stealth) ──> Isolated Job Listing & JD
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│                      Phase 3: LLM Context Weaver                       │
│   Candidate Profile + JD ──> Gemini / Groq ──> Tailored 150-Word Letter│
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│                 Phase 4: Auto-Submission & Logging                    │
│   Submit Form Data ──> Strict 5/Day Cap Check ──> Local SQLite Audit   │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│                 Phase 5: Human-In-The-Loop Exception                   │
│   .captcha / OTP Detected ──> Instant Telegram Alert ──> Safe Pause    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Key Features

- **Strict Daily Quota Protection**: Enforces an un-bypassable cap of 5 applications per day (tracked in SQLite) to safeguard your LinkedIn and Internshala accounts.
- **Dynamic 150-Word Cover Letter Weaver**: Generates crisp, hyper-personalized 120–150 word purpose statements matching your specific projects and skills to the company's job description without generic clichés.
- **Zero-Shot Form Questionnaire Answering**: Automatically answers custom employer screening questions (e.g., years of experience, why hire you, notice period, skill evaluations).
- **Stealth Browser Automation**: Randomized human emulation (variable typing speed, organic delays, mouse trajectories, non-automated flags).
- **Human-In-The-Loop Exception Handling**: Detects CAPTCHAs, OTPs, or authentication checkpoints, takes an instant screenshot, notifies your phone via Telegram, and safely pauses the script for your intervention.
- **High-Density Application History Grid**: Modern Next.js 15 App Router data table with platform badges, search/filtering, and tailored letter inspection modal.
- **Universal RFC 4180 CSV Export Engine**: Instant, client-side compiled CSV download without redundant server roundtrips.

---

## 📦 Installed Agent Skills

Installed via `skills.sh` / GitHub directly into `.agents/skills`:
1. `shadcn`: Modern UI primitives and components.
2. `tailwind-v4-shadcn`: Tailwind CSS v4 CSS variables architecture, `@theme inline`, and dark theme styling.
3. `playwright-best-practices`: Playwright automation patterns, persistent context handling, locators, and resilience.
4. `vercel-react-best-practices`: Performance optimization guidelines for Next.js 15 & React 19.

---

## 🛠️ Quick Start

### 1. Configure Environment (`.env`)
Copy `.env.example` to `.env` and fill in your keys:

```bash
# Free LLM APIs:
# Get free Gemini key: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=your_gemini_key

# Get free Groq key: https://console.groq.com/keys
GROQ_API_KEY=your_groq_key

# Active LLM ("gemini" or "groq")
ACTIVE_LLM_PROVIDER=gemini

# Telegram Alert Configuration:
# Create a bot via @BotFather on Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
# Find your numeric ID via @userinfobot
TELEGRAM_CHAT_ID=your_numeric_chat_id

# Quota & Browser Settings
DAILY_APPLICATION_CAP=5
HEADLESS_BROWSER=false
```

### 2. Initialize SQLite Database
```bash
npm run db:init
```

### 3. Start the Next.js Dashboard
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🤖 Running the Automation Engine

### Option A: Via Web UI
1. Navigate to **Master Profile** (`/profile`) and upload your resume PDF.
2. Verify target job titles and skills.
3. Go to **Runner Console** (`/runner`) or click **Start Run** in the header.

### Option B: Via Command Line (Background / Daemon)
```bash
# Test run without submitting
npm run bot:run -- --dry-run

# Live application run
npm run bot:run
```

### Option C: 24/7 Automated Cron Job
Add to your Linux crontab (`crontab -e`) to execute on schedule (e.g. at 9:00 AM and 2:00 PM):
```cron
0 9,14 * * * cd /path/to/AUTOJOB && npm run bot:run >> /var/log/autojob.log 2>&1
```

---

## 🧪 Testing CAPTCHA & Telegram Alerts
To test your Telegram bot notification and alert snapshot bridge:
```bash
npm run bot:test-captcha
```
Or click **"Send Test Telegram Ping"** under **Settings** (`/settings`) in the dashboard.
