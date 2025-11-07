import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookies } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'Logout successful',
    });

    // Clear authentication cookies
    clearAuthCookies(response);

    return response;

  } catch (error: any) {
    console.error('Logout error:', error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Also support GET for logout links
export async function GET(request: NextRequest) {
  return POST(request);
}
