import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rateLimit } from '@/lib/auth';
import jwt from 'jsonwebtoken';
import { sendEmail } from '@/lib/email';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3006';

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest) {
  const now = new Date();
  try {
    const { email, context } = await req.json();
    const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? undefined;
    const ua = req.headers.get('user-agent') ?? undefined;

    if (!email || typeof email !== 'string' || !isValidEmail(email)) {
      return NextResponse.json({ success: false, error: 'Invalid email format' }, { status: 400 });
    }

    const rlKey = `verifyEmail:${email}:${ip ?? 'unknown'}`;
    const rl = rateLimit(rlKey, 5, 15 * 60_000);
    if (!rl.success) {
      // skip audit log for now; model missing in schema
      return NextResponse.json({ success: false, error: 'Too many requests. Try again later.' }, { status: 429 });
    }

    let user: { id: string; email: string; username: string | null } | null = null;
    try {
      user = await db.user.findUnique({ where: { email }, select: { id: true, email: true, username: true } });
    } catch (dbErr: any) {
      // skip audit log for now; model missing in schema
      return NextResponse.json({ success: false, error: 'Service temporarily unavailable' }, { status: 503 });
    }

    // Security: public context does not reveal existence; private/admin can
    const isPrivate = context === 'private';

    if (!user) {
      await (db as any).emailVerificationAttempt.create({ data: { email, ip: ip ?? null, userAgent: ua ?? null, outcome: 'UNKNOWN', reason: 'not_found' } });
      if (isPrivate) {
        return NextResponse.json({ success: false, error: 'Email not registered', guidance: 'Please register an account or check for typos.' }, { status: 404 });
      }
      return NextResponse.json({ success: true, message: 'If this email is registered, a message has been sent.' }, { status: 200 });
    }

    // Build verification token and link
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30m' });
    const verifyUrl = `${FRONTEND_URL}/auth/verify-email?token=${encodeURIComponent(token)}`;

    // Minimal verification email using existing sender
    const html = `Please verify your email by clicking <a href="${verifyUrl}">this link</a>. If you did not request this, ignore this message.`;
    const ok = await sendEmail({ to: user.email, subject: 'Verify your email', html, text: `Verify your email: ${verifyUrl}` });
    if (!ok) {
      await (db as any).emailVerificationAttempt.create({ data: { email, ip: ip ?? null, userAgent: ua ?? null, outcome: 'ERROR', reason: 'email_failed' } });
      return NextResponse.json({ success: false, error: 'Failed to send email. Please try again later.' }, { status: 502 });
    }

    await (db as any).emailVerificationAttempt.create({ data: { email, ip: ip ?? null, userAgent: ua ?? null, outcome: 'SENT', reason: 'ok' } });
    return NextResponse.json({ success: true, message: 'Verification email sent', sentAt: now.toISOString(), eta: '1-5 minutes' }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
