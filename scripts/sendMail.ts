// scripts/sendMail.ts
import { connectToDatabase } from "@/lib/db";
import nodemailer from "nodemailer";
import { ObjectId, Db } from "mongodb";
import { validateEmail } from "@/lib/emailValidation";
import { decrypt, isEncrypted } from "@/lib/crypto";

/** Safely decrypt an app password — falls back to plain text if not encrypted yet */
function safeDecrypt(value: string): string {
    if (!value) return value;
    return isEncrypted(value) ? decrypt(value) : value;
}
import type { SiteSettings } from "@/types/settings";
import type { Campaign, Attachment } from "@/types/campaign";
import type { AuthEmail } from "@/types/auth";
import type { Broadcast } from "@/types/broadcast";
import type { DateAutomation } from "@/types/dateAutomation";
import type { AudienceContact } from "@/types/audience";
import "dotenv/config";

// --- Template helpers --------------------------------------------------------

interface ResolvedTemplate { subject: string; body: string; }

/** Look up an email template by templateId and return its subject + body */
async function resolveTemplate(db: Db, templateId: string): Promise<ResolvedTemplate | null> {
    if (!templateId) return null;
    const tpl = await db.collection("EmailTemplates").findOne({ templateId });
    if (!tpl) return null;
    return { subject: tpl.subject as string, body: tpl.body as string };
}

// --- Audience helpers --------------------------------------------------------

/** Load all contacts for a given audienceId */
async function loadAudienceContacts(db: Db, audienceId: string): Promise<AudienceContact[]> {
    const audience = await db.collection("Audiences").findOne({ audienceId });
    return (audience?.contacts as AudienceContact[]) || [];
}

/**
 * Replace {{field_name}} placeholders in text with values from a contact object.
 * Falls back to empty string for missing fields.
 */
function applyVariables(text: string, contact: AudienceContact): string {
    return text.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
        const trimmed = key.trim().toLowerCase().replace(/\s+/g, '_');
        return contact[trimmed] ?? contact[key.trim()] ?? '';
    });
}

/** Get today's date string in IST (YYYY-MM-DD) */
function getTodayIST(): string {
    const now = new Date();
    const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    return ist.toISOString().split('T')[0];
}

/** Get current IST hours + minutes */
function getCurrentISTTime(): { hours: number; minutes: number } {
    const now = new Date();
    const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    return { hours: ist.getUTCHours(), minutes: ist.getUTCMinutes() };
}

/** Return true if current IST time >= HH:mm */
function timeHasPassed(sendTime: string): boolean {
    const [h, m] = sendTime.split(':').map(Number);
    const { hours, minutes } = getCurrentISTTime();
    return hours > h || (hours === h && minutes >= m);
}

// Enhanced error categorization
interface EmailError {
    category: 'validation' | 'authentication' | 'rate_limit' | 'network' | 'recipient' | 'attachment' | 'configuration' | 'unknown';
    reason: string;
    originalError?: string;
}

// Function to categorize email sending errors
function categorizeEmailError(error: Error & { code?: string; responseCode?: number }): EmailError {
    const errorMessage = error.message || error.toString();
    const errorCode = error.code;
    const responseCode = error.responseCode;

    // Authentication errors
    if (errorMessage.includes('Invalid login') ||
        errorMessage.includes('authentication failed') ||
        errorMessage.includes('Username and Password not accepted') ||
        errorCode === 'EAUTH' ||
        responseCode === 535) {
        return {
            category: 'authentication',
            reason: 'SMTP authentication failed - invalid credentials',
            originalError: errorMessage
        };
    }

    // Rate limiting errors
    if (errorMessage.includes('rate limit') ||
        errorMessage.includes('too many emails') ||
        errorMessage.includes('quota exceeded') ||
        responseCode === 421 ||
        responseCode === 450) {
        return {
            category: 'rate_limit',
            reason: 'Rate limit exceeded - too many emails sent',
            originalError: errorMessage
        };
    }

    // Network/connection errors
    if (errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('ENOTFOUND') ||
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('ECONNRESET') ||
        errorCode === 'ECONNECTION') {
        return {
            category: 'network',
            reason: 'Network connection failed - unable to reach SMTP server',
            originalError: errorMessage
        };
    }

    // Recipient-related errors
    if (errorMessage.includes('Mailbox unavailable') ||
        errorMessage.includes('User unknown') ||
        errorMessage.includes('No such user') ||
        errorMessage.includes('Invalid recipient') ||
        responseCode === 550 ||
        responseCode === 551) {
        return {
            category: 'recipient',
            reason: 'Recipient mailbox unavailable or invalid',
            originalError: errorMessage
        };
    }

    // Attachment errors
    if (errorMessage.includes('attachment') ||
        errorMessage.includes('file size') ||
        errorMessage.includes('MIME')) {
        return {
            category: 'attachment',
            reason: 'Attachment processing failed',
            originalError: errorMessage
        };
    }

    // Configuration errors
    if (errorMessage.includes('SMTP') ||
        errorMessage.includes('configuration') ||
        errorMessage.includes('settings')) {
        return {
            category: 'configuration',
            reason: 'SMTP configuration error',
            originalError: errorMessage
        };
    }

    // Default to unknown
    return {
        category: 'unknown',
        reason: 'Unknown email sending error',
        originalError: errorMessage
    };
}

