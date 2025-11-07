import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret';

export async function POST(req: NextRequest) {
  try {
    const { token, newPassword } = await req.json();
    if (!token || !newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return NextResponse.json({ success: false, error: 'Invalid token or password too short' }, { status: 400 });
    }
    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid or expired token' }, { status: 400 });
    }
    const user = await db.user.findUnique({ where: { id: payload.userId } });
    if (!user || user.email !== payload.email) {
      return NextResponse.json({ success: false, error: 'Invalid user' }, { status: 400 });
    }
    const hashed = await hashPassword(newPassword);
    await db.user.update({ where: { id: user.id }, data: { passwordHash: hashed } });
    return NextResponse.json({ success: true, message: 'Password updated' }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Internal server error' }, { status: 500 });
  }
}