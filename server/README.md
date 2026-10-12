# Plant Doctor AI Assistant Backend

This tiny Node.js server keeps the LLM API key off the APK/frontend. The Android app calls this server when it is reachable, and falls back to the local offline assistant when it is not.

The primary provider is Groq. For compatibility with the existing Render setup, Groq still uses the existing environment variable names `OPENAI_API_KEY` and `OPENAI_MODEL`.
# Plant Doctor AI Assistant Backend

This tiny Node.js server keeps the LLM API key off the APK/frontend. The Android app calls this server when it is reachable, and falls back to the local offline assistant when it is not.

The primary provider is Groq. For compatibility with the existing Render setup, Groq still uses the existing environment variable names `OPENAI_API_KEY` and `OPENAI_MODEL`.

## Render settings

Create a **Web Service** on Render and use these values:

```text
Root Directory: server
Runtime: Node
Build Command: npm install
Start Command: npm start
Health Check Path: /health
```

Add this Groq environment variable set in Render:

```text
OPENAI_API_KEY=your_groq_key_here
OPENAI_MODEL=openai/gpt-oss-20b
```

Optional Gemini fallback instead:

```text
GEMINI_API_KEY=your_gemini_key_here
GEMINI_MODEL=gemini-1.5-flash
```

After Render deploys, your app endpoint will look like:

```text
https://YOUR-SERVICE-NAME.onrender.com/api/plant-assistant
```

Put that URL in the APK's **Backend URL** field, or update:

```text
app/src/main/assets/assistant-config.json
```

Then rebuild/sign the APK. Never put an OpenAI or Gemini API key in frontend assets.

## Local test

```powershell
$env:OPENAI_API_KEY="your_groq_key_here"
$env:OPENAI_MODEL="openai/gpt-oss-20b"
npm start
```

Then open:

```text
http://localhost:8787/health
```


## Render settings

Create a **Web Service** on Render and use these values:

```text
Root Directory: server
Runtime: Node
Build Command: npm install
Start Command: npm start
Health Check Path: /health
```

Add this Groq environment variable set in Render:

```text
OPENAI_API_KEY=your_groq_key_here
OPENAI_MODEL=openai/gpt-oss-20b
```

Optional Gemini fallback instead:

```text
GEMINI_API_KEY=your_gemini_key_here
GEMINI_MODEL=gemini-1.5-flash
```

After Render deploys, your app endpoint will look like:

```text
https://YOUR-SERVICE-NAME.onrender.com/api/plant-assistant
```

Put that URL in the APK's **Backend URL** field, or update:

```text
app/src/main/assets/assistant-config.json
```

Then rebuild/sign the APK. Never put an OpenAI or Gemini API key in frontend assets.

## Local test

```powershell
$env:OPENAI_API_KEY="your_groq_key_here"
$env:OPENAI_MODEL="openai/gpt-oss-20b"
npm start
```

Then open:

```text
http://localhost:8787/health
```

