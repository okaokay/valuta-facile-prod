export function normalizeEmail(email) {
  if (typeof email !== 'string' || !email.trim()) return null
  const lower = email.trim().toLowerCase()
  const atIndex = lower.indexOf('@')
  if (atIndex < 1 || atIndex === lower.length - 1) return null
  let local = lower.slice(0, atIndex)
  const domain = lower.slice(atIndex + 1)
  const plusIndex = local.indexOf('+')
  if (plusIndex !== -1) local = local.slice(0, plusIndex)
  if (domain === 'gmail.com') local = local.replace(/\./g, '')
  if (!local) return null
  return `${local}@${domain}`
}

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'trashmail.com', 'trashmail.net', 'trashmail.me', 'trashmail.org',
  'trashmail.io', 'trashmail.at', 'trashmail.de', 'guerrillamail.com', 'guerrillamail.net',
  'guerrillamail.org', 'guerrillamail.biz', 'guerrillamail.de', 'guerrillamail.info',
  'spam4.me', 'grr.la', '10minutemail.com', '10minutemail.net', '10minutemail.org',
  '10mail.org', 'tempmail.com', 'temp-mail.org', 'temp-mail.ru', 'temp-mail.io',
  'throwam.com', 'throwam.net', 'yopmail.com', 'yopmail.fr', 'yopmail.net',
  'dispostable.com', 'disposableinbox.com', 'sharklasers.com', 'fakeinbox.com',
  'fakemail.net', 'mailnull.com', 'spamgourmet.com', 'spamgourmet.net', 'spamgourmet.org',
  'maildrop.cc', 'spambox.us', 'spambox.me', 'mailexpire.com', 'tempinbox.com',
  'mohmal.com', 'discard.email', 'discardmail.com', 'discardmail.de', 'mailnesia.com',
  'mailzilla.com', 'trbvm.com', 'trashdevil.com', 'trashdevil.de',
])

export function isDisposableEmail(email) {
  if (typeof email !== 'string' || !email.trim()) return false
  const lower = email.trim().toLowerCase()
  const atIndex = lower.indexOf('@')
  if (atIndex === -1) return false
  return DISPOSABLE_DOMAINS.has(lower.slice(atIndex + 1))
}
