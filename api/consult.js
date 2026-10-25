import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const TO = process.env.CONSULT_TO || 'consultations@WhiteOakStewardship.com';
const FROM = process.env.CONSULT_FROM; // "Katie at White Oak <katie@WhiteOakStewardship.com>"
const LEAD_FROM = process.env.CONSULT_LEAD_FROM || "White Oak Consultations <consultations@WhiteOakStewardship.com>"; // internal notice, not from Katie
const MIN_MS = 3000; // faster than this is a bot
const MAX_MS = 1000 * 60 * 60 * 6; // a stale tab is fine; older than this is replay

const clean = (v, max = 500) => String(v ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);
const esc = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const isJson = (req.headers['content-type'] || '').includes('application/json');
  const body = req.body || {}; // Vercel parses JSON and urlencoded bodies
  const reply = (status, payload, redirect) =>
    isJson ? res.status(status).json(payload) : res.redirect(303, redirect);

  // 1. Spam: honeypot filled, or submitted too fast. Report "success" so bots learn nothing.
  const ts = Number(body._ts);
  const elapsed = Date.now() - ts;
  const tooFast = ts && elapsed < MIN_MS;
  const tooOld = ts && elapsed > MAX_MS;
  if (clean(body.company_website) || tooFast || tooOld) {
    return reply(200, { ok: true, name: '' }, '/contact/thank-you.html');
  }

  // 2. Validate
  const lead = {
    name: clean(body.name, 120),
    email: clean(body.email, 200),
    phone: clean(body.phone, 40),
    location: clean(body.location, 160),
    tier: clean(body.tier, 80) || 'Not sure yet',
    source: clean(body.source, 160),
    message: String(body.message ?? '').trim().slice(0, 4000),
    consent: body.consent === 'on' || body.consent === true,
    noJs: !ts,
  };
  const errors = {};
  if (!lead.name) errors.name = 'Please tell us your name.';
  if (!EMAIL.test(lead.email)) errors.email = 'Please check your email address.';
  if (!lead.location) errors.location = 'Where is the property?';
  if (!lead.consent) errors.consent = 'Please confirm we may contact you.';
  if (Object.keys(errors).length) {
    return reply(422, { ok: false, errors }, '/contact.html?error=1#consult');
  }

  // 3. Send: lead first (this is the one that matters), then the auto-reply
  try {
    await resend.emails.send({
      from: LEAD_FROM,
      to: TO,
      replyTo: lead.email,
      subject: `Consultation request: ${lead.name} (${lead.tier})`,
      text: [
        `Name: ${lead.name}`,
        `Email: ${lead.email}`,
        `Phone: ${lead.phone || '-'}`,
        `Property: ${lead.location}`,
        `Interested in: ${lead.tier}`,
        `Found us via: ${lead.source || '-'}`,
        lead.noJs ? 'Note: sent without JavaScript' : '',
        '',
        'Message:',
        lead.message || '-',
      ].join('\n'),
    });

    await resend.emails
      .send({
        from: FROM,
        to: lead.email,
        subject: 'Your White Oak Stewardship consultation request',
        text:
          `Thank you, ${lead.name}. Your steward will call or email within one business day.\n\n` +
          `If anything is urgent, call or text 470-859-3583.\n\nWhite Oak Stewardship\n` +
          `Services provided by Jacks and Ground Innovations LLC\n` +
          `Privacy: https://whiteoakstewardship.com/legal/privacy.html | Terms: https://whiteoakstewardship.com/legal/terms.html`,
        html:
          `<p>Thank you, ${esc(lead.name)}. Your steward will call or email within one business day.</p>` +
          `<p>If anything is urgent, call or text <a href="tel:+14708593583">470-859-3583</a>.</p>` +
          `<p>White Oak Stewardship<br>Services provided by Jacks and Ground Innovations LLC</p>` +
          `<p><a href="https://whiteoakstewardship.com/legal/privacy.html">Privacy</a> · <a href="https://whiteoakstewardship.com/legal/terms.html">Terms</a></p>`,
      })
      .catch(() => {}); // an auto-reply failure must not fail the lead
  } catch (err) {
    console.error('consult send failed', err);
    return reply(502, { ok: false, errors: { form: 'send_failed' } }, '/contact.html?error=send#consult');
  }

  const first = lead.name.split(' ')[0];
  return reply(200, { ok: true, name: lead.name }, `/contact/thank-you.html?name=${encodeURIComponent(first)}`);
}
