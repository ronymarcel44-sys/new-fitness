// Coach certificates — a coach can hold several, each a { type, number } pair.
// `type` is a known body (ISSA/NASM/ACE/NSCA/ACSM) OR the literal "أخرى", in
// which case `typeOther` carries the free-text name the coach typed.
//
// Stored on Coach.certifications as a JSON array. Numbers are private: user-facing
// endpoints strip them (see stripCertNumbers) so only admins/the coach themselves
// ever see a license number.

export type Certificate = { type: string; number: string; typeOther?: string };
export type PublicCertificate = { type: string; typeOther?: string };

// Validate + normalise a certifications array coming from a request body (or read
// back from the DB's Json column). Keeps only rows that have both a non-empty type
// and number; coerces every value to a trimmed string.
export function normalizeCertifications(input: unknown): Certificate[] {
  if (!Array.isArray(input)) return [];
  const out: Certificate[] = [];
  for (const row of input) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const type   = String(r.type   ?? "").trim();
    const number = String(r.number ?? "").trim();
    if (!type || !number) continue;
    const typeOther = String(r.typeOther ?? "").trim();
    out.push(typeOther ? { type, number, typeOther } : { type, number });
  }
  return out;
}

// Drop the private license number for user-facing responses.
export function stripCertNumbers(certs: Certificate[]): PublicCertificate[] {
  return certs.map((c) => (c.typeOther ? { type: c.type, typeOther: c.typeOther } : { type: c.type }));
}
