/**
 * Firebase Security Validation
 * Run this script to validate your Firebase security setup
 */

export function validateFirebaseConfig() {
    const config = {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

    const issues = [];

    // Check if all required fields are present
    Object.entries(config).forEach(([key, value]) => {
        if (!value) {
            issues.push(`Missing ${key}`);
        }
    });

    // Check if using development values in production
    if (process.env.NODE_ENV === 'production') {
        if (config.authDomain?.includes('localhost')) {
            issues.push('Using localhost in production authDomain');
        }
        
        if (process.env.NEXT_PUBLIC_API_BASE_URL?.includes('localhost')) {
            issues.push('Using localhost in production API URL');
        }
    }

    // Check if using proper HTTPS in production
    if (process.env.NODE_ENV === 'production') {
        const trackingDomain = process.env.TRACKING_DOMAIN;
        if (trackingDomain && !trackingDomain.startsWith('https://')) {
            issues.push('TRACKING_DOMAIN should use HTTPS in production');
        }
    }

    return {
        isValid: issues.length === 0,
        issues,
        config: Object.keys(config).reduce((acc: Record<string, string>, key) => {
            acc[key] = config[key as keyof typeof config] ? '✓ Set' : '✗ Missing';
            return acc;
        }, {})
    };
}

// Usage in your app
if (process.env.NODE_ENV === 'development') {
    const validation = validateFirebaseConfig();
    if (!validation.isValid) {
        console.warn('Firebase Configuration Issues:', validation.issues);
    }
}