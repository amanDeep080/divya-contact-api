const express    = require('express');
const nodemailer = require('nodemailer');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const helmet     = require('helmet');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3000;

// Trust Render's proxy (fixes express-rate-limit X-Forwarded-For error)
app.set('trust proxy', 1);

app.use(helmet());

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (Postman, curl)
    if (!origin) return cb(null, true);
    // Allow exact match from env var
    if (allowedOrigins.includes(origin)) return cb(null, true);
    // Allow any *.vercel.app domain (covers preview deployments too)
    if (origin.endsWith('.vercel.app')) return cb(null, true);
    console.warn(`CORS blocked origin: ${origin}`);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json({ limit: '10kb' }));

const limiter = rateLimit({
  windowMs : 15 * 60 * 1000,
  max      : 5,
  message  : { ok: false, error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders  : false,
});

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASS,
  },
});

function validateContact({ name, email, subject, message }) {
  const errors = [];
  if (!name    || name.trim().length < 2)    errors.push('Name must be at least 2 characters.');
  if (!email   || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Valid email is required.');
  if (!message || message.trim().length < 10) errors.push('Message must be at least 10 characters.');
  if (name    && name.length    > 100) errors.push('Name too long.');
  if (subject && subject.length > 200) errors.push('Subject too long.');
  if (message && message.length > 3000) errors.push('Message too long.');
  return errors;
}

app.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'Divya Portfolio — Contact API' });
});

app.post('/contact', limiter, async (req, res) => {
  const { name, email, subject, message } = req.body;

  const errors = validateContact({ name, email, subject, message });
  if (errors.length) return res.status(400).json({ ok: false, errors });

  const safeName    = name.trim().replace(/</g, '&lt;');
  const safeSubject = subject ? subject.trim().replace(/</g, '&lt;') : '(No subject)';
  const safeMsg     = message.trim().replace(/</g, '&lt;').replace(/\n/g, '<br>');
  const now         = new Date();

  const toOwner = {
    from   : `"Portfolio Contact" <${process.env.GMAIL_USER}>`,
    to     : process.env.RECEIVER_EMAIL || process.env.GMAIL_USER,
    replyTo: email,
    subject: `[Portfolio] ${safeSubject}`,
    html   : `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;background:#0a0a0a;color:#f5f5f5;border:1px solid #222;border-top:3px solid #FF2D2D">
        <div style="padding:24px 28px 0">
          <p style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#FF2D2D;margin:0 0 4px">New message via portfolio</p>
          <h2 style="margin:0 0 20px;font-size:20px;color:#fff">${safeSubject}</h2>
        </div>
        <div style="padding:0 28px 24px;border-bottom:1px solid #222">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <tr><td style="padding:6px 0;color:#7a7a7a;width:90px">From</td><td style="color:#f5f5f5">${safeName}</td></tr>
            <tr><td style="padding:6px 0;color:#7a7a7a">Email</td><td><a href="mailto:${email}" style="color:#FF2D2D">${email}</a></td></tr>
          </table>
        </div>
        <div style="padding:20px 28px 28px">
          <p style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#7a7a7a;margin:0 0 10px">Message</p>
          <p style="line-height:1.7;font-size:14px;color:#c8c8c8;margin:0">${safeMsg}</p>
        </div>
        <div style="padding:14px 28px;background:#111;font-size:11px;color:#4a4a4a">
          Sent via portfolio · ${now.toUTCString()}
        </div>
      </div>`,
  };

  const toSender = {
    from   : `"Divya Singh" <${process.env.GMAIL_USER}>`,
    to     : email,
    subject: `Thanks for reaching out, ${safeName.split(' ')[0]}!`,
    html   : `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;background:#0a0a0a;color:#f5f5f5;border:1px solid #222;border-top:3px solid #FF2D2D">
        <div style="padding:28px 28px 0">
          <p style="font-size:22px;font-weight:700;margin:0 0 6px;color:#fff">Hi ${safeName.split(' ')[0]},</p>
          <p style="font-size:13px;line-height:1.75;color:#c8c8c8;margin:0 0 20px">
            Thanks for getting in touch! I've received your message and will get back to you as soon as possible — usually within 24–48 hours.
          </p>
        </div>
        <div style="padding:0 28px 24px;border-top:1px solid #222">
          <p style="font-size:12px;color:#7a7a7a;margin:20px 0 4px;text-transform:uppercase;letter-spacing:0.12em">Your message</p>
          <p style="font-size:13px;color:#888;font-style:italic;line-height:1.6;margin:0;border-left:3px solid #FF2D2D;padding-left:12px">${safeMsg}</p>
        </div>
        <div style="padding:20px 28px 28px">
          <p style="margin:0;font-size:14px;color:#f5f5f5">Warm regards,</p>
          <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#FF2D2D">Divya Singh</p>
          <p style="margin:2px 0 0;font-size:11px;color:#7a7a7a;letter-spacing:0.12em;text-transform:uppercase">Broadcast Journalist · News Anchor</p>
        </div>
        <div style="padding:14px 28px;background:#111;font-size:11px;color:#4a4a4a">
          divyasingh08262@gmail.com · +91 6201713377
        </div>
      </div>`,
  };

  try {
    await transporter.sendMail(toOwner);
    await transporter.sendMail(toSender);
    console.log(`[${now.toISOString()}] ✅ Email sent — ${email}`);
    return res.json({ ok: true, message: 'Message sent! Check your inbox for a confirmation.' });
  } catch (err) {
    console.error(`[${now.toISOString()}] ❌ Mail error:`, err.message);
    return res.status(500).json({ ok: false, error: 'Failed to send email. Please try again or email directly.' });
  }
});

app.use((_req, res) => res.status(404).json({ ok: false, error: 'Not found' }));

app.listen(PORT, () => {
  console.log(`Contact API running on port ${PORT}`);
  console.log(`Gmail user: ${process.env.GMAIL_USER || '(not set)'}`);
});
