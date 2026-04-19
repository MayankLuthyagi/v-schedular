import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { encrypt } from '@/lib/crypto';

export async function GET() {
    try {
        const { db } = await connectToDatabase();
        const emails = await db.collection('AuthEmails').find({}).toArray();

        // Never expose app_password to the client
        const safeEmails = emails.map(({ app_password: _removed, ...rest }) => rest);

        return NextResponse.json({ success: true, emails: safeEmails });
    } catch (error) {
        console.error('Error fetching emails:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch emails' },
            { status: 500 }
        );
    }
}



export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, name, main, app_password } = body;

        if (!email || !name || !main || !app_password) {
            return NextResponse.json(
                { success: false, error: 'Email, name, main, and app_password are required' },
                { status: 400 }
            );
        }

        const { db } = await connectToDatabase();

        // Check if user already exists
        const existingUser = await db.collection('AuthEmails').findOne({ email });
        if (existingUser) {
            return NextResponse.json(
                { success: false, error: 'Email already exists' },
                { status: 400 }
            );
        }

        const newEmail = {
            name,
            main,
            email,
            app_password: encrypt(app_password), // stored encrypted
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await db.collection('AuthEmails').insertOne(newEmail);

        // Return the record without the encrypted password
        const { app_password: _removed, ...safeEmail } = newEmail;
        return NextResponse.json({
            success: true,
            email: { ...safeEmail, _id: result.insertedId }
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Error creating authorized email:', message);
        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        );
    }
}

