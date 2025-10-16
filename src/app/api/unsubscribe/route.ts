import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Db } from 'mongodb'; // Import Db type for type safety

/**
 * Adds or updates an email in the UnsubscribeList collection.
 */
async function upsertUnsubscribe(db: Db, email: string, campaignId: string) {
    const emailToUnsubscribe = email.toLowerCase();

    await db.collection('UnsubscribeList').updateOne(
        { email: emailToUnsubscribe },
        {
            $set: {
                email: emailToUnsubscribe,
                unsubscribedAt: new Date(),
                lastUnsubscribedFromCampaignId: campaignId,
            },
            $addToSet: {
                campaignIds: campaignId,
            },
        },
        { upsert: true }
    );
}

/**
 * Handles unsubscribe requests from a direct link click (e.g., in an email body).
 * This method does not require reCAPTCHA verification.
 */
export async function GET(request: Request) {
    try {
        const { db } = await connectToDatabase();
        const url = new URL(request.url);
        const email = url.searchParams.get('email');
        const campaignId = url.searchParams.get('campaignId') || 'unknown';

        if (!email) {
            return new Response('Invalid unsubscribe link: Email parameter is missing.', { status: 400 });
        }

        await upsertUnsubscribe(db, email, campaignId);

        const html = `<!DOCTYPE html>
            <html lang="en">
            <head><title>Unsubscribed</title></head>
            <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1>Success!</h1>
                <p>You have been successfully unsubscribed.</p>
                <p>Email: <strong>${email.toLowerCase()}</strong></p>
            </body>
            </html>`;

        console.log(`[Unsubscribe] GET (Link Click) success for ${email.toLowerCase()} from campaign ${campaignId}`);
        return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
    } catch (error) {
        console.error('Unsubscribe GET error:', error);
        return new Response('An error occurred during the unsubscribe process.', { status: 500 });
    }
}

/**
 * Handles POST requests from the unsubscribe page (with reCAPTCHA) and
 * one-click 'List-Unsubscribe-Post' headers from email clients.
 */
export async function POST(request: Request) {
    try {
        const { db } = await connectToDatabase();
        const url = new URL(request.url);
        const campaignId = url.searchParams.get('campaignId') || 'unknown';
        
        let email: string | null = url.searchParams.get('email');
        let token: string | null = null;
        let isFromWebForm = false;

        const contentType = request.headers.get('content-type') || '';

        // --- Handle different content types ---
        if (contentType.includes('application/json')) {
            // This is the request from your frontend form
            const body = await request.json();
            email = body.email || null;
            token = body.token || null;
            isFromWebForm = true;
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
            // This could be from a 'List-Unsubscribe-Post' header
            const form = await request.formData();
            email = (form.get('email') || form.get('Email'))?.toString() || null;
        }
        
        // --- reCAPTCHA v3 Verification (only for web form submissions) ---
        if (isFromWebForm) {
            if (!token) {
                return NextResponse.json({ error: 'reCAPTCHA token is missing.' }, { status: 400 });
            }

            const secretKey = process.env.RECAPTCHA_V3_SECRET_KEY;
            const verificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`;
            
            const recaptchaResponse = await fetch(verificationUrl, { method: 'POST' });
            const verificationData = await recaptchaResponse.json();
            
            const scoreThreshold = 0.5; // Google's recommended default
            if (!verificationData.success || verificationData.score < scoreThreshold) {
                console.warn('reCAPTCHA verification failed or low score:', verificationData);
                return NextResponse.json({ error: 'Bot behavior detected. Please try again.' }, { status: 400 });
            }
        }

        // --- Process the unsubscribe if email is found ---
        if (!email) {
            console.log(`[Unsubscribe] POST - WARN: Email missing from request. campaignId=${campaignId}.`);
            // For header-based unsubscribes, it's best to return 204 even if email is missing.
            // For a form submission, the reCAPTCHA token check would have already failed.
            return new Response(null, { status: 204 });
        }
        
        await upsertUnsubscribe(db, email, campaignId);
        console.log(`[Unsubscribe] POST success for ${email.toLowerCase()} from campaign ${campaignId}`);

        // --- Return the correct response type ---
        if (isFromWebForm) {
            // The frontend expects a JSON response
            return NextResponse.json({ message: `The email ${email} has been successfully unsubscribed.` }, { status: 200 });
        } else {
            // Email clients expect a 204 No Content for 'List-Unsubscribe-Post'
            return new Response(null, { status: 204 });
        }

    } catch (error) {
        console.error('Unsubscribe POST error:', error);
        // Return a JSON error for web forms, and a generic error for others
        const contentType = request.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
        }
        return new Response('An error occurred during the unsubscribe process.', { status: 500 });
    }
}