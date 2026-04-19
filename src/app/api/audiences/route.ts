import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
    try {
        const { db } = await connectToDatabase();
        // Return audiences without the contacts array for the list view (lightweight)
        const audiences = await db.collection('Audiences')
            .find({}, { projection: { contacts: 0 } })
            .sort({ createdAt: -1 })
            .toArray();
        return NextResponse.json({ success: true, audiences });
    } catch {
        return NextResponse.json({ success: false, error: 'Failed to fetch audiences' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, columns, contacts } = body;

        if (!name || !columns || !contacts) {
            return NextResponse.json(
                { success: false, error: 'name, columns, and contacts are required' },
                { status: 400 }
            );
        }

        if (!columns.includes('email')) {
            return NextResponse.json(
                { success: false, error: '"email" column is required in sheet headers' },
                { status: 400 }
            );
        }

        const { db } = await connectToDatabase();
        const audience = {
            audienceId: uuidv4(),
            name,
            columns,
            contacts,
            totalContacts: contacts.length,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        await db.collection('Audiences').insertOne(audience);
        const { contacts: _c, ...audienceSummary } = audience;
        return NextResponse.json({ success: true, audience: audienceSummary });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}
