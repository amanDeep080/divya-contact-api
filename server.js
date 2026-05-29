const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

/* ─────────────────────────────────────────────
   IMPORTANT FIX (Render / Vercel / proxies)
────────────────────────────────────────────── */
app.set('trust proxy', 1);

// ── Security headers ─────────────────────────
app.use(helmet());

// ── CORS configuration ───────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
].filter(Boolean); // remove undefined/null

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // Postman/curl

    if (allowedOrigins.includes(origin)) {
      return cb(null, true);
    }

    return cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ['POST', 'OPTIONS'],
}));

// ── Body parser ──────────────────────────────
app.use(express.json({ limit: '10kb' }));

// ── Rate limiter (proxy-safe) ────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: 'Too many requests. Please try again later.',
  },
});

// ── Gmail transporter ────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASS,
  },
});

// verify transporter at startup
transporter.verify((err) => {
  if (err) {
    console.error('❌ Email setup error:', err.message);
  } else {
    console.log('✅ Gmail transporter is ready');
  }
});

// ── Validation helper ────────────────────────
function validateContact({ name, email, subject, message }) {
  const errors = [];

  if (!name || name.trim().length < 2)
    errors.push('Name must be at least 2 characters.');

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.push('Valid email is required.');

  if (!message || message.trim().length < 10)
    errors.push('Message must be at least 10 characters.');

  if (name && name.length > 100)
    errors.push('Name too long.');

  if (subject && subject.length > 200)
    errors.push('Subject too long.');

  if (message && message.length > 3000)
    errors.push('Message too long (max 3000 chars).');

  return errors;
}

// ── Health check ─────────────────────────────
app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Portfolio Contact API',
  });
});

// ── CONTACT API ──────────────────────────────
app.post('/contact', limiter, async (req, res) => {
  const { name, email, subject, message } = req.body;

  // validate
  const errors = validateContact({ name, email, subject, message });
  if (errors.length) {
    return res.status(400).json({ ok: false, errors });
  }

  // sanitize
  const safeName = name.trim().replace(/</g, '&lt;');
  const safeSubject = (subject || '(No subject)').trim().replace(/</g, '&lt;');
  const safeMsg = message
    .trim()
    .replace(/</g, '&lt;')
    .replace(/\n/g, '<br>');

  const ownerEmail = {
    from: `"Portfolio Contact" <${process.env.GMAIL_USER}>`,
    to: process.env.RECEIVER_EMAIL || process.env.GMAIL_USER,
    replyTo: email,
    subject: `[Portfolio] ${safeSubject}`,
    html: `
      <div style="font-family:Arial;max-width:560px;margin:auto;background:#0a0a0a;color:#fff;padding:20px">
        <h2 style="color:#ff2d2d">New Portfolio Message</h2>
        <p><b>From:</b> ${safeName}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Message:</b><br>${safeMsg}</p>
      </div>
    `,
  };

  const autoReply = {
    from: `"Divya Singh" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `Thanks for reaching out, ${safeName.split(' ')[0]}!`,
    html: `
      <div style="font-family:Arial;max-width:560px;margin:auto">
        <h2>Hi ${safeName.split(' ')[0]},</h2>
        <p>Thanks for your message. I’ll reply within 24–48 hours.</p>
        <p><i>${safeMsg}</i></p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(ownerEmail);
    await transporter.sendMail(autoReply);

    console.log(`✅ Sent contact email from ${email}`);

    return res.json({
      ok: true,
      message: 'Message sent successfully!',
    });

  } catch (err) {
    console.error('❌ Email error:', err.message);

    return res.status(500).json({
      ok: false,
      error: 'Failed to send email. Try again later.',
    });
  }
});

// ── 404 handler ──────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ ok: false, error: 'Route not found' });
});

// ── start server ─────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📧 Gmail: ${process.env.GMAIL_USER || 'NOT SET'}`);
});