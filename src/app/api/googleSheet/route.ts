import { NextRequest, NextResponse } from 'next/server';
import { google } from "googleapis";
import "dotenv/config";
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const sheetId = searchParams.get('sheetId');
        const sheetName = searchParams.get('sheetName');

        // Validate required parameters
        if (!sheetId || !sheetName) {
            return NextResponse.json(
                { error: 'Missing required parameters: sheetId and sheetName' },
                { status: 400 }
            );
        }

        // --- Google Sheets setup ---
        const oauth2Client = new google.auth.OAuth2(
            process.env.CLIENT_ID,
            process.env.CLIENT_SECRET,
            process.env.REDIRECT_URI
        );
        oauth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });
        const sheets = google.sheets({ version: "v4", auth: oauth2Client });

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: sheetName,
        });

        const rows = response.data.values || [];

        return NextResponse.json({
            rowCount: rows.length,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching Google Sheets data:', error);
        return NextResponse.json(
            { error: 'Failed to fetch Google Sheets data' },
            { status: 500 }
        );
    }
}
