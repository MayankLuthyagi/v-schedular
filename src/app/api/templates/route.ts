import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
    try {
        const { db } = await connectToDatabase();
        const templates = await db.collection('EmailTemplates').find({}).sort({ createdAt: -1 }).toArray();
        return NextResponse.json({ success: true, templates });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to fetch templates' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, subject, body: emailBody } = body;

        if (!name || !subject || !emailBody) {
            return NextResponse.json({ success: false, error: 'name, subject, and body are required' }, { status: 400 });
        }

        const { db } = await connectToDatabase();
        const template = {
            templateId: uuidv4(),
            name,
            subject,
            body: emailBody,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        await db.collection('EmailTemplates').insertOne(template);
        return NextResponse.json({ success: true, template });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to create template' }, { status: 500 });
    }
}
