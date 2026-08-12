export interface SokkerCredentials {
  login: string;
  password: string;
}

export interface SokkerAuthResult {
  sessionId: string;
  teamId: string;
}

const sessionCache = new Map<string, { sessionId: string; teamId: string; expiresAt: number }>();

export class SokkerHttpClient {
  /**
   * Autentica al usuario en Sokker y retorna el Team ID y la cookie de sesión.
   */
  async login(credentials: SokkerCredentials): Promise<SokkerAuthResult> {
    const cached = sessionCache.get(credentials.login);
    if (cached && cached.expiresAt > Date.now()) {
      return { sessionId: cached.sessionId, teamId: cached.teamId };
    }

    const params = new URLSearchParams();
    params.append("ilogin", credentials.login);
    params.append("ipassword", credentials.password);

    const response = await fetch("https://sokker.org/start.php?session=xml", {
      method: "POST",
      body: params
    });

    const body = await response.text();

    if (!body.includes("OK")) {
      throw new Error(`Sokker authentication failed: ${body}`);
    }

    const teamIdMatch = body.match(/teamID=(\d+)/);
    if (!teamIdMatch) {
      throw new Error(`Could not parse Team ID from Sokker response: ${body}`);
    }

    const teamId = teamIdMatch[1]!;
    
    // Attempt to read XMLSESSID from Set-Cookie header
    const setCookie = response.headers.get("set-cookie");
    let sessionId = "";
    if (setCookie) {
      const match = setCookie.match(/XMLSESSID=([^;]+)/);
      if (match) {
        sessionId = match[1]!;
      }
    }

    if (!sessionId) {
      throw new Error("No session cookie received from Sokker");
    }

    sessionCache.set(credentials.login, {
      sessionId,
      teamId,
      expiresAt: Date.now() + 1000 * 60 * 30 // 30 minutes
    });

    return { sessionId, teamId };
  }

  /**
   * Descarga un archivo XML de Sokker.
   */
  async fetchXml(filename: string, sessionId: string): Promise<string> {
    const response = await fetch(`https://sokker.org/xml/${filename}`, {
      headers: {
        Cookie: `XMLSESSID=${sessionId}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${filename}: ${response.statusText}`);
    }

    return response.text();
  }
}
