import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { signAuthToken } from '@/lib/jwt';
import bcrypt from 'bcryptjs';

const isBcryptHash = (value: string) => /^\$2[aby]\$\d{2}\$/.test(value);

const passwordMatches = async (storedPassword: string | undefined, providedPassword: string) => {
    if (!storedPassword) return false;

    if (isBcryptHash(storedPassword)) {
        return bcrypt.compare(providedPassword, storedPassword);
    }

    return storedPassword === providedPassword;
};

export async function POST(request: NextRequest) {
    try {
        const { username, password } = await request.json();

        if (!username || !password) {
            return NextResponse.json(
                { success: false, error: 'Username and password are required' },
                { status: 400 }
            );
        }

        const { db } = await connectToDatabase();

        // Check Admin collection first, then fall back to other collections if needed
        let admin = await db.collection('Admin').findOne({ username });

        if (!admin || !(await passwordMatches(admin.password, password))) {
            admin = await db.collection('AuthUsers').findOne({ username, role: 'admin' });
            if (!admin || !(await passwordMatches(admin.password, password))) {
                admin = await db.collection('EmailAdmin').findOne({ username });
                if (!admin || !(await passwordMatches(admin.password, password))) {
                    admin = null;
                }
            }
        }

        if (admin) {
            const token = signAuthToken(
                {
                    sub: admin._id.toString(),
                    email: admin.email || '',
                    name: admin.username,
                    role: 'admin'
                },
                '1d'
            );

            return NextResponse.json({
                success: true,
                message: 'Login successful',
                token,
                admin: {
                    id: admin._id,
                    username: admin.username,
                    email: admin.email || null,
                    role: admin.role || 'admin'
                }
            });
        } else {
            return NextResponse.json(
                { success: false, error: 'Invalid username or password' },
                { status: 401 }
            );
        }
    } catch (error) {
        console.error('Error during admin login:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}