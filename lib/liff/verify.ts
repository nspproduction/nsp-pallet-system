// Server-side verification of a LIFF-issued ID token.
// Never trust userId sent from the browser — always call this with the id token.
// Docs: https://developers.line.biz/en/reference/line-login/#verify-id-token

const VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";

export interface LineIdTokenPayload {
  iss: string;
  sub: string;        // LINE userId
  aud: string;        // channel id
  exp: number;
  iat: number;
  name?: string;
  picture?: string;
  email?: string;
}

export async function verifyLineIdToken(idToken: string): Promise<LineIdTokenPayload> {
  const channelId = process.env.LINE_CHANNEL_ID;
  if (!channelId) throw new Error("LINE_CHANNEL_ID is not set");

  const body = new URLSearchParams({ id_token: idToken, client_id: channelId });

  const res = await fetch(VERIFY_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LINE id_token verification failed (${res.status}): ${text}`);
  }

  return (await res.json()) as LineIdTokenPayload;
}
