import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, verifyPassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;
  const { user } = auth;

  try {
    const body = await req.json();
    const value = String(body?.value || '').trim();
    const u = await db.user.findUnique({
      where: { id: user.userId },
      select: {
        id: true,
        cotPinHash: true,
        // @ts-ignore field exists in schema
        cotPinLockedUntil: true,
        // @ts-ignore field exists in schema
        cotPinAttempts: true,
      } as any,
    });

    if (!u || !u.cotPinHash) {
      return NextResponse.json({ success: false, error: 'COT PIN not configured' }, { status: 400 });
    }

    const lockedUntil = (u as any).cotPinLockedUntil
      ? new Date((u as any).cotPinLockedUntil)
      : null;
    if (lockedUntil && lockedUntil.getTime() > Date.now()) {
      return NextResponse.json({ success: false, error: 'Too many attempts. Try again later.' }, { status: 429 });
    }

    const ok = await verifyPassword(value, String(u.cotPinHash));
    if (!ok) {
      const attempts = (Number((u as any).cotPinAttempts) || 0) + 1;
      const lockUntil = attempts >= 5 ? new Date(Date.now() + 10 * 60_000) : null;
      await db.user.update({
        where: { id: user.userId },
        data: {
          // @ts-ignore field exists in schema
          cotPinAttempts: attempts,
          // @ts-ignore field exists in schema
          cotPinLockedUntil: lockUntil,
        } as any,
      });
      return NextResponse.json(
        {
          success: false,
          error:
            attempts >= 5
              ? 'Too many attempts. Locked for 10 minutes.'
              : 'Invalid COT PIN',
        },
        { status: attempts >= 5 ? 429 : 400 },
      );
    }

    await db.user.update({
      where: { id: user.userId },
      data: {
        // @ts-ignore field exists in schema
        cotPinAttempts: 0,
        // @ts-ignore field exists in schema
        cotPinLockedUntil: null,
        cotPinValidated: true,
      } as any,
    });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error('Verify COT PIN failed', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
