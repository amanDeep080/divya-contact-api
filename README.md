# Divya Singh — Contact API (Backend)

Express.js contact form API. Deployed on **Render** (free tier).

## Files
```
backend/
├── server.js       ← Express API with nodemailer
├── package.json    ← dependencies
├── .env.example    ← copy to .env and fill values
├── .gitignore      ← keeps .env and node_modules out of git
└── README.md
```

## Local Development
```bash
cd backend
npm install
cp .env.example .env
# Fill in your values in .env
npm run dev
```
Test at: http://localhost:3000

## Deploy to Render
1. Push this `backend/` folder to a GitHub repo (e.g. `divya-contact-api`)
2. Go to render.com → New → Web Service
3. Connect the repo
4. Settings:
   - Runtime: **Node**
   - Build Command: `npm install`
   - Start Command: `node server.js`
   - Plan: **Free**
5. Add Environment Variables (from .env.example)
6. Deploy → copy the Render URL

## Environment Variables
| Key | Description |
|-----|-------------|
| `GMAIL_USER` | Your Gmail address |
| `GMAIL_APP_PASS` | 16-char App Password from Google |
| `RECEIVER_EMAIL` | Email to receive contact messages |
| `FRONTEND_URL` | Your Vercel URL (for CORS) |
| `PORT` | 3000 (Render sets this automatically) |
