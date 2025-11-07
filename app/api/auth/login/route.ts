import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, generateTokens, setAuthCookies, rateLimit } from '@/lib/auth';
import { userLoginSchema } from '@/lib/validations';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    if (!rateLimit(`login:${clientIP}`, 10, 15 * 60 * 1000)) { // 10 requests per 15 minutes
      return NextResponse.json(
        { success: false, error: 'Too many login attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    console.log(body)
    
    // Validate request body
    const validation = userLoginSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Validation failed', 
          details: validation.error.issues 
        },
        { status: 400 }
      );
    }

    const { emailOrUsername, password } = validation.data;

    // Find user by email or username
    const user = await db.user.findFirst({
      where: {
        OR: [
          { email: emailOrUsername },
          { username: emailOrUsername }
        ]
      },
      select: {
        id: true,
        username: true,
        email: true,
        passwordHash: true,
        firstName: true,
        lastName: true,
        bio: true,
        isAdmin: true,
        isVerified: true,
        avatar: true,
        walletAddress: true,
        createdAt: true,
      }
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Remove password from user object
    const { passwordHash: _, ...userWithoutPassword } = user;

    // Generate tokens
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      username: user.username,
      isAdmin: user.isAdmin,
    });

    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
      user: userWithoutPassword,
      tokens: tokens
    });

    // Set authentication cookies
    setAuthCookies(response, tokens, userWithoutPassword);

    return response;

  } catch (error: any) {
    console.error('Login error:', error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
