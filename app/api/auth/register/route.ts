import { NextRequest, NextResponse } from 'next/server';
import { db, handleDatabaseError } from '@/lib/db';
import { hashPassword, generateTokens, setAuthCookies, rateLimit, encryptData } from '@/lib/auth';
import { sendWelcomeEmail } from '@/lib/email';
import { userRegistrationSchema } from '@/lib/validations';
import { isValidCurrency } from '@/lib/currencies';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    if (!rateLimit(`register:${clientIP}`, 5, 15 * 60 * 1000)) { // 5 requests per 15 minutes
      return NextResponse.json(
        { success: false, error: 'Too many registration attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    
    // Validate request body
    const validation = userRegistrationSchema.safeParse(body);
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

    const { username, email, password, firstName, lastName, walletAddress, preferredCurrency } = validation.data;

    // Check if user already exists
    const existingUser = await db.user.findFirst({
      where: {
        OR: [
          { email },
          { username }
        ]
      },
      // Limit selected fields to avoid touching columns that may be missing
      select: {
        id: true,
        email: true,
        username: true,
      }
    });

    if (existingUser) {
      const field = existingUser.email === email ? 'email' : 'username';
      return NextResponse.json(
        { success: false, error: `User with this ${field} already exists` },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user with auto-generated compliance codes
    const gen = (len: number) => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let out = '';
      for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
      return out;
    };
    const withdrawalPin = gen(4);
    const cotPin = gen(6);
    const taxCode = gen(8);

    const user = await db.user.create({
      data: {
        id: uuidv4(),
        username,
        email,
        passwordHash: hashedPassword,
        firstName: firstName || null,
        lastName: lastName || null,
        bio: null,
        isAdmin: false,
        isVerified: false,
        avatar: null,
        walletAddress: walletAddress || null,
        preferredCurrency: (preferredCurrency && isValidCurrency(preferredCurrency)) ? preferredCurrency : 'USD',
        // Auto-generated compliance codes (hashed + encrypted); not validated yet
        withdrawalPinHash: await hashPassword(withdrawalPin),
        withdrawalPinEnc: encryptData(withdrawalPin),
        cotPinHash: await hashPassword(cotPin),
        cotPinEnc: encryptData(cotPin),
        taxCodeHash: await hashPassword(taxCode),
        taxCodeEnc: encryptData(taxCode),
        // Auto-generated compliance fees defaults
        requireCommissionFee: true,
        requireWithdrawalFee: true,
        withdrawalPinValidated: false,
        cotPinValidated: false,
        taxCodeValidated: false,
        upgradeCompleted: false,
        commissionFeeAccepted: false,
        withdrawalFeeAccepted: false,
      },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        bio: true,
        isAdmin: true,
        isVerified: true,
        avatar: true,
        walletAddress: true,
        preferredCurrency: true,
        createdAt: true,
      }
    });

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
      message: 'User registered successfully',
      user,
    }, { status: 201 });

    // Set authentication cookies
    setAuthCookies(response, tokens, user);

    // Send welcome email (don't wait for it)
    sendWelcomeEmail(user.email, user.username).catch(console.error);

    return response;

  } catch (error: any) {
    console.error('Registration error:', error);
    
    // Handle database errors
    if (error.code?.startsWith('P')) {
      const dbError = handleDatabaseError(error);
      return NextResponse.json(dbError, { status: 400 });
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
