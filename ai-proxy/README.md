# BAYOU AI proxy

Small serverless proxy that keeps the DeepSeek API key server-side. The
public site (GitHub Pages) calls this endpoint instead of calling DeepSeek
directly, so the paid key is never exposed in browser code.

## Setup

1. Deploy this folder to Vercel (`vercel --prod` from inside `ai-proxy/`).
2. In the Vercel project dashboard → Settings → Environment Variables, add:
   - `DEEPSEEK_API_KEY` = your DeepSeek API key (Production scope)
3. Redeploy (`vercel --prod`) so the function picks up the new variable.
4. Update `AI_ENDPOINT` in the site's `index.html` to this project's URL,
   e.g. `https://<project>.vercel.app/api/chat`.

Never commit the API key to git or paste it into a chat/AI session — enter
it only in the Vercel dashboard or via `vercel env add` in your own terminal.

## Allowed origins

`api/chat.js` only answers CORS requests from origins listed in
`ALLOWED_ORIGINS`. Update that list if the site moves to a custom domain.