// Helper function to check if a feature is allowed from database settings
async function isFeatureAllowed(db: Db, feature: keyof SiteSettings['featureAllowed']): Promise<boolean> {
    try {
        const settings = await db.collection("Settings").findOne({});
        if (!settings || !settings.featureAllowed) {
            return false;
        }
        return settings.featureAllowed[feature] || false;
    } catch (error) {
        console.log(`Warning: Could not check feature '${feature}' settings:`, error);
        return false; // Default to false if settings can't be retrieved
    }
}

// Helper function to check if an email is on the unsubscribe list
async function isUnsubscribed(db: Db, email: string): Promise<boolean> {
    try {
        const result = await db.collection("UnsubscribeList").findOne({ email: email.toLowerCase() });
        return !!result;
    } catch (error) {
        console.log(`Warning: Could not check unsubscribe status for ${email}:`, error);
        return false;
    }
}

// small sleep helper
function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// send with retries and exponential backoff for transient errors
async function sendWithRetries(transporter: any, mailOptions: any, maxRetries = 3) {
    let attempt = 0;
    const baseDelay = 5000; // 5s base
    while (true) {
        try {
            const info = await transporter.sendMail(mailOptions);
            return { success: true, info };
        } catch (err: unknown) {
            attempt++;
            const error = err as Error & { code?: string; responseCode?: number };
            const categorized = categorizeEmailError(error);

            // don't retry on fatal errors
            if (attempt > maxRetries || ['authentication', 'recipient', 'attachment', 'configuration'].includes(categorized.category)) {
                return { success: false, error: categorized };
            }

            // exponential backoff with jitter
            const backoff = baseDelay * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 500);
            console.log(`Send attempt ${attempt} failed: [${categorized.category}] ${categorized.reason}. Backing off ${backoff}ms before retrying.`);
            await sleep(backoff);
            // continue to next attempt
        }
    }
}

