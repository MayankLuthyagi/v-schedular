import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { db } = await connectToDatabase();
        const template = await db.collection('EmailTemplates').findOne({ templateId: id });
        if (!template) return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
        return NextResponse.json({ success: true, template });
    } catch {
        return NextResponse.json({ success: false, error: 'Failed to fetch template' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { name, subject, body: emailBody } = body;

        const { db } = await connectToDatabase();
        const result = await db.collection('EmailTemplates').updateOne(
            { templateId: id },
            { $set: { name, subject, body: emailBody, updatedAt: new Date() } }
        );

        if (result.matchedCount === 0) return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ success: false, error: 'Failed to update template' }, { status: 500 });
    }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { db } = await connectToDatabase();
        const result = await db.collection('EmailTemplates').deleteOne({ templateId: id });
        if (result.deletedCount === 0) return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });

        // Cascade delete all items that reference this template
        await Promise.all([
            db.collection('Campaigns').deleteMany({ templateId: id }),
            db.collection('Broadcasts').deleteMany({ templateId: id }),
            db.collection('DateAutomations').deleteMany({ templateId: id }),
        ]);

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ success: false, error: 'Failed to delete template' }, { status: 500 });
    }
}
