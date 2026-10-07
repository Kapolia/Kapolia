import 'server-only'

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'

const FROM = {
  name: 'Kapolia',
  email: 'notifications@kapolia.com',
}

export type EmailResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string }

export async function sendEmail(params: {
  to: { email: string; name?: string }
  subject: string
  html: string
  text?: string
}): Promise<EmailResult> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) {
    return { ok: false, error: "BREVO_API_KEY manquante dans les variables d'environnement" }
  }

  const body = {
    sender: FROM,
    to: [params.to],
    subject: params.subject,
    htmlContent: params.html,
    ...(params.text ? { textContent: params.text } : {}),
  }

  let res: Response
  try {
    res = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    return { ok: false, error: `Erreur réseau : ${String(err)}` }
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const json = await res.json()
      detail = json.message ?? JSON.stringify(json)
    } catch {
      // réponse non-JSON, on garde le statut HTTP
    }
    return { ok: false, error: `Brevo : ${detail}` }
  }

  const data = await res.json()
  return { ok: true, messageId: data.messageId ?? '' }
}
