// Email validation utilities
import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);

export interface EmailValidationResult {
    isValid: boolean;
    reason?: string;
}

/**
 * Basic email format validation using regex
 */
export function isValidEmailFormat(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate email domain by checking MX records
 */
export async function validateEmailDomain(email: string): Promise<EmailValidationResult> {
    try {
        if (!isValidEmailFormat(email)) {
            return { isValid: false, reason: 'Invalid email format' };
        }

        const domain = email.split('@')[1];

        // Check for obviously invalid domains
        if (domain === 'example.com' || domain === 'test.com' || domain.includes('example')) {
            return { isValid: false, reason: 'Example/test domain detected' };
        }

        // Check MX records
        try {
            const mxRecords = await resolveMx(domain);
            if (mxRecords && mxRecords.length > 0) {
                return { isValid: true };
            } else {
                return { isValid: false, reason: 'No MX records found for domain' };
            }
        } catch (dnsError) {
            return { isValid: false, reason: 'Domain does not exist or has no MX records' };
        }
    } catch (error) {
        return { isValid: false, reason: 'Error validating email domain' };
    }
}

/**
 * Check for common typos in email domains
 */
export function checkCommonTypos(email: string): EmailValidationResult {
    const domain = email.split('@')[1]?.toLowerCase();

    const commonDomains = [
        'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
        'icloud.com', 'protonmail.com', 'aol.com'
    ];

    const commonTypos: { [key: string]: string } = {
        'gmai.com': 'gmail.com',
        'gmial.com': 'gmail.com',
        'gnail.com': 'gmail.com',
        'yahooo.com': 'yahoo.com',
        'yaho.com': 'yahoo.com',
        'hotmai.com': 'hotmail.com',
        'hotmial.com': 'hotmail.com',
        'outlok.com': 'outlook.com',
        'outloook.com': 'outlook.com'
    };

    if (domain && commonTypos[domain]) {
        return {
            isValid: false,
            reason: `Possible typo: did you mean ${commonTypos[domain]}?`
        };
    }

    return { isValid: true };
}

/**
 * Comprehensive email validation
 */
export async function validateEmail(email: string): Promise<EmailValidationResult> {
    // Basic format check
    if (!isValidEmailFormat(email)) {
        return { isValid: false, reason: 'Invalid email format' };
    }

    // Check for common typos
    const typoCheck = checkCommonTypos(email);
    if (!typoCheck.isValid) {
        return typoCheck;
    }

    // Domain validation (MX record check)
    return await validateEmailDomain(email);
}