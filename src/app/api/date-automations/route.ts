import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { validateDateAutomationPayload } from '@/lib/scheduleValidation';
import type { ScheduledDate } from '@/types/dateAutomation';

export async function GET() {
    try {
        const { db } = await connectToDatabase();
        const automations = await db.collection('DateAutomations').find({}).sort({ createdAt: -1 }).toArray();
        return NextResponse.json({ success: true, automations });
    } catch {
        return NextResponse.json({ success: false, error: 'Failed to fetch automations' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
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

        const automation: Record<string, unknown> = {
            automationId: uuidv4(),
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
            sentDates: [],
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
            automation.attachments = [{
                filename: attachment.name,
                content: buffer.toString('base64'),
                contentType: attachment.type,
                note: formData.get('attachmentNote') as string || '',
            }];
        }

        const { db } = await connectToDatabase();
        await db.collection('DateAutomations').insertOne(automation);
        return NextResponse.json({ success: true, automationId: automation.automationId });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}
