import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { validateDateAutomationPayload } from '@/lib/scheduleValidation';
import type { ScheduledDate } from '@/types/dateAutomation';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { db } = await connectToDatabase();
        const automation = await db.collection('DateAutomations').findOne({ automationId: id });
        if (!automation) return NextResponse.json({ success: false, error: 'Automation not found' }, { status: 404 });
        return NextResponse.json({ success: true, automation });
    } catch {
        return NextResponse.json({ success: false, error: 'Failed to fetch automation' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const formData = await request.formData();
        let senderEmails: string[] = [];
        let scheduledDates: ScheduledDate[] = [];
        try {
            senderEmails = JSON.parse(formData.get('senderEmails') as string || '[]');
            scheduledDates = JSON.parse(formData.get('scheduledDates') as string || '[]');
        } catch {
            return NextResponse.json({ success: false, error: 'Invalid sender or scheduled date selection' }, { status: 400 });
        }

        const payload = {
            name: formData.get('name') as string,
            templateId: formData.get('templateId') as string,
            senderEmails,
            audienceId: formData.get('audienceId') as string || '',
            scheduledDates,
            sendMethod: formData.get('sendMethod') as string,
            toEmail: formData.get('toEmail') as string || '',
            replyToEmail: formData.get('replyToEmail') as string || '',
            dailySendLimitPerSender: parseInt(formData.get('dailySendLimitPerSender') as string) || 0,
        };
        const validationError = validateDateAutomationPayload(payload);
        if (validationError) {
            return NextResponse.json({ success: false, error: validationError }, { status: 400 });
        }

        const updateData: Record<string, unknown> = {
            name: payload.name,
            templateId: payload.templateId,
            senderEmails,
            audienceId: payload.audienceId || undefined,
            scheduledDates,
            sendMethod: payload.sendMethod,
            toEmail: payload.toEmail,
            replyToEmail: payload.replyToEmail,
            dailySendLimitPerSender: payload.dailySendLimitPerSender,
            randomSend: formData.get('randomSend') === 'true',
            isActive: formData.get('isActive') === 'true',
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
        const result = await db.collection('DateAutomations').updateOne({ automationId: id }, { $set: updateData });
        if (result.matchedCount === 0) return NextResponse.json({ success: false, error: 'Automation not found' }, { status: 404 });
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ success: false, error: 'Failed to update automation' }, { status: 500 });
    }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { db } = await connectToDatabase();
        const result = await db.collection('DateAutomations').deleteOne({ automationId: id });
        if (result.deletedCount === 0) return NextResponse.json({ success: false, error: 'Automation not found' }, { status: 404 });
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ success: false, error: 'Failed to delete automation' }, { status: 500 });
    }
}
