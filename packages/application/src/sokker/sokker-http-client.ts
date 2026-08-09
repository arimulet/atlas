export interface SokkerCredentials {
  login: string;
  password: string;
}

export interface SokkerAuthResult {
  teamId: number;
  sessionId: string;
}

export class SokkerHttpClient {
  /**
   * Autentica al usuario en Sokker y retorna el Team ID y la cookie de sesión.
   */
  async login(credentials: SokkerCredentials): Promise<SokkerAuthResult> {
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

    const teamId = parseInt(teamIdMatch[1]!, 10);

    const setCookieHeader = response.headers.get("set-cookie");
    if (!setCookieHeader) {
      throw new Error("No session cookie received from Sokker");
    }

    const match = setCookieHeader.match(/XMLSESSID=([^;]+)/);
    if (!match) {
      throw new Error("Could not parse XMLSESSID from response");
    }

    return {
      teamId,
      sessionId: match[1]!
    };
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
