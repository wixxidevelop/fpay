import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rateLimit } from '@/lib/auth';
import { sendResetPasswordEmail } from '@/lib/email';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3006';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 });
    }
    const rl = rateLimit(`password_reset:${email}`, 3, 15 * 60_000);
    if (!rl.success) {
      return NextResponse.json({ success: false, error: 'Too many requests. Try again later.' }, { status: 429 });
    }

    const user = await db.user.findUnique({ where: { email }, select: { id: true, email: true, username: true } });
    // Always respond success to avoid user enumeration
    if (!user) {
      return NextResponse.json({ success: true, message: 'If the email exists, a reset link has been sent.' }, { status: 200 });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30m' });
    const resetUrl = `${FRONTEND_URL}/auth/reset-password?token=${encodeURIComponent(token)}`;
    await sendResetPasswordEmail(user.email, { username: user.username || user.email, resetUrl }, 'light');

    return NextResponse.json({ success: true, message: 'Reset link sent' }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Internal server error' }, { status: 500 });
  }
}