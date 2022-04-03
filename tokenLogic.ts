import fetch from "node-fetch";

type SecretData = { username: string, password: string, client_id: string, client_secret: string };
export type TokenData = { access_token: string, expires_at: number } | null;

export async function requestAccessToken(secret: SecretData): Promise<TokenData> {
  const formData = new URLSearchParams();
  formData.set("username", secret.username);
  formData.set("password", secret.password);
  formData.set("grant_type", "password");
  
  const resp = await fetch("https://ssl.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": "Basic " + Buffer.from(secret.client_id + ":" + secret.client_secret).toString("base64"),
      "User-Agent": "obamaplacebot"
    },

    body: formData
  });

  const jsonData = await resp.json();

  return {
    access_token: jsonData.access_token,
    expires_at: Math.floor(new Date().getTime()/1000) + jsonData.expires_in,
  }
}
