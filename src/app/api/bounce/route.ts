import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // This endpoint can be configured as a webhook for email bounce notifications
        // Different email providers have different webhook formats

        // Example for Gmail/Google Workspace bounce handling
        if (body.eventType === 'bounce' && body.bounce) {
            const { db } = await connectToDatabase();

            for (const bouncedRecipient of body.bounce.bouncedRecipients) {
                const emailAddress = bouncedRecipient.emailAddress;
                const bounceReason = bouncedRecipient.diagnosticCode || 'Email bounced';

                // Find and update the email log entry
                await db.collection('EmailLog').updateOne(
                    {
                        recipientEmail: emailAddress,
                        status: 'sent'
                    },
                    {
                        $set: {
                            status: 'bounced',
                            bounceReason: bounceReason,
                            bounceCategory: 'recipient',
                            bouncedAt: new Date()
                        }
                    }
                );

                console.log(`Updated bounce status for ${emailAddress}: ${bounceReason}`);
            }
        }

        // Example for handling complaints (spam reports)
        if (body.eventType === 'complaint' && body.complaint) {
            const { db } = await connectToDatabase();

            for (const complainedRecipient of body.complaint.complainedRecipients) {
                const emailAddress = complainedRecipient.emailAddress;

                // Update the email log entry
                await db.collection('EmailLog').updateOne(
                    {
                        recipientEmail: emailAddress,
                        status: 'sent'
                    },
                    {
                        $set: {
                            status: 'complained',
                            complainedAt: new Date()
                        }
                    }
                );

                console.log(`Updated complaint status for ${emailAddress}`);
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error handling bounce notification:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to process bounce notification' },
            { status: 500 }
        );
    }
}

// Handle manual bounce reporting
export async function PUT(request: NextRequest) {
    try {
        const { recipientEmail, reason } = await request.json();

        if (!recipientEmail) {
            return NextResponse.json(
                { success: false, error: 'Recipient email is required' },
                { status: 400 }
            );
        }

        const { db } = await connectToDatabase();

        // Update the most recent email log entry for this recipient
        const updateResult = await db.collection('EmailLog').updateOne(
            {
                recipientEmail: recipientEmail,
                status: 'sent'
            },
            {
                $set: {
                    status: 'bounced',
                    bounceReason: reason || 'Manually reported bounce',
                    bounceCategory: 'recipient',
                    bouncedAt: new Date()
                }
            },
            { sort: { sentAt: -1 } } // Update the most recent one
        );

        if (updateResult.matchedCount === 0) {
            return NextResponse.json(
                { success: false, error: 'No sent email found for this recipient' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: `Updated bounce status for ${recipientEmail}`
        });
    } catch (error) {
        console.error('Error manually updating bounce status:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to update bounce status' },
            { status: 500 }
        );
    }
}