(async () => {
    console.log("Starting scheduled email job...");

    try {
        const { db } = await connectToDatabase();
        console.log("Database connected.");

        const campaigns = await db
            .collection<Campaign>("Campaigns")
            .find({ isActive: true })
            .toArray();
        console.log(`🔎 Found ${campaigns.length} active campaigns.`);

        if (campaigns.length === 0) {
            console.log("No active campaigns to process. Exiting.");
            process.exit(0);
        }

        const allSenderEmails = await db.collection<AuthEmail>("AuthEmails").find({}).toArray();


        for (const campaign of campaigns) {
            console.log(`\nProcessing campaign: "${campaign.campaignName}" (ID: ${campaign.campaignId})`);

            // Derive IST "today" using UTC methods on the shifted timestamp.
            // IMPORTANT: we must use getUTC* methods on nowIST because getDate()/getMonth()
            // etc. use the machine's local timezone, which would double-count the IST offset
            // and push the date one day forward on IST machines.
            const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
            const todayISTStr = nowIST.toISOString().split('T')[0]; // "YYYY-MM-DD"
            const dayOfWeek = nowIST.toLocaleString("en-US", { weekday: "long", timeZone: "UTC" });

            console.log(`Current IST day: ${dayOfWeek}, Date: ${todayISTStr}`);

            // --- Campaign schedule validation ---
            // Compare date-only strings (YYYY-MM-DD) to avoid any timezone confusion.
            const startDateStr = campaign.startDate.slice(0, 10);
            const endDateStr = campaign.endDate.slice(0, 10);

            const isCorrectDay = campaign.sendDays.includes(dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1));
            const isWithinDateRange = startDateStr <= todayISTStr && endDateStr >= todayISTStr;

            // Normalise stored todaySent to a YYYY-MM-DD string for comparison.
            function toISTDateStr(val: Date | string | null | undefined): string | null {
                if (!val) return null;
                const d = val instanceof Date ? val : new Date(String(val));
                if (isNaN(d.getTime())) return null;
                return new Date(d.getTime() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];
            }
            const isAlreadySentToday = toISTDateStr(campaign.todaySent as Date | string | null) === todayISTStr;

            if (!isCorrectDay || !isWithinDateRange || isAlreadySentToday) {
                console.log("Skipping: Campaign schedule does not match.");
                if (!isCorrectDay) console.log(` - Reason: Today is ${dayOfWeek}, not in send days [${campaign.sendDays.join(', ')}].`);
                if (!isWithinDateRange) console.log(` - Reason: Today is outside the start/end date range.`);
                if (isAlreadySentToday) console.log(` - Reason: Campaign has already been marked as sent today.`);
                continue;
            }

            if (campaign.sendTime) {
                const [hours, minutes] = campaign.sendTime.split(":").map(Number);
                // Get current IST hours and minutes
                const currentISTHours = nowIST.getUTCHours();
                const currentISTMinutes = nowIST.getUTCMinutes();

                console.log(`Current IST time: ${currentISTHours}:${currentISTMinutes.toString().padStart(2, '0')}, Scheduled time: ${campaign.sendTime}`);

                if (currentISTHours < hours || (currentISTHours === hours && currentISTMinutes < minutes)) {
                    console.log(`Skipping: Current IST time is before the scheduled send time of ${campaign.sendTime}.`);
                    continue;
                }
            }
            console.log("Schedule and time validation passed.");

            // ---------------------------------------------------------------
            // RECIPIENT SOURCE: MongoDB Audience (preferred) OR Google Sheet (legacy)
            // ---------------------------------------------------------------

            const baseUrl = (process.env.TRACKING_PIXEL_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://schedular-plum.vercel.app').replace(/\/$/, '');

            if ((campaign as any).audienceId) {
                // ── NEW PATH: MongoDB Audience ────────────────────────────────
                const templateId = (campaign as any).templateId as string;
                const tpl = await resolveTemplate(db, templateId);
                if (!tpl) {
                    console.log(`Campaign "${campaign.campaignName}" has no valid templateId "${templateId}". Skipping.`);
                    continue;
                }
                console.log(`Using MongoDB audience "${(campaign as any).audienceId}" for campaign.`);
                const contacts = await loadAudienceContacts(db, (campaign as any).audienceId);
                if (contacts.length === 0) {
                    console.log(`Audience empty or not found. Skipping campaign.`);
                    continue;
                }
                console.log(`Audience loaded: ${contacts.length} contacts.`);

                const orderedContacts = campaign.randomSend
                    ? [...contacts].sort(() => Math.random() - 0.5)
                    : contacts;

                for (const senderEmailAddress of (campaign.senderEmails || (campaign as any).commaId || [])) {
                    const authEmail = allSenderEmails.find((e) => e.email === senderEmailAddress.trim());
                    if (!authEmail) {
                        console.log(`Skipping sender ${senderEmailAddress}: Not found in AuthEmails.`);
                        continue;
                    }
                    console.log(`Preparing to send from: ${authEmail.email}`);

                    const transporter = nodemailer.createTransport({
                        host: "smtp.gmail.com", port: 587, secure: false,
                        auth: { user: authEmail.email ?? authEmail.main, pass: safeDecrypt(authEmail.app_password) },
                    });

                    const startOfDay = new Date();
                    startOfDay.setHours(0, 0, 0, 0);
                    const sentTodayForThisCampaign = await db.collection("EmailLog").countDocuments({
                        senderEmail: authEmail.email,
                        campaignId: campaign.campaignId,
                        sentAt: { $gte: startOfDay },
                        status: 'sent',
                    });
                    let remaining = Math.max(0, campaign.dailySendLimitPerSender - sentTodayForThisCampaign);
                    if (remaining === 0) {
                        console.log(`Sender ${authEmail.email} already hit daily limit for this campaign.`);
                        continue;
                    }

                    if (campaign.sendMethod === 'one-on-one') {
                        let idx = 0;
                        while (idx < orderedContacts.length && remaining > 0) {
                            const contact = orderedContacts[idx++];
                            if (!contact.email?.trim()) continue;
                            if (await isUnsubscribed(db, contact.email.trim())) { console.log(`Skipping unsubscribed ${contact.email}`); continue; }
                            const validation = await validateEmail(contact.email.trim());
                            if (!validation.isValid) {
                                console.log(`Skipping invalid ${contact.email}: ${validation.reason}`);
                                if (await isFeatureAllowed(db, 'emailLogs')) {
                                    await db.collection("EmailLog").insertOne({ status: 'failed', failureReason: `Validation: ${validation.reason}`, failureCategory: 'validation', originalError: validation.reason, campaignId: campaign.campaignId, recipientEmail: contact.email.trim(), senderEmail: authEmail.email, sendMethod: campaign.sendMethod, sentAt: new Date() });
                                }
                                continue;
                            }
                            remaining--;
                            const personalBody = applyVariables(tpl.body, contact);
                            const personalSubject = applyVariables(tpl.subject, contact);
                            const logId = new ObjectId();
                            const trackingPixelUrl = `${baseUrl}/api/track?logId=${logId.toHexString()}`;
                            const encodedEmail = encodeURIComponent(contact.email.trim());
                            const unsubUrl = `${baseUrl}/api/unsubscribe?campaignId=${campaign.campaignId}&email=${encodedEmail}&logId=${logId.toHexString()}`;
                            const bodyWithTracking = `${personalBody}<img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:none;"/><div style="text-align:center;margin-top:30px;font-size:12px;color:#6c757d;">If you no longer wish to receive these emails, <a href="${unsubUrl}" style="color:#6c757d;text-decoration:underline;">click here to unsubscribe</a>.</div>`;
                            const mailOptions: nodemailer.SendMailOptions = {
                                from: authEmail.name ? `${authEmail.name} <${authEmail.email}>` : authEmail.email,
                                to: contact.email.trim(), subject: personalSubject,
                                replyTo: campaign.replyToEmail || authEmail.email,
                                html: bodyWithTracking,
                                headers: { 'List-Unsubscribe': `<${unsubUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
                            };
                            if (campaign.attachments?.length > 0) {
                                mailOptions.attachments = campaign.attachments.map((a: Attachment) => ({ filename: a.filename, content: Buffer.from(a.content, 'base64'), contentType: a.contentType }));
                            }
                            const result = await sendWithRetries(transporter, mailOptions, 3);
                            if (result.success) {
                                console.log(`Sent to ${contact.email}`);
                                if (await isFeatureAllowed(db, 'emailLogs')) {
                                    await db.collection("EmailLog").insertOne({ _id: logId, status: 'sent', campaignId: campaign.campaignId, recipientEmail: contact.email.trim(), senderEmail: authEmail.email, sendMethod: campaign.sendMethod, sentAt: new Date() });
                                }
                            } else {
                                console.log(`Failed to send to ${contact.email}: ${result.error?.reason}`);
                                if (await isFeatureAllowed(db, 'emailLogs')) {
                                    await db.collection("EmailLog").insertOne({ _id: logId, status: 'failed', failureReason: result.error?.reason, failureCategory: result.error?.category, originalError: result.error?.originalError, campaignId: campaign.campaignId, recipientEmail: contact.email.trim(), senderEmail: authEmail.email, sendMethod: campaign.sendMethod, sentAt: new Date() });
                                }
                            }
                            if (remaining > 0) await sleep(1000 + Math.floor(Math.random() * 2000));
                        }
                    } else {
                        // BCC / CC batch mode
                        const ENV_MAX = Number(process.env.MAX_BCC_BATCH) || 100;
                        const BATCH_DELAY_MS = Number(process.env.BCC_BATCH_DELAY_MS) || 60000;
                        let batchIdx = 0;
                        while (remaining > 0 && batchIdx < orderedContacts.length) {
                            const batchEmails: string[] = [];
                            while (batchIdx < orderedContacts.length && batchEmails.length < Math.min(remaining, ENV_MAX)) {
                                const contact = orderedContacts[batchIdx++];
                                if (!contact.email?.trim()) continue;
                                if (await isUnsubscribed(db, contact.email.trim())) continue;
                                const v = await validateEmail(contact.email.trim());
                                if (v.isValid) batchEmails.push(contact.email.trim());
                            }
                            if (batchEmails.length === 0) break;
                            const unsubUrl = `${baseUrl}/unsubscribe`;
                            const bodyWithUnsub = `${tpl.body}<div style="text-align:center;margin-top:30px;font-size:12px;color:#6c757d;">If you no longer wish to receive these emails, <a href="${unsubUrl}" style="color:#6c757d;text-decoration:underline;">click here to unsubscribe</a>.</div>`;
                            const mailOptions: nodemailer.SendMailOptions = {
                                from: authEmail.name ? `${authEmail.name} <${authEmail.email}>` : authEmail.email,
                                to: campaign.toEmail || batchEmails[0],
                                cc: campaign.sendMethod === 'cc' ? batchEmails : undefined,
                                bcc: campaign.sendMethod === 'bcc' ? batchEmails : undefined,
                                subject: tpl.subject,
                                replyTo: campaign.replyToEmail || authEmail.email,
                                html: bodyWithUnsub,
                                headers: { 'List-Unsubscribe': `<${unsubUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
                            };
                            if (campaign.attachments?.length > 0) {
                                mailOptions.attachments = campaign.attachments.map((a: Attachment) => ({ filename: a.filename, content: Buffer.from(a.content, 'base64'), contentType: a.contentType }));
                            }
                            const result = await sendWithRetries(transporter, mailOptions, 3);
                            if (result.success) {
                                console.log(`Sent batch of ${batchEmails.length} from ${authEmail.email}.`);
                                if (await isFeatureAllowed(db, 'emailLogs')) {
                                    await db.collection("EmailLog").insertMany(batchEmails.map(email => ({ campaignId: campaign.campaignId, recipientEmail: email, senderEmail: authEmail.email, sendMethod: campaign.sendMethod, status: 'sent', sentAt: new Date() })));
                                }
                                remaining = Math.max(0, remaining - batchEmails.length);
                            } else {
                                console.error(`Batch failed: ${result.error?.reason}`);
                                break;
                            }
                            if (remaining > 0 && batchIdx < orderedContacts.length) {
                                await sleep(BATCH_DELAY_MS + Math.floor(Math.random() * 2000));
                            }
                        }
                    }
                    transporter.close();
                }

            } else {
                console.log(`Campaign "${campaign.campaignName}" has no audienceId set. Skipping.`);
            }

            await db.collection("Campaigns").updateOne(
                { _id: campaign._id },
                { $set: { todaySent: todayISTStr } } // YYYY-MM-DD in IST — no timezone ambiguity
            );
            console.log(`Marked campaign as sent for today.`);

            // Run cleanup for false opens if emailLogs is enabled and campaign is one-on-one
            if (await isFeatureAllowed(db, 'emailLogs') && campaign.sendMethod === 'one-on-one') {
                console.log("Waiting 10 seconds for bot scans to complete...");
                await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds

                console.log("Cleaning up false opens from this campaign...");
                try {
                    const baseUrl = (process.env.TRACKING_PIXEL_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://schedular-plum.vercel.app').replace(/\/$/, '');
                    const response = await fetch(`${baseUrl}/api/analyze-opens?action=cleanup&threshold=10`);

                    if (response.ok) {
                        const data = await response.json();
                        console.log(`Cleaned up ${data.cleanedCount} false opens from campaign "${campaign.campaignName}"`);
                    } else {
                        console.log("Cleanup API responded with error:", response.status);
                    }
                } catch (error) {
                    console.log("Could not run cleanup:", error instanceof Error ? error.message : 'Unknown error');
                }
            } else {
                if (!await isFeatureAllowed(db, 'emailLogs')) {
                    console.log("Email logs disabled, skipping cleanup");
                }
                if (campaign.sendMethod !== 'one-on-one') {
                    console.log("Campaign uses bulk method, no tracking pixels to clean up");
                }
            }
        }

        // =====================================================================
        // PROCESS ONE-TIME BROADCASTS
        // =====================================================================
        console.log("\n--- Processing One-Time Broadcasts ---");
        const todayIST = getTodayIST();
        const pendingBroadcasts = await db
            .collection<Broadcast>("Broadcasts")
            .find({ status: "pending", sendDate: todayIST })
            .toArray();
        console.log(`Found ${pendingBroadcasts.length} broadcast(s) scheduled for today.`);

        for (const broadcast of pendingBroadcasts) {
            if (!timeHasPassed(broadcast.sendTime)) {
                console.log(`Broadcast "${broadcast.name}" send time ${broadcast.sendTime} not reached yet. Skipping.`);
                continue;
            }
            console.log(`\nProcessing broadcast: "${broadcast.name}"`);

            // Resolve template
            const broadcastTpl = await resolveTemplate(db, broadcast.templateId);
            if (!broadcastTpl) {
                console.log(`Broadcast "${broadcast.name}" has no valid template "${broadcast.templateId}". Skipping.`);
                continue;
            }

            // Load audience contacts
            if (!broadcast.audienceId) {
                console.log(`Broadcast "${broadcast.name}" has no audienceId. Skipping.`);
                continue;
            }
            const contacts = await loadAudienceContacts(db, broadcast.audienceId);
            if (contacts.length === 0) {
                console.log(`Audience for broadcast "${broadcast.name}" is empty or not found. Skipping.`);
                continue;
            }
            console.log(`Audience loaded: ${contacts.length} contacts.`);

            // Send via each sender
            for (const senderAddress of broadcast.senderEmails) {
                const authEmail = allSenderEmails.find(e => e.email === senderAddress.trim());
                if (!authEmail) {
                    console.log(`Sender ${senderAddress} not found in AuthEmails. Skipping.`);
                    continue;
                }

                const transporter = nodemailer.createTransport({
                    host: "smtp.gmail.com",
                    port: 587,
                    secure: false,
                    auth: {
                        user: authEmail.email ?? authEmail.main,
                        pass: safeDecrypt(authEmail.app_password),
                    },
                });

                const baseUrl = (process.env.TRACKING_PIXEL_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://schedular-plum.vercel.app').replace(/\/$/, '');
                let globalIdx = 0;
                let remaining = broadcast.dailySendLimitPerSender;
                const orderedContacts = broadcast.randomSend ? [...contacts].sort(() => Math.random() - 0.5) : contacts;

                if (broadcast.sendMethod === 'one-on-one') {
                    while (globalIdx < orderedContacts.length && remaining > 0) {
                        const contact = orderedContacts[globalIdx++];
                        if (!contact.email?.trim()) continue;
                        if (await isUnsubscribed(db, contact.email.trim())) { console.log(`Skipping unsubscribed ${contact.email}`); continue; }
                        const validation = await validateEmail(contact.email.trim());
                        if (!validation.isValid) { console.log(`Skipping invalid ${contact.email}: ${validation.reason}`); continue; }

                        const personalBody = applyVariables(broadcastTpl.body, contact);
                        const personalSubject = applyVariables(broadcastTpl.subject, contact);
                        const logId = new ObjectId();
                        const trackingPixelUrl = `${baseUrl}/api/track?logId=${logId.toHexString()}`;
                        const encodedEmail = encodeURIComponent(contact.email.trim());
                        const unsubUrl = `${baseUrl}/api/unsubscribe?campaignId=${broadcast.broadcastId}&email=${encodedEmail}&logId=${logId.toHexString()}`;
                        const bodyWithTracking = `${personalBody}<img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:none;"/><div style="text-align:center;margin-top:30px;font-size:12px;color:#6c757d;">If you no longer wish to receive these emails, <a href="${unsubUrl}" style="color:#6c757d;text-decoration:underline;">click here to unsubscribe</a>.</div>`;

                        const mailOptions: nodemailer.SendMailOptions = {
                            from: authEmail.name ? `${authEmail.name} <${authEmail.email}>` : authEmail.email,
                            to: contact.email.trim(),
                            subject: personalSubject,
                            replyTo: broadcast.replyToEmail || authEmail.email,
                            html: bodyWithTracking,
                            headers: { 'List-Unsubscribe': `<${unsubUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
                        };
                        if (broadcast.attachments?.length > 0) {
                            mailOptions.attachments = broadcast.attachments.map((a: Attachment) => ({ filename: a.filename, content: Buffer.from(a.content, 'base64'), contentType: a.contentType }));
                        }
                        const result = await sendWithRetries(transporter, mailOptions, 3);
                        if (result.success) {
                            console.log(`Sent broadcast to ${contact.email}`);
                            if (await isFeatureAllowed(db, 'emailLogs')) {
                                await db.collection("EmailLog").insertOne({ _id: logId, status: 'sent', campaignId: broadcast.broadcastId, recipientEmail: contact.email.trim(), senderEmail: authEmail.email, sendMethod: broadcast.sendMethod, sentAt: new Date() });
                            }
                        } else {
                            console.log(`Failed broadcast to ${contact.email}: ${result.error?.reason}`);
                        }
                        remaining--;
                        if (remaining > 0 && globalIdx < orderedContacts.length) await sleep(1000 + Math.floor(Math.random() * 2000));
                    }
                } else {
                    // BCC/CC batch
                    const ENV_MAX = Number(process.env.MAX_BCC_BATCH) || 100;
                    const batchEmails = orderedContacts.slice(0, Math.min(remaining, ENV_MAX)).map(c => c.email).filter(Boolean) as string[];
                    if (batchEmails.length > 0) {
                        const unsubUrl = `${baseUrl}/unsubscribe`;
                        const bodyWithUnsub = `${broadcastTpl.body}<div style="text-align:center;margin-top:30px;font-size:12px;color:#6c757d;">If you no longer wish to receive these emails, <a href="${unsubUrl}" style="color:#6c757d;text-decoration:underline;">click here to unsubscribe</a>.</div>`;
                        const mailOptions: nodemailer.SendMailOptions = {
                            from: authEmail.name ? `${authEmail.name} <${authEmail.email}>` : authEmail.email,
                            to: broadcast.toEmail || batchEmails[0],
                            cc: broadcast.sendMethod === 'cc' ? batchEmails : undefined,
                            bcc: broadcast.sendMethod === 'bcc' ? batchEmails : undefined,
                            subject: broadcastTpl.subject,
                            replyTo: broadcast.replyToEmail || authEmail.email,
                            html: bodyWithUnsub,
                            headers: { 'List-Unsubscribe': `<${unsubUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
                        };
                        const result = await sendWithRetries(transporter, mailOptions, 3);
                        if (result.success) {
                            console.log(`Sent broadcast batch from ${authEmail.email} to ${batchEmails.length} recipients.`);
                        }
                    }
                }
                transporter.close();
            }

            // Mark as sent then delete
            await db.collection("Broadcasts").updateOne({ broadcastId: broadcast.broadcastId }, { $set: { status: 'sent', updatedAt: new Date() } });
            console.log(`Broadcast "${broadcast.name}" marked as sent. Will be cleaned up next run.`);
        }

        // Clean up sent broadcasts
        await db.collection("Broadcasts").deleteMany({ status: 'sent' });

        // =====================================================================
        // PROCESS DATE-BASED AUTOMATIONS
        // =====================================================================
        console.log("\n--- Processing Date-Based Automations ---");
        const activeAutomations = await db
            .collection<DateAutomation>("DateAutomations")
            .find({ isActive: true })
            .toArray();
        console.log(`Found ${activeAutomations.length} active date automation(s).`);

        for (const automation of activeAutomations) {
            // Find a scheduled date entry for today that hasn't been sent yet
            const todayEntry = automation.scheduledDates?.find(d => d.date === todayIST);
            if (!todayEntry) continue;
            if ((automation.sentDates || []).includes(todayIST)) {
                console.log(`Automation "${automation.name}" already sent for today. Skipping.`);
                continue;
            }
            if (!timeHasPassed(todayEntry.sendTime)) {
                console.log(`Automation "${automation.name}" send time ${todayEntry.sendTime} not reached yet.`);
                continue;
            }
            console.log(`\nProcessing automation: "${automation.name}" for ${todayIST}`);

            const automationTpl = await resolveTemplate(db, automation.templateId);
            if (!automationTpl) {
                console.log(`Automation "${automation.name}" has no valid template "${automation.templateId}". Skipping.`);
                continue;
            }
            if (!automation.audienceId) { console.log(`No audienceId. Skipping.`); continue; }
            const contacts = await loadAudienceContacts(db, automation.audienceId);
            if (contacts.length === 0) { console.log(`Audience empty. Skipping.`); continue; }
            console.log(`Audience loaded: ${contacts.length} contacts.`);

            for (const senderAddress of automation.senderEmails) {
                const authEmail = allSenderEmails.find(e => e.email === senderAddress.trim());
                if (!authEmail) { console.log(`Sender ${senderAddress} not found. Skipping.`); continue; }

                const transporter = nodemailer.createTransport({
                    host: "smtp.gmail.com",
                    port: 587,
                    secure: false,
                    auth: {
                        user: authEmail.email ?? authEmail.main,
                        pass: safeDecrypt(authEmail.app_password),
                    },
                });

                const baseUrl = (process.env.TRACKING_PIXEL_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://schedular-plum.vercel.app').replace(/\/$/, '');
                const orderedContacts = automation.randomSend ? [...contacts].sort(() => Math.random() - 0.5) : contacts;
                let remaining = automation.dailySendLimitPerSender;
                let globalIdx = 0;

                if (automation.sendMethod === 'one-on-one') {
                    while (globalIdx < orderedContacts.length && remaining > 0) {
                        const contact = orderedContacts[globalIdx++];
                        if (!contact.email?.trim()) continue;
                        if (await isUnsubscribed(db, contact.email.trim())) continue;
                        const validation = await validateEmail(contact.email.trim());
                        if (!validation.isValid) continue;

                        const personalBody = applyVariables(automationTpl.body, contact);
                        const personalSubject = applyVariables(automationTpl.subject, contact);
                        const logId = new ObjectId();
                        const trackingPixelUrl = `${baseUrl}/api/track?logId=${logId.toHexString()}`;
                        const encodedEmail = encodeURIComponent(contact.email.trim());
                        const unsubUrl = `${baseUrl}/api/unsubscribe?campaignId=${automation.automationId}&email=${encodedEmail}&logId=${logId.toHexString()}`;
                        const bodyWithTracking = `${personalBody}<img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:none;"/><div style="text-align:center;margin-top:30px;font-size:12px;color:#6c757d;">If you no longer wish to receive these emails, <a href="${unsubUrl}" style="color:#6c757d;text-decoration:underline;">click here to unsubscribe</a>.</div>`;

                        const result = await sendWithRetries(transporter, {
                            from: authEmail.name ? `${authEmail.name} <${authEmail.email}>` : authEmail.email,
                            to: contact.email.trim(), subject: personalSubject, replyTo: automation.replyToEmail || authEmail.email,
                            html: bodyWithTracking,
                            headers: { 'List-Unsubscribe': `<${unsubUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
                            attachments: automation.attachments?.length > 0 ? automation.attachments.map((a: Attachment) => ({ filename: a.filename, content: Buffer.from(a.content, 'base64'), contentType: a.contentType })) : undefined,
                        }, 3);
                        if (result.success) {
                            console.log(`Automation sent to ${contact.email}`);
                            if (await isFeatureAllowed(db, 'emailLogs')) {
                                await db.collection("EmailLog").insertOne({ _id: logId, status: 'sent', campaignId: automation.automationId, recipientEmail: contact.email.trim(), senderEmail: authEmail.email, sendMethod: automation.sendMethod, sentAt: new Date() });
                            }
                        }
                        remaining--;
                        if (remaining > 0) await sleep(1000 + Math.floor(Math.random() * 2000));
                    }
                } else {
                    const ENV_MAX = Number(process.env.MAX_BCC_BATCH) || 100;
                    const batchEmails = orderedContacts.slice(0, Math.min(remaining, ENV_MAX)).map(c => c.email).filter(Boolean) as string[];
                    if (batchEmails.length > 0) {
                        const unsubUrl = `${baseUrl}/unsubscribe`;
                        const bodyWithUnsub = `${automationTpl.body}<div style="text-align:center;margin-top:30px;font-size:12px;color:#6c757d;">If you no longer wish to receive these emails, <a href="${unsubUrl}" style="color:#6c757d;text-decoration:underline;">click here to unsubscribe</a>.</div>`;
                        const result = await sendWithRetries(transporter, {
                            from: authEmail.name ? `${authEmail.name} <${authEmail.email}>` : authEmail.email,
                            to: automation.toEmail || batchEmails[0],
                            cc: automation.sendMethod === 'cc' ? batchEmails : undefined,
                            bcc: automation.sendMethod === 'bcc' ? batchEmails : undefined,
                            subject: automationTpl.subject, replyTo: automation.replyToEmail || authEmail.email,
                            html: bodyWithUnsub,
                            headers: { 'List-Unsubscribe': `<${unsubUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
                        }, 3);
                        if (result.success) console.log(`Automation batch sent from ${authEmail.email} to ${batchEmails.length} recipients.`);
                    }
                }
                transporter.close();
            }

            // Mark this date as sent
            await db.collection("DateAutomations").updateOne(
                { automationId: automation.automationId },
                { $addToSet: { sentDates: todayIST }, $set: { updatedAt: new Date() } }
            );
            console.log(`Automation "${automation.name}" marked as sent for ${todayIST}.`);
        }

        console.log("\nEmail job completed successfully!");
        process.exit(0);

    } catch (error) {
        console.error("Critical error in sendMail script:", error);
        process.exit(1);
    }
})();