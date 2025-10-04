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

        const { db } = await connectToDatabase();
        
        // Find the log and update its status to 'opened'
        await db.collection('EmailLog').updateOne(
            { _id: new ObjectId(logId), status: { $ne: 'opened' } }, // Avoid multiple updates
            {
                $set: {
                    status: 'opened',
                    openedAt: new Date(),
                }
            }
        );

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