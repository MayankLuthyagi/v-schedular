import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { validateBroadcastPayload } from '@/lib/scheduleValidation';

export async function GET() {
    try {
        const { db } = await connectToDatabase();
        const broadcasts = await db.collection('Broadcasts').find({}).sort({ createdAt: -1 }).toArray();
        return NextResponse.json({ success: true, broadcasts });
    } catch {
        return NextResponse.json({ success: false, error: 'Failed to fetch broadcasts' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        let senderEmails: string[] = [];
        try {
            senderEmails = JSON.parse(formData.get('senderEmails') as string || '[]');
        } catch {
            return NextResponse.json({ success: false, error: 'Invalid sender email selection' }, { status: 400 });
        }

        const payload = {
            name: formData.get('name') as string,
            templateId: formData.get('templateId') as string,
            senderEmails,
            audienceId: formData.get('audienceId') as string || '',
            sendDate: formData.get('sendDate') as string,
            sendTime: formData.get('sendTime') as string,
            sendMethod: formData.get('sendMethod') as string,
            toEmail: formData.get('toEmail') as string || '',
            replyToEmail: formData.get('replyToEmail') as string || '',
            dailySendLimitPerSender: parseInt(formData.get('dailySendLimitPerSender') as string) || 0,
        };
        const validationError = validateBroadcastPayload(payload);
        if (validationError) {
            return NextResponse.json({ success: false, error: validationError }, { status: 400 });
        }

        const broadcast: Record<string, unknown> = {
            broadcastId: uuidv4(),
            name: payload.name,
            templateId: payload.templateId,
            senderEmails,
            audienceId: payload.audienceId || undefined,
            sendDate: payload.sendDate,
            sendTime: payload.sendTime,
            sendMethod: payload.sendMethod,
            toEmail: payload.toEmail,
            replyToEmail: payload.replyToEmail,
            dailySendLimitPerSender: payload.dailySendLimitPerSender,
            randomSend: formData.get('randomSend') === 'true',
            status: 'pending',
            attachments: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const attachment = formData.get('attachment') as File | null;
        if (attachment && attachment.size > 0) {
            if (attachment.size > 5 * 1024 * 1024) {
                return NextResponse.json({ success: false, error: 'File size must be less than 5MB' }, { status: 400 });
            }
            const buffer = Buffer.from(await attachment.arrayBuffer());
            broadcast.attachments = [{
                filename: attachment.name,
                content: buffer.toString('base64'),
                contentType: attachment.type,
                note: formData.get('attachmentNote') as string || '',
            }];
        }

        const { db } = await connectToDatabase();
        await db.collection('Broadcasts').insertOne(broadcast);
        return NextResponse.json({ success: true, broadcastId: broadcast.broadcastId });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}
