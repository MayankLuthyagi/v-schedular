import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { db } = await connectToDatabase();
        const audience = await db.collection('Audiences').findOne({ audienceId: id });
        if (!audience) return NextResponse.json({ success: false, error: 'Audience not found' }, { status: 404 });
        return NextResponse.json({ success: true, audience });
    } catch {
        return NextResponse.json({ success: false, error: 'Failed to fetch audience' }, { status: 500 });
    }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { db } = await connectToDatabase();
        const result = await db.collection('Audiences').deleteOne({ audienceId: id });
        if (result.deletedCount === 0) return NextResponse.json({ success: false, error: 'Audience not found' }, { status: 404 });
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ success: false, error: 'Failed to delete audience' }, { status: 500 });
    }
}
