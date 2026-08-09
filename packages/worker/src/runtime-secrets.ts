export function configuredSecret(value: string | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

export async function secretsMatch(
  configured: string | undefined,
  provided: string | undefined,
): Promise<boolean> {
  const expected = configuredSecret(configured);
  const candidate = configuredSecret(provided);
  if (!expected || !candidate) return false;

  const encoder = new TextEncoder();
  const [expectedHash, candidateHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
    crypto.subtle.digest('SHA-256', encoder.encode(candidate)),
  ]);

  if (typeof crypto.subtle.timingSafeEqual === 'function') {
    return crypto.subtle.timingSafeEqual(expectedHash, candidateHash);
  }

  const left = new Uint8Array(expectedHash);
  const right = new Uint8Array(candidateHash);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
}
