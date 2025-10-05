// Firebase App Check setup (for production)
// Add this to your firebase.ts file when deploying to production

import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

// Only initialize App Check in production
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    // Replace 'your-recaptcha-v3-site-key' with your actual reCAPTCHA v3 site key
    const appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider('your-recaptcha-v3-site-key'),
        isTokenAutoRefreshEnabled: true
    });
}

export { app };