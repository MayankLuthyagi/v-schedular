// scripts/sendMail.ts
import { google } from "googleapis";
import { connectToDatabase } from "@/lib/db";
import nodemailer from "nodemailer";
import { ObjectId, Db } from "mongodb";
import { validateEmail } from "@/lib/emailValidation";
import type { SiteSettings } from "@/types/settings";
import type { Campaign, Attachment } from "@/types/campaign";
import type { AuthEmail } from "@/types/auth";
import "dotenv/config";

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

(async () => {
    console.log("🚀 Starting scheduled email job...");

    try {
        const { db } = await connectToDatabase();
        console.log("✔️ Database connected.");

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

        // --- Google Sheets setup ---
        const oauth2Client = new google.auth.OAuth2(
            process.env.CLIENT_ID,
            process.env.CLIENT_SECRET,
            process.env.REDIRECT_URI
        );
        oauth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });
        const sheets = google.sheets({ version: "v4", auth: oauth2Client });

        for (const campaign of campaigns) {
            console.log(`\nProcessing campaign: "${campaign.campaignName}" (ID: ${campaign.campaignId})`);

            // Get current time in IST (UTC+5:30)
            const nowUTC = new Date();
            const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30 in milliseconds
            const nowIST = new Date(nowUTC.getTime() + istOffset);

            const today = nowIST;
            // Get day of week using the IST-adjusted date (use UTC methods since we already shifted the time)
            const dayOfWeek = nowIST.toLocaleString("en-US", { weekday: "long", timeZone: "UTC" });

            console.log(`  - 📅 Current IST day: ${dayOfWeek}, Date: ${nowIST.toISOString().split('T')[0]}`);

            // --- Campaign schedule validation ---
            const startDate = new Date(campaign.startDate);
            const endDate = new Date(campaign.endDate);
            // Compare dates only (without time component)
            const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
            const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

            const isCorrectDay = campaign.sendDays.includes(dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1));
            const isWithinDateRange = startDateOnly <= todayDateOnly && endDateOnly >= todayDateOnly;
            let isAlreadySentToday = false;
            const campaignTodaySent = campaign.todaySent instanceof Date ? campaign.todaySent.toDateString() : new Date(campaign.todaySent).toDateString();
            if (campaign.todaySent instanceof Date && campaignTodaySent === campaign.createdAt.toDateString()) isAlreadySentToday = false;
            else {
                isAlreadySentToday = campaign.todaySent ?
                    (campaign.todaySent instanceof Date ? campaign.todaySent.toDateString() : new Date(campaign.todaySent).toDateString()) === today.toDateString() :
                    false;
            }

            if (!isCorrectDay || !isWithinDateRange || isAlreadySentToday) {
                console.log("  - 🟡 Skipping: Campaign schedule does not match.");
                if (!isCorrectDay) console.log(`    - Reason: Today is ${dayOfWeek}, not in send days [${campaign.sendDays.join(', ')}].`);
                if (!isWithinDateRange) console.log("    - Reason: Today is outside the start/end date range.");
                if (isAlreadySentToday) console.log("    - Reason: Campaign has already been marked as sent today.");
                continue;
            }

            if (campaign.sendTime) {
                const [hours, minutes] = campaign.sendTime.split(":").map(Number);
                // Get current IST hours and minutes
                const currentISTHours = nowIST.getUTCHours();
                const currentISTMinutes = nowIST.getUTCMinutes();

                console.log(`  - 🕐 Current IST time: ${currentISTHours}:${currentISTMinutes.toString().padStart(2, '0')}, Scheduled time: ${campaign.sendTime}`);

                if (currentISTHours < hours || (currentISTHours === hours && currentISTMinutes < minutes)) {
                    console.log(`  - 🟡 Skipping: Current IST time is before the scheduled send time of ${campaign.sendTime}.`);
                    continue;
                }
            }
            console.log("  - ✔️ Schedule and time validation passed.");

            // --- Fetch recipients from Google Sheet ---
            let rows;
            try {
                const sheetName = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);
                console.log(`  - fetching data from Google Sheet "${sheetName}"...`);
                const response = await sheets.spreadsheets.values.get({
                    spreadsheetId: campaign.sheetId,
                    range: sheetName,
                });
                rows = response.data.values;
            } catch (error) {
                console.error(`  - ❌ Failed to fetch Google Sheet: ${error instanceof Error ? error.message : 'Unknown error'}`);
                continue;
            }

            if (!rows || rows.length < 2) {
                console.log("  - 🟡 Skipping: No recipient data found in the Google Sheet for today.");
                continue;
            }
            console.log(`  - ✔️ Found ${rows.length - 1} potential recipients in the sheet.`);

            if (!campaign.randomSend) {
                let globalRecipientIndex = 1;
                for (const senderEmailAddress of campaign.commaId) {
                    const authEmail = allSenderEmails.find((e) => e.email === senderEmailAddress.trim());
                    if (!authEmail) {
                        console.log(`  - 🟡 Skipping sender ${senderEmailAddress}: Not found in AuthEmails.`);
                        continue;
                    }
                    console.log(`  - ✉️ Preparing to send from: ${authEmail.email}`);

                    const transporter = nodemailer.createTransport({
                        host: "smtp.gmail.com",
                        port: 587,
                        secure: false,
                        auth: {
                            user: authEmail.email ?? authEmail.main,
                            pass: authEmail.app_password,
                        },
                    });

                    // --- Send logic ---
                    if (campaign.sendMethod === "bcc" || campaign.sendMethod === "cc") {
                        const recipientEmailsForBatch: string[] = [];
                        const invalidEmails: { email: string; reason: string }[] = [];
                        let i = 0;
                        while (
                            globalRecipientIndex < rows.length &&
                            i < campaign.dailySendLimitPerSender
                        ) {
                            const recipientEmail = rows[globalRecipientIndex]?.[0];
                            globalRecipientIndex++;
                            if (!recipientEmail?.trim()) continue;

                            // Validate email before adding to batch
                            const validation = await validateEmail(recipientEmail.trim());
                            if (validation.isValid) {
                                recipientEmailsForBatch.push(recipientEmail.trim());
                                i++;
                            } else {
                                console.log(`  - 🚫 Skipping invalid email ${recipientEmail}: ${validation.reason}`);
                                invalidEmails.push({ email: recipientEmail.trim(), reason: validation.reason || 'Invalid email' });
                            }
                        }

                        // Log invalid emails
                        if (await isFeatureAllowed(db, 'emailLogs') && invalidEmails.length > 0) {
                            const invalidLogs = invalidEmails.map((invalid) => ({
                                campaignId: campaign.campaignId,
                                recipientEmail: invalid.email,
                                senderEmail: authEmail.email,
                                sendMethod: campaign.sendMethod,
                                status: "failed",
                                failureReason: `Validation failed: ${invalid.reason}`,
                                failureCategory: 'validation',
                                originalError: invalid.reason,
                                sentAt: new Date(),
                            }));
                            await db.collection("EmailLog").insertMany(invalidLogs);
                        }

                        if (recipientEmailsForBatch.length === 0) continue;

                        const mailOptions: nodemailer.SendMailOptions = {
                            from: authEmail.name
                                ? `${authEmail.name} <${authEmail.email}>`
                                : authEmail.email,
                            to: campaign.toEmail,
                            cc: campaign.sendMethod === "cc" ? recipientEmailsForBatch : undefined,
                            bcc:
                                campaign.sendMethod === "bcc" ? recipientEmailsForBatch : undefined,
                            subject: campaign.emailSubject,
                            replyTo: campaign.replyToEmail === "" ? authEmail.email : campaign.replyToEmail,
                            html: campaign.emailBody,
                        };

                        if (campaign.attachments?.length > 0) {
                            mailOptions.attachments = campaign.attachments.map(
                                (attachment: Attachment) => ({
                                    filename: attachment.filename,
                                    content: Buffer.from(attachment.content, "base64"),
                                    contentType: attachment.contentType,
                                })
                            );
                        }
                        try {
                            await transporter.sendMail(mailOptions);
                            console.log(
                                `✅ Sent batch from ${authEmail.email} to ${recipientEmailsForBatch.length} recipients.`
                            );
                            if (await isFeatureAllowed(db, 'emailLogs')) {
                                const successLogs = recipientEmailsForBatch.map((email) => ({
                                    campaignId: campaign.campaignId,
                                    recipientEmail: email,
                                    senderEmail: authEmail.email,
                                    sendMethod: campaign.sendMethod,
                                    status: "sent",
                                    sentAt: new Date(),
                                }));
                                await db.collection("EmailLog").insertMany(successLogs);
                            }
                        } catch (emailError: unknown) {
                            const error = emailError as Error;
                            console.error(
                                `❌ Failed batch from ${authEmail.email}:`,
                                error.message
                            );
                            continue; // Skip to next sender
                        }
                    } else {
                        let sentFromThisSender = 0;
                        while (
                            globalRecipientIndex < rows.length &&
                            sentFromThisSender < campaign.dailySendLimitPerSender
                        ) {
                            const recipientEmail = rows[globalRecipientIndex]?.[0];
                            globalRecipientIndex++;
                            if (!recipientEmail?.trim()) continue;

                            const logId = new ObjectId();

                            // Validate email before sending
                            const validation = await validateEmail(recipientEmail.trim());
                            if (!validation.isValid) {
                                console.log(`  - 🚫 Skipping invalid email ${recipientEmail}: ${validation.reason}`);
                                if (await isFeatureAllowed(db, 'emailLogs')) {
                                    await db.collection("EmailLog").insertOne({
                                        _id: logId,
                                        status: "failed",
                                        failureReason: `Validation failed: ${validation.reason}`,
                                        failureCategory: 'validation',
                                        originalError: validation.reason,
                                        campaignId: campaign.campaignId,
                                        recipientEmail: recipientEmail.trim(),
                                        senderEmail: authEmail.email,
                                        sendMethod: campaign.sendMethod,
                                        sentAt: new Date(),
                                    });
                                }
                                continue;
                            }

                            sentFromThisSender++;

                            // Only add tracking pixel for one-on-one emails
                            let emailBodyToSend = campaign.emailBody;
                            if (campaign.sendMethod === 'one-on-one') {
                                const baseUrl = (process.env.TRACKING_PIXEL_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
                                const trackingPixelUrl = `${baseUrl}/api/track?logId=${logId.toHexString()}`;
                                emailBodyToSend = `${campaign.emailBody}<img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:none;"/>`;
                            }

                            const mailOptions: nodemailer.SendMailOptions = {
                                from: authEmail.name
                                    ? `${authEmail.name} <${authEmail.email}>`
                                    : authEmail.email,
                                to: recipientEmail,
                                subject: campaign.emailSubject,
                                replyTo: campaign.replyToEmail === "" ? authEmail.email : campaign.replyToEmail,
                                html: emailBodyToSend,
                            };

                            if (campaign.attachments?.length > 0) {
                                mailOptions.attachments = campaign.attachments.map(
                                    (attachment: Attachment) => ({
                                        filename: attachment.filename,
                                        content: Buffer.from(attachment.content, "base64"),
                                        contentType: attachment.contentType,
                                    })
                                );
                            }

                            try {
                                await transporter.sendMail(mailOptions);
                                console.log(`  - ✅ Sent to ${recipientEmail.trim()}`);
                                // Add delay between individual sends to avoid rate limiting
                                if (sentFromThisSender < campaign.dailySendLimitPerSender) {
                                    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
                                }
                                if (await isFeatureAllowed(db, 'emailLogs')) {
                                    await db.collection("EmailLog").insertOne({
                                        _id: logId,
                                        status: "sent",
                                        campaignId: campaign.campaignId,
                                        recipientEmail: recipientEmail.trim(),
                                        senderEmail: authEmail.email,
                                        sendMethod: campaign.sendMethod,
                                        sentAt: new Date(),
                                    });
                                }
                            } catch (emailError: unknown) {
                                const error = emailError as Error & { code?: string; responseCode?: number };
                                const categorizedError = categorizeEmailError(error);
                                console.log(`  - ❌ Failed to send to ${recipientEmail.trim()}: [${categorizedError.category.toUpperCase()}] ${categorizedError.reason}`);
                                if (await isFeatureAllowed(db, 'emailLogs')) {
                                    await db.collection("EmailLog").insertOne({
                                        _id: logId,
                                        status: "failed",
                                        failureReason: categorizedError.reason,
                                        failureCategory: categorizedError.category,
                                        originalError: categorizedError.originalError,
                                        campaignId: campaign.campaignId,
                                        recipientEmail: recipientEmail.trim(),
                                        senderEmail: authEmail.email,
                                        sendMethod: campaign.sendMethod,
                                        sentAt: new Date(),
                                    });
                                }
                            }
                        }
                    }
                    transporter.close();
                }

            } else {
                // Randomly send enabled
                const shuffledRows = rows.slice(1);
                for (let i = shuffledRows.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffledRows[i], shuffledRows[j]] = [shuffledRows[j], shuffledRows[i]];
                }
                let globalRecipientIndex = 0;
                for (const senderEmailAddress of campaign.commaId) {
                    const authEmail = allSenderEmails.find((e) => e.email === senderEmailAddress.trim());
                    if (!authEmail) {
                        console.log(`  - 🟡 Skipping sender ${senderEmailAddress}: Not found in AuthEmails.`);
                        continue;
                    }
                    console.log(`  - ✉️ Preparing to send from: ${authEmail.email}`);

                    const transporter = nodemailer.createTransport({
                        host: "smtp.gmail.com",
                        port: 587,
                        secure: false,
                        auth: {
                            user: authEmail.email ?? authEmail.main,
                            pass: authEmail.app_password,
                        },
                    });

                    // --- Send logic ---
                    if (campaign.sendMethod === "bcc" || campaign.sendMethod === "cc") {
                        const recipientEmailsForBatch: string[] = [];
                        const invalidEmails: { email: string; reason: string }[] = [];
                        let i = 0;
                        while (
                            globalRecipientIndex < shuffledRows.length &&
                            i < campaign.dailySendLimitPerSender
                        ) {
                            const recipientEmail = shuffledRows[globalRecipientIndex]?.[0];
                            globalRecipientIndex++;
                            if (!recipientEmail?.trim()) continue;

                            // Validate email before adding to batch
                            const validation = await validateEmail(recipientEmail.trim());
                            if (validation.isValid) {
                                recipientEmailsForBatch.push(recipientEmail.trim());
                                i++;
                            } else {
                                console.log(`  - 🚫 Skipping invalid email ${recipientEmail}: ${validation.reason}`);
                                invalidEmails.push({ email: recipientEmail.trim(), reason: validation.reason || 'Invalid email' });
                            }
                        }

                        // Log invalid emails
                        if (await isFeatureAllowed(db, 'emailLogs') && invalidEmails.length > 0) {
                            const invalidLogs = invalidEmails.map((invalid) => ({
                                campaignId: campaign.campaignId,
                                recipientEmail: invalid.email,
                                senderEmail: authEmail.email,
                                sendMethod: campaign.sendMethod,
                                status: "failed",
                                failureReason: `Validation failed: ${invalid.reason}`,
                                failureCategory: 'validation',
                                originalError: invalid.reason,
                                sentAt: new Date(),
                            }));
                            await db.collection("EmailLog").insertMany(invalidLogs);
                        }

                        if (recipientEmailsForBatch.length === 0) continue;

                        const mailOptions: nodemailer.SendMailOptions = {
                            from: authEmail.name
                                ? `${authEmail.name} <${authEmail.email}>`
                                : authEmail.email,
                            to: campaign.toEmail,
                            cc: campaign.sendMethod === "cc" ? recipientEmailsForBatch : undefined,
                            bcc:
                                campaign.sendMethod === "bcc" ? recipientEmailsForBatch : undefined,
                            subject: campaign.emailSubject,
                            replyTo: campaign.replyToEmail === "" ? authEmail.email : campaign.replyToEmail,
                            html: campaign.emailBody,
                        };

                        if (campaign.attachments?.length > 0) {
                            mailOptions.attachments = campaign.attachments.map(
                                (attachment: Attachment) => ({
                                    filename: attachment.filename,
                                    content: Buffer.from(attachment.content, "base64"),
                                    contentType: attachment.contentType,
                                })
                            );
                        }
                        try {
                            await transporter.sendMail(mailOptions);
                            console.log(
                                `✅ Sent batch from ${authEmail.email} to ${recipientEmailsForBatch.length} recipients.`
                            );
                            if (await isFeatureAllowed(db, 'emailLogs')) {
                                const successLogs = recipientEmailsForBatch.map((email) => ({
                                    campaignId: campaign.campaignId,
                                    recipientEmail: email,
                                    senderEmail: authEmail.email,
                                    sendMethod: campaign.sendMethod,
                                    status: "sent",
                                    sentAt: new Date(),
                                }));
                                await db.collection("EmailLog").insertMany(successLogs);
                            }
                        } catch (emailError: unknown) {
                            const error = emailError as Error;
                            console.error(
                                `❌ Failed batch from ${authEmail.email}:`,
                                error.message
                            );
                            continue; // Skip to next sender
                        }
                    } else {
                        let sentFromThisSender = 0;
                        while (
                            globalRecipientIndex < shuffledRows.length &&
                            sentFromThisSender < campaign.dailySendLimitPerSender
                        ) {
                            const recipientEmail = shuffledRows[globalRecipientIndex]?.[0];
                            globalRecipientIndex++;
                            if (!recipientEmail?.trim()) continue;

                            const logId = new ObjectId();

                            // Validate email before sending
                            const validation = await validateEmail(recipientEmail.trim());
                            if (!validation.isValid) {
                                console.log(`  - 🚫 Skipping invalid email ${recipientEmail}: ${validation.reason}`);
                                if (await isFeatureAllowed(db, 'emailLogs')) {
                                    await db.collection("EmailLog").insertOne({
                                        _id: logId,
                                        status: "failed",
                                        failureReason: `Validation failed: ${validation.reason}`,
                                        failureCategory: 'validation',
                                        originalError: validation.reason,
                                        campaignId: campaign.campaignId,
                                        recipientEmail: recipientEmail.trim(),
                                        senderEmail: authEmail.email,
                                        sendMethod: campaign.sendMethod,
                                        sentAt: new Date(),
                                    });
                                }
                                continue;
                            }

                            sentFromThisSender++;

                            // Only add tracking pixel for one-on-one emails
                            let emailBodyToSend = campaign.emailBody;
                            if (campaign.sendMethod === 'one-on-one') {
                                const baseUrl = (process.env.TRACKING_PIXEL_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
                                const trackingPixelUrl = `${baseUrl}/api/track?logId=${logId.toHexString()}`;
                                emailBodyToSend = `${campaign.emailBody}<img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:none;"/>`;
                            }

                            const mailOptions: nodemailer.SendMailOptions = {
                                from: authEmail.name
                                    ? `${authEmail.name} <${authEmail.email}>`
                                    : authEmail.email,
                                to: recipientEmail,
                                subject: campaign.emailSubject,
                                replyTo: campaign.replyToEmail === "" ? authEmail.email : campaign.replyToEmail,
                                html: emailBodyToSend,
                            };

                            if (campaign.attachments?.length > 0) {
                                mailOptions.attachments = campaign.attachments.map(
                                    (attachment: Attachment) => ({
                                        filename: attachment.filename,
                                        content: Buffer.from(attachment.content, "base64"),
                                        contentType: attachment.contentType,
                                    })
                                );
                            }

                            try {
                                await transporter.sendMail(mailOptions);
                                console.log(`  - ✅ Sent to ${recipientEmail.trim()}`);
                                // Add delay between individual sends to avoid rate limiting
                                if (sentFromThisSender < campaign.dailySendLimitPerSender) {
                                    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
                                }
                                if (await isFeatureAllowed(db, 'emailLogs')) {
                                    await db.collection("EmailLog").insertOne({
                                        _id: logId,
                                        status: "sent",
                                        campaignId: campaign.campaignId,
                                        recipientEmail: recipientEmail.trim(),
                                        senderEmail: authEmail.email,
                                        sendMethod: campaign.sendMethod,
                                        sentAt: new Date(),
                                    });
                                }
                            } catch (emailError: unknown) {
                                const error = emailError as Error & { code?: string; responseCode?: number };
                                const categorizedError = categorizeEmailError(error);
                                console.log(`  - ❌ Failed to send to ${recipientEmail.trim()}: [${categorizedError.category.toUpperCase()}] ${categorizedError.reason}`);
                                if (await isFeatureAllowed(db, 'emailLogs')) {
                                    await db.collection("EmailLog").insertOne({
                                        _id: logId,
                                        status: "failed",
                                        failureReason: categorizedError.reason,
                                        failureCategory: categorizedError.category,
                                        originalError: categorizedError.originalError,
                                        campaignId: campaign.campaignId,
                                        recipientEmail: recipientEmail.trim(),
                                        senderEmail: authEmail.email,
                                        sendMethod: campaign.sendMethod,
                                        sentAt: new Date(),
                                    });
                                }
                            }
                        }
                    }
                    transporter.close();
                }

            }

            await db.collection("Campaigns").updateOne(
                { _id: campaign._id },
                { $set: { todaySent: todayDateOnly.toDateString() } } // Use toDateString to be consistent
            );
            console.log(`  - 📝 Marked campaign as sent for today.`);

            // Run cleanup for false opens if emailLogs is enabled and campaign is one-on-one
            if (await isFeatureAllowed(db, 'emailLogs') && campaign.sendMethod === 'one-on-one') {
                console.log("  - ⏱️ Waiting 10 seconds for bot scans to complete...");
                await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds

                console.log("  - 🧹 Cleaning up false opens from this campaign...");
                try {
                    const baseUrl = (process.env.TRACKING_PIXEL_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
                    const response = await fetch(`${baseUrl}/api/analyze-opens?action=cleanup&threshold=10`);

                    if (response.ok) {
                        const data = await response.json();
                        console.log(`  - ✅ Cleaned up ${data.cleanedCount} false opens from campaign "${campaign.campaignName}"`);
                    } else {
                        console.log("  - ⚠️ Cleanup API responded with error:", response.status);
                    }
                } catch (error) {
                    console.log("  - ⚠️ Could not run cleanup:", error instanceof Error ? error.message : 'Unknown error');
                }
            } else {
                if (!await isFeatureAllowed(db, 'emailLogs')) {
                    console.log("  - ℹ️ Email logs disabled, skipping cleanup");
                }
                if (campaign.sendMethod !== 'one-on-one') {
                    console.log("  - ℹ️ Campaign uses bulk method, no tracking pixels to clean up");
                }
            }
        }

        console.log("\n✅ Email job completed successfully!");
        process.exit(0);

    } catch (error) {
        console.error("🔥 Critical error in sendMail script:", error);
        process.exit(1);
    }
})();