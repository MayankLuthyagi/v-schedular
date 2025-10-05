import { NextRequest, NextResponse } from 'next/server';
import { analyzeEmailOpens, cleanupFalseOpens, getOpenStatistics } from '../../../../scripts/analyzeEmailOpens';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action') || 'analyze';
        const threshold = parseInt(searchParams.get('threshold') || '10');

        switch (action) {
            case 'analyze':
                const analysis = await analyzeEmailOpens();
                return NextResponse.json({
                    success: true,
                    data: analysis,
                    message: 'Email opens analysis completed'
                });

            case 'cleanup':
                const cleanedCount = await cleanupFalseOpens(threshold);
                return NextResponse.json({
                    success: true,
                    cleanedCount,
                    message: `Cleaned up ${cleanedCount} false opens`
                });

            case 'stats':
                const stats = await getOpenStatistics();
                return NextResponse.json({
                    success: true,
                    data: stats,
                    message: 'Email statistics retrieved'
                });

            default:
                return NextResponse.json({
                    success: false,
                    message: 'Invalid action. Use: analyze, cleanup, or stats'
                }, { status: 400 });
        }

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({
            success: false,
            message: 'Internal server error',
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}