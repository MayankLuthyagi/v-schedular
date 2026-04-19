import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { signAuthToken } from '@/lib/jwt';

export async function POST(request: NextRequest) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json(
                { success: false, error: 'Email and password are required' },
                { status: 400 }
            );
        }

        const { db } = await connectToDatabase();

        const user = await db.collection('AuthUsers').findOne({ email, password });

        if (!user) {
            return NextResponse.json(
                { success: false, error: 'Invalid email or password' },
                { status: 401 }
            );
        }

        const token = signAuthToken(
            {
                sub: user._id.toString(),
                email: user.email,
                name: user.name,
                role: 'user',
            },
            '1d'
        );

        return NextResponse.json({
            success: true,
            token,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                role: 'user',
            },
        });
    } catch (error) {
        console.error('Error during user login:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
