export const allowedAdvisory = "https://github.com/advisories/GHSA-fc5q-39xc-vjpf";

export function isAllowedVulnerability(name, vulnerabilities, visited = new Set()) {
  if (visited.has(name)) return false;
  const vulnerability = vulnerabilities[name];
  if (!vulnerability || !Array.isArray(vulnerability.via) || vulnerability.via.length === 0) {
    return false;
  }
  const nextVisited = new Set(visited).add(name);
  return vulnerability.via.every((cause) => {
    if (typeof cause === "string") return isAllowedVulnerability(cause, vulnerabilities, nextVisited);
    return (
      cause &&
      (["info", "low", "moderate"].includes(cause.severity) ||
        (cause.url === allowedAdvisory && cause.name === "picomatch"))
    );
  });
}
