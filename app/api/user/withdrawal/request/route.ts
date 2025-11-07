import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, rateLimit } from '@/lib/auth';

// POST: create a new withdrawal request after user submits details
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;
  const { user } = auth;

  try {
    const rl = rateLimit(`withdraw:create:${user.userId}`, 5, 60_000);
    if (!rl.success) {
      return NextResponse.json({ success: false, error: 'Too many requests. Try again later.' }, { status: 429 });
    }
    const body = await req.json();
    const { amount, method, currency, details } = body || {};
    const amt = Number(amount);
    const methodStr = String(method || '').trim();
    const currencyStrRaw = String(currency || 'USD').trim();
    const currencyStr = (currencyStrRaw || 'USD').toUpperCase();
    const detailsStrRaw = typeof details === 'string' ? details : '';
    const detailsStr = detailsStrRaw.trim().slice(0, 500);

    if (!Number.isFinite(amt) || amt <= 0 || amt > 1_000_000 || methodStr.length === 0) {
      return NextResponse.json({ success: false, error: 'Invalid amount or method' }, { status: 400 });
    }
    const record = await (db as any).withdrawalRequest.create({
      data: {
        userId: user.userId,
        amount: amt,
        method: methodStr,
        currency: currencyStr,
        details: detailsStr,
        status: 'PENDING',
      },
    });
    return NextResponse.json({ success: true, requestId: record.id, status: record.status }, { status: 201 });
  } catch (err: any) {
    console.error('Create withdrawal request failed', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// GET: list current user withdrawal requests (latest first)
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;
  const { user } = auth;

  try {
    const records = await (db as any).withdrawalRequest.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return NextResponse.json({ success: true, requests: records }, { status: 200 });
  } catch (err: any) {
    console.error('List withdrawal requests failed', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
