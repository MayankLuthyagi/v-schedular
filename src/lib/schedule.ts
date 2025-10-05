import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import nodemailer from 'nodemailer';
import { ObjectId } from 'mongodb';

// Enhanced error categorization
interface EmailError {
    category: 'validation' | 'authentication' | 'rate_limit' | 'network' | 'recipient' | 'attachment' | 'configuration' | 'unknown';
    reason: string;
    originalError?: string;
}

// Function to categorize email sending errors
function categorizeEmailError(error: Error | { message?: string; code?: string; responseCode?: number }): EmailError {
    const errorMessage = error.message || error.toString();
    const errorCode = 'code' in error ? error.code : undefined;
    const responseCode = 'responseCode' in error ? error.responseCode : undefined;

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
const getAllCampaigns = async () => {
    const { db } = await connectToDatabase();
    return db.collection('Campaigns').find({ isActive: true }).toArray();
};

const getAllEmails = async () => {
    const { db } = await connectToDatabase();
    return db.collection('AuthEmails').find({}).toArray();
};


export async function SendMail() {
    try {
        const campaigns = await getAllCampaigns();
        const allSenderEmails = await getAllEmails();

        const { db } = await connectToDatabase();

        // --- Google API Setup (remains the same) ---
        const oauth2Client = new google.auth.OAuth2(/*...*/);
        oauth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });
        const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

        for (const campaign of campaigns) {
            const today = new Date();
            const dayOfWeek = today.toLocaleString('en-US', { weekday: 'long' });

            // --- Campaign Schedule Check ---
            const startDate = new Date(campaign.startDate);
            const endDate = new Date(campaign.endDate);

            if (!campaign.sendDays.includes(dayOfWeek.toUpperCase()) ||
                startDate > today ||
                endDate < today ||
                campaign.todaySent === today.toDateString()) {
                continue;
            }

            if (campaign.sendTime) {
                const [hours, minutes] = campaign.sendTime.split(':').map(Number);
                const now = new Date();
                if (now.getHours() < hours || (now.getHours() === hours && now.getMinutes() < minutes)) {
                    continue;
                }
            }

            // --- Get Sheet Data ---
            let rows;
            try {
                const response = await sheets.spreadsheets.values.get({
                    spreadsheetId: campaign.sheetId, // Assuming you have sheetId in your campaign
                    range: dayOfWeek,
                });
                rows = response.data.values;
            } catch (error) {
                console.error(`Error fetching sheet data for campaign ${campaign.campaignId}:`, error);
                continue;
            }

            if (!rows || rows.length < 2) { // Assuming row 1 is headers
                continue;
            }


            let globalRecipientIndex = 1;

            for (const senderEmailAddress of campaign.commaId.split(',')) {
                const authEmail = allSenderEmails.find(e => e.email === senderEmailAddress.trim());
                if (!authEmail) continue;

                const transporter = nodemailer.createTransport({
                    host: authEmail.smtpHost,
                    port: authEmail.smtpPort,
                    secure: authEmail.secure,
                    auth: {
                        user: authEmail.email ?? authEmail.main,
                        pass: authEmail.app_password,
                    },
                });

                // ** NEW: Logic splits based on send method **
                if (campaign.sendMethod === "bcc" || campaign.sendMethod === "cc") {
                    // --- BATCH SENDING LOGIC (BCC/CC) ---
                    const recipientEmailsForBatch: string[] = [];
                    let i = 0;
                    while (globalRecipientIndex < rows.length && i < campaign.dailySendLimitPerSender) {
                        const recipientEmail = rows[globalRecipientIndex]?.[0];
                        if (recipientEmail && recipientEmail.trim()) {
                            recipientEmailsForBatch.push(recipientEmail.trim());
                        }
                        globalRecipientIndex++;
                        i++;
                    }

                    if (recipientEmailsForBatch.length === 0) continue;

                    const mailOptions: nodemailer.SendMailOptions = {
                        from: authEmail.name ? `${authEmail.name} <${authEmail.email}>` : authEmail.email,
                        to: campaign.toEmail, // The primary recipient
                        cc: campaign.sendMethod === "cc" ? recipientEmailsForBatch : undefined,
                        bcc: campaign.sendMethod === "bcc" ? recipientEmailsForBatch : undefined,
                        subject: campaign.emailSubject,
                        html: campaign.emailBody, // No individual tracking pixel for batches
                    };

                    // Handle attachments from MongoDB
                    if (campaign.attachments && campaign.attachments.length > 0) {
                        mailOptions.attachments = campaign.attachments.map((attachment: { filename: string; content: string; contentType: string }) => ({
                            filename: attachment.filename,
                            content: Buffer.from(attachment.content, 'base64'),
                            contentType: attachment.contentType,
                        }));
                    }

                    try {
                        await transporter.sendMail(mailOptions);
                        console.log(`Successfully sent batch from ${authEmail.email} to ${recipientEmailsForBatch.length} recipients.`);

                        // Log success for every recipient in the batch
                        const successLogs = recipientEmailsForBatch.map(email => ({
                            campaignId: campaign.campaignId,
                            recipientEmail: email,
                            senderEmail: authEmail.email,
                            sendMethod: campaign.sendMethod,
                            status: 'sent',
                            sentAt: new Date(),
                        }));
                        await db.collection('EmailLog').insertMany(successLogs);

                    } catch (emailError: unknown) {
                        const categorizedError = categorizeEmailError(emailError as Error);
                        console.error(`Failed to send batch from ${authEmail.email}: [${categorizedError.category.toUpperCase()}] ${categorizedError.reason}`);

                        // Log failure for every recipient in the batch
                        const failureLogs = recipientEmailsForBatch.map(email => ({
                            campaignId: campaign.campaignId,
                            recipientEmail: email,
                            senderEmail: authEmail.email,
                            sendMethod: campaign.sendMethod,
                            status: 'failed',
                            failureReason: categorizedError.reason,
                            failureCategory: categorizedError.category,
                            originalError: categorizedError.originalError,
                            sentAt: new Date(),
                        }));
                        await db.collection('EmailLog').insertMany(failureLogs);
                    }

                } else {
                    // --- INDIVIDUAL SENDING LOGIC ---
                    let sentFromThisSender = 0;
                    while (globalRecipientIndex < rows.length && sentFromThisSender < campaign.dailySendLimitPerSender) {
                        const recipientEmail = rows[globalRecipientIndex]?.[0];
                        globalRecipientIndex++;

                        if (!recipientEmail || !recipientEmail.trim()) continue;

                        sentFromThisSender++;

                        // This is the individual tracking logic from the previous answer
                        const logId = new ObjectId();

                        // Only add tracking pixel for one-on-one emails
                        let emailBodyToSend = campaign.emailBody;
                        if (campaign.sendMethod === 'one-on-one') {
                            const trackingPixelUrl = `${process.env.YOUR_DOMAIN}/api/track?logId=${logId.toHexString()}`;
                            emailBodyToSend = `${campaign.emailBody}<img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:none;"/>`;
                        }

                        const mailOptions: nodemailer.SendMailOptions = {
                            from: authEmail.name ? `${authEmail.name} <${authEmail.email}>` : authEmail.email,
                            to: recipientEmail,
                            subject: campaign.emailSubject,
                            html: emailBodyToSend,
                        };

                        // Handle attachments from MongoDB
                        if (campaign.attachments && campaign.attachments.length > 0) {
                            mailOptions.attachments = campaign.attachments.map((attachment: { filename: string; content: string; contentType: string }) => ({
                                filename: attachment.filename,
                                content: Buffer.from(attachment.content, 'base64'),
                                contentType: attachment.contentType,
                            }));
                        }
                        try {
                            await transporter.sendMail(mailOptions);
                            await db.collection('EmailLog').insertOne({
                                _id: logId,
                                status: 'sent',
                                campaignId: campaign.campaignId,
                                recipientEmail: recipientEmail.trim(),
                                senderEmail: authEmail.email,
                                sendMethod: campaign.sendMethod,
                                sentAt: new Date(),
                            });
                        } catch (emailError: unknown) {
                            const categorizedError = categorizeEmailError(emailError as Error);
                            await db.collection('EmailLog').insertOne({
                                _id: logId,
                                status: 'failed',
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
            // Update campaign as sent for today
            await db.collection('Campaigns').updateOne(
                { _id: campaign._id },
                { $set: { todaySent: today.toDateString() } }
            );
        }
        return NextResponse.json({ message: 'Email sending process completed.' });
    } catch (error) {
        console.error('Critical error in SendMail function:', error);
        return NextResponse.json({ error: 'Failed to send emails' }, { status: 500 });
    }
}
