import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';

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
        let admin = await db.collection('Admin').findOne({ username, password });

        // If no Admin collection, check AuthUsers collection for admin users
        if (!admin) {
            admin = await db.collection('AuthUsers').findOne({
                username,
                password,
                role: 'admin'
            });
        }

        // If still no admin found, check EmailAdmin collection
        if (!admin) {
            admin = await db.collection('EmailAdmin').findOne({ username, password });
        }

        if (admin) {
            return NextResponse.json({
                success: true,
                message: 'Login successful',
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