import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { validateBroadcastPayload } from '@/lib/scheduleValidation';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { db } = await connectToDatabase();
        const broadcast = await db.collection('Broadcasts').findOne({ broadcastId: id });
        if (!broadcast) return NextResponse.json({ success: false, error: 'Broadcast not found' }, { status: 404 });
        return NextResponse.json({ success: true, broadcast });
    } catch {
        return NextResponse.json({ success: false, error: 'Failed to fetch broadcast' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
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

        const updateData: Record<string, unknown> = {
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
            updatedAt: new Date(),
        };

        const attachment = formData.get('attachment') as File | null;
        if (attachment && attachment.size > 0) {
            const buffer = Buffer.from(await attachment.arrayBuffer());
            updateData.attachments = [{
                filename: attachment.name,
                content: buffer.toString('base64'),
                contentType: attachment.type,
                note: formData.get('attachmentNote') as string || '',
            }];
        }

        const { db } = await connectToDatabase();
        const result = await db.collection('Broadcasts').updateOne({ broadcastId: id }, { $set: updateData });
        if (result.matchedCount === 0) return NextResponse.json({ success: false, error: 'Broadcast not found' }, { status: 404 });
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ success: false, error: 'Failed to update broadcast' }, { status: 500 });
    }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { db } = await connectToDatabase();
        const result = await db.collection('Broadcasts').deleteOne({ broadcastId: id });
        if (result.deletedCount === 0) return NextResponse.json({ success: false, error: 'Broadcast not found' }, { status: 404 });
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ success: false, error: 'Failed to delete broadcast' }, { status: 500 });
    }
}
