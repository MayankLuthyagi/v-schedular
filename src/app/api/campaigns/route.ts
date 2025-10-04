import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();

        // Extract form data
        const campaignData: any = {
            campaignId: uuidv4(),
            campaignName: formData.get('campaignName') as string,
            emailSubject: formData.get('emailSubject') as string,
            emailBody: formData.get('emailBody') as string,
            commaId: JSON.parse(formData.get('commaId') as string || '[]'),
            startDate: formData.get('startDate') as string,
            endDate: formData.get('endDate') as string,
            sendTime: formData.get('sendTime') as string,
            sendDays: JSON.parse(formData.get('sendDays') as string || '[]'),
            dailySendLimitPerSender: parseInt(formData.get('dailySendLimitPerSender') as string),
            toEmail: formData.get('toEmail') as string || '',
            sendMethod: formData.get('sendMethod') as string,
            sheetId: formData.get('sheetId') as string,
            isActive: formData.get('isActive') === 'true',
            todaySent: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const attachment = formData.get('attachment') as File | null;
        if (attachment && attachment.size > 0) {
            // Check file size limit (1MB)
            const maxSize = 1 * 1024 * 1024; // 1 MB in bytes
            if (attachment.size > maxSize) {
                return NextResponse.json(
                    { error: 'File size must be less than 1MB' },
                    { status: 400 }
                );
            }

            // Convert file to base64 for storage in MongoDB
            const buffer = Buffer.from(await attachment.arrayBuffer());
            const base64Content = buffer.toString('base64');

            // Add attachment data to campaign
            campaignData.attachments = [{
                filename: attachment.name,
                content: base64Content,
                contentType: attachment.type,
                note: formData.get('attachmentNote') as string || ''
            }];
        } else {
            campaignData.attachments = [];
        }

        const { db } = await connectToDatabase();
        const result = await db.collection('Campaigns').insertOne(campaignData);

        return NextResponse.json({
            success: true,
            campaignId: campaignData.campaignId,
            message: 'Campaign created successfully'
        });

    } catch (error) {
        console.error('Error creating campaign:', error);
        return NextResponse.json(
            { error: 'Failed to create campaign' },
            { status: 500 }
        );
    }
}


export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const campaignId = searchParams.get('campaignId');

        const { db } = await connectToDatabase();

        if (campaignId) {
            // Get specific campaign by ID
            const campaign = await db.collection('Campaigns').findOne({ campaignId });

            if (!campaign) {
                return NextResponse.json(
                    { error: 'Campaign not found' },
                    { status: 404 }
                );
            }

            return NextResponse.json(campaign);
        } else {
            // Get all campaigns
            const campaigns = await db.collection('Campaigns').find({}).toArray();
            return NextResponse.json(campaigns);
        }
    } catch (error) {
        console.error('Error fetching campaigns:', error);
        return NextResponse.json(
            { error: 'Failed to fetch campaigns' },
            { status: 500 }
        );
    }
}

export async function PUT(request: NextRequest) {
    try {
        const formData = await request.formData();
        const campaignId = formData.get('campaignId') as string;

        if (!campaignId) {
            return NextResponse.json(
                { error: 'Campaign ID is required' },
                { status: 400 }
            );
        }

        // Extract form data for update
        const updateData: any = {
            campaignName: formData.get('campaignName') as string,
            emailSubject: formData.get('emailSubject') as string,
            emailBody: formData.get('emailBody') as string,
            commaId: JSON.parse(formData.get('commaId') as string || '[]'),
            startDate: formData.get('startDate') as string,
            endDate: formData.get('endDate') as string,
            sendTime: formData.get('sendTime') as string,
            sendDays: JSON.parse(formData.get('sendDays') as string || '[]'),
            dailySendLimitPerSender: parseInt(formData.get('dailySendLimitPerSender') as string),
            toEmail: formData.get('toEmail') as string || '',
            sendMethod: formData.get('sendMethod') as string,
            sheetId: formData.get('sheetId') as string,
            isActive: formData.get('isActive') === 'true',
            updatedAt: new Date(),
        };

        // Handle file attachment if present
        const attachment = formData.get('attachment') as File | null;
        if (attachment && attachment.size > 0) {
            // Check file size limit (5MB)
            const maxSize = 5 * 1024 * 1024; // 5MB in bytes
            if (attachment.size > maxSize) {
                return NextResponse.json(
                    { error: 'File size must be less than 5MB' },
                    { status: 400 }
                );
            }

            // Convert file to base64 for storage in MongoDB
            const buffer = Buffer.from(await attachment.arrayBuffer());
            const base64Content = buffer.toString('base64');

            // Add attachment data to update
            updateData.attachments = [{
                filename: attachment.name,
                content: base64Content,
                contentType: attachment.type,
                note: formData.get('attachmentNote') as string || ''
            }];
        }

        const { db } = await connectToDatabase();
        const result = await db.collection('Campaigns').updateOne(
            { campaignId },
            { $set: updateData }
        );

        if (result.matchedCount === 0) {
            return NextResponse.json(
                { error: 'Campaign not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Campaign updated successfully'
        });

    } catch (error) {
        console.error('Error updating campaign:', error);
        return NextResponse.json(
            { error: 'Failed to update campaign' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const campaignId = searchParams.get('campaignId');

        if (!campaignId) {
            return NextResponse.json(
                { error: 'Campaign ID is required' },
                { status: 400 }
            );
        }

        const { db } = await connectToDatabase();
        const result = await db.collection('Campaigns').findOne({ campaignId });

        if (!result) {
            return NextResponse.json(
                { error: 'Campaign not found' },
                { status: 404 }
            );
        }

        // Actually delete the campaign from the database (attachments are stored in MongoDB)
        const deleteResult = await db.collection('Campaigns').deleteOne({ campaignId });

        if (deleteResult.deletedCount === 0) {
            return NextResponse.json(
                { error: 'Failed to delete campaign from database' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Campaign deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting campaign:', error);
        return NextResponse.json(
            { error: 'Failed to delete campaign' },
            { status: 500 }
        );
    }
}