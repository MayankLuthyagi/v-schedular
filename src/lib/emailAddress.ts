export function normalizeEmailAddress(email: string | null | undefined): string {
    return (email || '').trim().toLowerCase();
}

export function isValidEmailAddress(email: string | null | undefined): boolean {
    const normalized = normalizeEmailAddress(email);
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

export function getEmailDomain(email: string | null | undefined): string | null {
    const normalized = normalizeEmailAddress(email);
    if (!normalized.includes('@')) return null;
    return normalized.split('@')[1] || null;
}
