// Twilio webhook self-test. Reads creds from env vars, never logs them.
// Usage:
//   Decrypt vault: bash ~/OneDrive/claude-sync/env-vault/decrypt.sh twilio-rocket.md.enc
//   Then: TWILIO_AUTH_TOKEN=... TWILIO_ACCOUNT_SID=... TWILIO_FROM_NUMBER=... \
//         TWILIO_WEBHOOK_URL=... node scripts/twilio-selftest.cjs
// Sends a fake-customer payload (From=test E.164 range), expects HTTP 200 + TwiML
// "No recent appointments found" — proves HMAC + function execute without DB writes.
const crypto = require('crypto')
const https = require('https')
const querystring = require('querystring')

const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN
const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID
const TO_NUMBER = process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_TO_NUMBER
const WEBHOOK_URL = process.env.TWILIO_WEBHOOK_URL

if (!AUTH_TOKEN || !ACCOUNT_SID || !TO_NUMBER || !WEBHOOK_URL) {
  console.error(
    'Missing required env vars. Need: TWILIO_AUTH_TOKEN, TWILIO_ACCOUNT_SID, ' +
      'TWILIO_FROM_NUMBER (the Twilio-owned number), TWILIO_WEBHOOK_URL'
  )
  process.exit(1)
}

const url = WEBHOOK_URL
const params = {
  AccountSid: ACCOUNT_SID,
  From: '+15555550100',
  To: TO_NUMBER,
  Body: 'STATUS',
  MessageSid: 'SM' + crypto.randomBytes(16).toString('hex'),
}

const sortedKeys = Object.keys(params).sort()
let signedString = url
for (const k of sortedKeys) signedString += k + params[k]

const signature = crypto.createHmac('sha1', AUTH_TOKEN).update(signedString).digest('base64')
const body = querystring.stringify(params)

const u = new URL(url)
const req = https.request(
  {
    hostname: u.hostname,
    path: u.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Twilio-Signature': signature,
      'Content-Length': Buffer.byteLength(body),
      'User-Agent': 'TwilioProxy/1.1',
    },
  },
  (res) => {
    let data = ''
    res.on('data', (c) => (data += c))
    res.on('end', () => {
      console.log('HTTP', res.statusCode)
      console.log('--- response body ---')
      console.log(data)
    })
  }
)
req.on('error', (e) => console.error('REQ ERR:', e.message))
req.write(body)
req.end()
