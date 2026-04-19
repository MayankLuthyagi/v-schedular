import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/jwt';

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        const role = request.nextUrl.searchParams.get('role');

        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json(
                { success: false, error: 'Missing token' },
                { status: 401 }
            );
        }

        const token = authHeader.split(' ')[1];
        const payload = verifyAuthToken(token);

        if (!payload) {
            return NextResponse.json(
                { success: false, error: 'Invalid or expired token' },
                { status: 401 }
            );
        }

        if (role && payload.role !== role) {
            return NextResponse.json(
                { success: false, error: 'Invalid token role' },
                { status: 403 }
            );
        }

        return NextResponse.json({ success: true, user: payload });
    } catch (error) {
        console.error('Error verifying token:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
