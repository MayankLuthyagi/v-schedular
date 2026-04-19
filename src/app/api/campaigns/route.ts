import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();

        const campaignData: Record<string, unknown> = {
            campaignId: uuidv4(),
            campaignName: formData.get('campaignName') as string,
            templateId: formData.get('templateId') as string,
            audienceId: formData.get('audienceId') as string || undefined,
            senderEmails: JSON.parse(formData.get('senderEmails') as string || '[]'),
            startDate: formData.get('startDate') as string,
            endDate: formData.get('endDate') as string,
            sendTime: formData.get('sendTime') as string,
            sendDays: JSON.parse(formData.get('sendDays') as string || '[]'),
            dailySendLimitPerSender: parseInt(formData.get('dailySendLimitPerSender') as string),
            toEmail: formData.get('toEmail') as string || '',
            replyToEmail: formData.get('replyToEmail') as string || '',
            sendMethod: formData.get('sendMethod') as string,
            isActive: formData.get('isActive') === 'true',
            randomSend: formData.get('randomSend') === 'true',
            todaySent: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const attachment = formData.get('attachment') as File | null;
        if (attachment && attachment.size > 0) {
            if (attachment.size > 5 * 1024 * 1024) {
                return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 });
            }
            const buffer = Buffer.from(await attachment.arrayBuffer());
            campaignData.attachments = [{
                filename: attachment.name,
                content: buffer.toString('base64'),
                contentType: attachment.type,
                note: formData.get('attachmentNote') as string || ''
            }];
        } else {
            campaignData.attachments = [];
        }

        const { db } = await connectToDatabase();
        await db.collection('Campaigns').insertOne(campaignData);

        return NextResponse.json({ success: true, campaignId: campaignData.campaignId, message: 'Campaign created successfully' });
    } catch (error) {
        console.error('Error creating campaign:', error);
        return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const campaignId = searchParams.get('campaignId');
        const { db } = await connectToDatabase();

        if (campaignId) {
            const campaign = await db.collection('Campaigns').findOne({ campaignId });
            if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
            return NextResponse.json(campaign);
        } else {
            const campaigns = await db.collection('Campaigns').find({}).toArray();
            return NextResponse.json(campaigns);
        }
    } catch (error) {
        console.error('Error fetching campaigns:', error);
        return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const formData = await request.formData();
        const campaignId = formData.get('campaignId') as string;

        if (!campaignId) {
            return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 });
        }

        const updateData: Record<string, unknown> = {
            campaignName: formData.get('campaignName') as string,
            templateId: formData.get('templateId') as string,
            audienceId: formData.get('audienceId') as string || undefined,
            senderEmails: JSON.parse(formData.get('senderEmails') as string || '[]'),
            startDate: formData.get('startDate') as string,
            endDate: formData.get('endDate') as string,
            sendTime: formData.get('sendTime') as string,
            sendDays: JSON.parse(formData.get('sendDays') as string || '[]'),
            dailySendLimitPerSender: parseInt(formData.get('dailySendLimitPerSender') as string),
            toEmail: formData.get('toEmail') as string || '',
            replyToEmail: formData.get('replyToEmail') as string || '',
            sendMethod: formData.get('sendMethod') as string,
            isActive: formData.get('isActive') === 'true',
            randomSend: formData.get('randomSend') === 'true',
            updatedAt: new Date(),
        };

        const attachment = formData.get('attachment') as File | null;
        if (attachment && attachment.size > 0) {
            if (attachment.size > 5 * 1024 * 1024) {
                return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 });
            }
            const buffer = Buffer.from(await attachment.arrayBuffer());
            updateData.attachments = [{
                filename: attachment.name,
                content: buffer.toString('base64'),
                contentType: attachment.type,
                note: formData.get('attachmentNote') as string || ''
            }];
        }

        const { db } = await connectToDatabase();
        const result = await db.collection('Campaigns').updateOne({ campaignId }, { $set: updateData });

        if (result.matchedCount === 0) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Campaign updated successfully' });
    } catch (error) {
        console.error('Error updating campaign:', error);
        return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 });
    }
}

/**
 * PATCH /api/campaigns?campaignId=xxx
 * Body: { action: 'reset-sent-today', value: boolean }
 *   value = true  → mark todaySent as today (prevent resend)
 *   value = false → roll todaySent back to yesterday (allow resend)
 */
export async function PATCH(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const campaignId = searchParams.get('campaignId');

        if (!campaignId) {
            return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 });
        }

        const body = await request.json();
        if (body.action !== 'reset-sent-today') {
            return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
        }

        const { db } = await connectToDatabase();

        // Compute IST date using UTC methods on a shifted timestamp (avoids double-offset on IST machines)
        const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
        const todayISTStr = nowIST.toISOString().split('T')[0]; // "YYYY-MM-DD"

        let newTodaySent: string | null;
        if (body.value === true) {
            // Mark as already sent today — sendMail will skip it
            newTodaySent = todayISTStr;
        } else {
            // Roll back to yesterday — sendMail will treat it as not yet sent today
            const yesterdayIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000);
            newTodaySent = yesterdayIST.toISOString().split('T')[0];
        }

        const result = await db.collection('Campaigns').updateOne(
            { campaignId },
            { $set: { todaySent: newTodaySent, updatedAt: new Date() } }
        );

        if (result.matchedCount === 0) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, todaySent: newTodaySent });
    } catch (error) {
        console.error('Error updating todaySent:', error);
        return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const campaignId = searchParams.get('campaignId');

        if (!campaignId) {
            return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 });
        }

        const { db } = await connectToDatabase();
        const existing = await db.collection('Campaigns').findOne({ campaignId });
        if (!existing) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

        const deleteResult = await db.collection('Campaigns').deleteOne({ campaignId });
        if (deleteResult.deletedCount === 0) {
            return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Campaign deleted successfully' });
    } catch (error) {
        console.error('Error deleting campaign:', error);
        return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 });
    }
}
