import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const logId = searchParams.get('logId');

        if (!logId || !ObjectId.isValid(logId)) {
            return new NextResponse('Invalid tracking ID.', { status: 400 });
        }

        // Get request headers for better tracking accuracy
        const userAgent = request.headers.get('user-agent') || '';
        const referer = request.headers.get('referer') || '';
        const xForwardedFor = request.headers.get('x-forwarded-for') || '';
        const realIp = request.headers.get('x-real-ip') || '';

        // Skip tracking if it looks like an automated request
        const automatedUserAgents = [
            'googlebot',
            'bingbot',
            'slurp',
            'crawler',
            'spider',
            'proxy',
            'scanner',
            'gmail',
            'outlook-com',
            'mailchimp',
            'constantcontact'
        ];

        const isAutomated = automatedUserAgents.some(bot =>
            userAgent.toLowerCase().includes(bot)
        );

        const { db } = await connectToDatabase();

        if (!isAutomated) {
            // First, get the email log to check timing
            const emailLog = await db.collection('EmailLog').findOne({ _id: new ObjectId(logId) });

            if (emailLog && emailLog.sentAt) {
                const emailSentTime = new Date(emailLog.sentAt).getTime();
                const currentTime = new Date().getTime();
                const timeDiff = currentTime - emailSentTime;

                // Only update if opened more than 10 seconds after sending
                // This helps filter out immediate automated opens
                if (timeDiff > 10000) { // 10 seconds
                    // Find the log and update its status to 'opened' only for one-on-one emails
                    await db.collection('EmailLog').updateOne(
                        {
                            _id: new ObjectId(logId),
                            status: { $ne: 'opened' },
                            sendMethod: { $nin: ['cc', 'bcc'] } // Only track opens for one-on-one emails
                        },
                        {
                            $set: {
                                status: 'opened',
                                openedAt: new Date(),
                                trackingData: {
                                    userAgent,
                                    referer,
                                    ip: xForwardedFor || realIp,
                                    timeDiff: timeDiff
                                }
                            }
                        }
                    );
                } else {
                    console.log(`Potential automated open detected (too fast): ${logId}, Time diff: ${timeDiff}ms`);
                }
            }
        } else {
            console.log(`Automated request detected for email tracking: ${logId}, User Agent: ${userAgent}`);
        }

    } catch (error) {
        // Log the error but don't fail the image response
        console.error("Tracking error:", error);
    } finally {
        // **IMPORTANT**: Always return a 1x1 transparent GIF image response.
        // This prevents broken image icons in the user's email client.
        const pixel = Buffer.from(
            'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'
        );
        return new NextResponse(pixel, {
            headers: {
                'Content-Type': 'image/gif',
                'Content-Length': pixel.length.toString(),
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Surrogate-Control': 'no-store'
            }
        });
    }
}