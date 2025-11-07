import { NextRequest, NextResponse } from 'next/server';
import { db, handleDatabaseError } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

// POST /api/stocks/purchases/claim - Claim accrued profit for current user's stock purchases
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ('error' in auth) return auth.error;
  const { user } = auth;

  try {
    // Ensure user exists to avoid foreign key errors on transaction creation
    const userRecord = await db.user.findUnique({
      where: { id: user.userId },
      select: { id: true }
    });

    if (!userRecord) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const now = new Date();
    const purchases = await db.stockPurchase.findMany({

      where: { userId: user.userId },
      select: { id: true, amountUSD: true, lastProfitClaimAt: true }
    });

    let totalProfit = 0;
    const updates: { id: string }[] = [];

    for (const p of purchases) {
      const last = p.lastProfitClaimAt instanceof Date ? p.lastProfitClaimAt : new Date(p.lastProfitClaimAt);
      const hours = Math.max(0, (now.getTime() - last.getTime()) / 3600000);
      const profit = Number(p.amountUSD || 0) * 0.10 * hours; // 10% per hour
      if (profit > 0) {
        totalProfit += profit;
        updates.push({ id: p.id });
      }
    }

    if (totalProfit <= 0) {
      return NextResponse.json({ success: true, message: 'No profit to claim yet', claimedUSD: 0 });
    }

    // Perform deposit and updates within a single interactive transaction
    const rounded = Number(totalProfit.toFixed(2));
    await db.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          id: uuidv4(),
          type: 'DEPOSIT',
          userId: user.userId,
          amount: rounded,
          transactionHash: uuidv4(),
        }
      });

      // Update each claimed purchase timestamp
      for (const u of updates) {
        await tx.stockPurchase.update({

          where: { id: u.id },
          data: { lastProfitClaimAt: now }
        });
      }
    });

    return NextResponse.json({ success: true, message: 'Profit claimed', claimedUSD: totalProfit });
  } catch (error: any) {
    console.error('Claim profit error:', error);
    const handled = handleDatabaseError(error);
    return NextResponse.json(
      {
        ...handled,
        context: 'claim_profit',
        message: error?.message,
        code: (error as any)?.code,
        meta: (error as any)?.meta,
      },
      { status: 500 }
    );
  }
}