import { NextRequest, NextResponse } from 'next/server';
import { db, handleDatabaseError } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { stockPurchaseCreateSchema } from '@/lib/validations';
import { v4 as uuidv4 } from 'uuid';

// GET /api/stocks/purchases - List current user's stock purchases
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ('error' in auth) return auth.error;
  const { user } = auth;

  try {
    const rows = await (db as any).stockPurchase.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        symbol: true,
        amountUSD: true,
        priceUSD: true,
        shares: true,
        date: true,
        createdAt: true,
      },
    });

    // Normalize date fields to ISO strings
    const purchases = rows.map((r: any) => ({
      ...r,
      date: r.date instanceof Date ? r.date.toISOString() : r.date,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    }));

    return NextResponse.json({ success: true, purchases });
  } catch (error: any) {
    const handled = handleDatabaseError(error);
    return NextResponse.json(handled, { status: 500 });
  }
}

// POST /api/stocks/purchases - Create a new stock purchase for current user
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ('error' in auth) return auth.error;
  const { user } = auth;

  try {
    const body = await request.json();
    const validation = stockPurchaseCreateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Validation failed', details: validation.error.issues }, { status: 400 });
    }

    const { symbol, amountUSD, priceUSD, shares, date } = validation.data;

    const created = await (db as any).stockPurchase.create({
      data: {
        userId: user.userId,
        symbol,
        amountUSD,
        priceUSD,
        shares,
        date: date ? new Date(date) : undefined,
      },
      select: {
        id: true,
        userId: true,
        symbol: true,
        amountUSD: true,
        priceUSD: true,
        shares: true,
        date: true,
        createdAt: true,
      },
    });

    // Create a corresponding withdrawal transaction (debit)
    try {
      await db.transaction.create({
        data: {
          id: uuidv4(),
          type: 'WITHDRAWAL',
          userId: user.userId,
          amount: amountUSD,
          transactionHash: uuidv4(),
        },
      });
    } catch (err: any) {
      console.error('Failed to create withdrawal transaction for stock purchase:', err);
      // Continue without failing the purchase creation, but include a warning
    }

    const purchase = {
      ...created,
      date: created.date instanceof Date ? created.date.toISOString() : created.date,
      createdAt: created.createdAt instanceof Date ? created.createdAt.toISOString() : created.createdAt,
    };

    return NextResponse.json({ success: true, message: 'Purchase recorded', purchase }, { status: 201 });
  } catch (error: any) {
    const handled = handleDatabaseError(error);
    return NextResponse.json(handled, { status: 500 });
  }
}