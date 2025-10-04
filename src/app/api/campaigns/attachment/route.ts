import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const campaignId = searchParams.get('campaignId');
        const attachmentIndex = searchParams.get('index');

        if (!campaignId || attachmentIndex === null) {
            return NextResponse.json(
                { error: 'Campaign ID and attachment index are required' },
                { status: 400 }
            );
        }

        const { db } = await connectToDatabase();
        const campaign = await db.collection('Campaigns').findOne({ campaignId });

        if (!campaign) {
            return NextResponse.json(
                { error: 'Campaign not found' },
                { status: 404 }
            );
        }

        const index = parseInt(attachmentIndex);
        if (!campaign.attachments || !campaign.attachments[index]) {
            return NextResponse.json(
                { error: 'Attachment not found' },
                { status: 404 }
            );
        }

        const attachment = campaign.attachments[index];

        // Convert base64 back to buffer
        const buffer = Buffer.from(attachment.content, 'base64');

        // Create response with appropriate headers
        const response = new NextResponse(buffer);
        response.headers.set('Content-Type', attachment.contentType);
        response.headers.set('Content-Disposition', `attachment; filename="${attachment.filename}"`);

        return response;

    } catch (error) {
        console.error('Error fetching attachment:', error);
        return NextResponse.json(
            { error: 'Failed to fetch attachment' },
            { status: 500 }
        );
    }
}