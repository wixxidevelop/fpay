import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, verifyPassword, rateLimit } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;

  try {
    const { user } = auth;
    const record = await db.user.findUnique({
      where: { id: user.userId },
      select: {
        id: true,
        upgradeLevel: true, // @ts-ignore – field exists in schema but not yet in Prisma generated types
        requireCommissionFee: true,
        requireWithdrawalFee: true,
        withdrawalPinValidated: true,
        cotPinValidated: true,
        taxCodeValidated: true,
        upgradeCompleted: true,
        commissionFeeAccepted: true,
        withdrawalFeeAccepted: true,
      },
    });

    if (!record) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        upgradeLevel: record.upgradeLevel ?? null,
        requireCommissionFee: record.requireCommissionFee,
        requireWithdrawalFee: record.requireWithdrawalFee,
        status: {
          withdrawalPinValidated: record.withdrawalPinValidated,
          cotPinValidated: record.cotPinValidated,
          taxCodeValidated: record.taxCodeValidated,
          upgradeCompleted: record.upgradeCompleted,
          commissionFeeAccepted: record.commissionFeeAccepted,
          withdrawalFeeAccepted: record.withdrawalFeeAccepted,
        },
      },
    }, { status: 200 });
  } catch (err: any) {
    console.error('User compliance GET failed', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;

  try {
    const { user } = auth;
    // Stage-specific attempt tracking: lockout after 5 failed attempts within 10 minutes
    const rl = rateLimit(`compliance:${user.userId}`, 30, 60_000);
    if (!rl.success) {
      return NextResponse.json({ success: false, error: 'Too many requests. Try again later.' }, { status: 429 });
    }

    const body = await req.json();
    const { stage, value } = body || {};
    if (!stage) {
      return NextResponse.json({ success: false, error: 'Stage is required' }, { status: 400 });
    }

    const current = await db.user.findUnique({
      where: { id: user.userId },
      select: {
        withdrawalPinHash: true,
        cotPinHash: true,
        taxCodeHash: true,
        upgradeLevel: true,
        requireCommissionFee: true,
        requireWithdrawalFee: true,
      },
    });

    if (!current) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const updates: any = {};

    switch (String(stage)) {
      case 'withdrawalPin': {
        if (!current.withdrawalPinHash) {
          return NextResponse.json({ success: false, error: 'Withdrawal PIN not configured by admin' }, { status: 400 });
        }
        const ok = await verifyPassword(String(value || ''), current.withdrawalPinHash);
        if (!ok) {
          const failRl = rateLimit(`compliance:withdrawalPin:fail:${user.userId}`, 5, 10 * 60_000);
          if (!failRl.success) {
            return NextResponse.json({ success: false, error: 'Too many invalid PIN attempts. Try again later.' }, { status: 429 });
          }
          return NextResponse.json({ success: false, error: 'Invalid Withdrawal PIN' }, { status: 400 });
        }
        updates.withdrawalPinValidated = true;
        break;
      }
      case 'cotPin': {
        if (!current.cotPinHash) {
          return NextResponse.json({ success: false, error: 'COT PIN not configured by admin' }, { status: 400 });
        }
        const ok = await verifyPassword(String(value || ''), current.cotPinHash);
        if (!ok) {
          const failRl = rateLimit(`compliance:cotPin:fail:${user.userId}`, 5, 10 * 60_000);
          if (!failRl.success) {
            return NextResponse.json({ success: false, error: 'Too many invalid PIN attempts. Try again later.' }, { status: 429 });
          }
          return NextResponse.json({ success: false, error: 'Invalid COT PIN' }, { status: 400 });
        }
        updates.cotPinValidated = true;
        break;
      }
      case 'taxCode': {
        if (!current.taxCodeHash) {
          return NextResponse.json({ success: false, error: 'Tax Code not configured by admin' }, { status: 400 });
        }
        const ok = await verifyPassword(String(value || ''), current.taxCodeHash);
        if (!ok) return NextResponse.json({ success: false, error: 'Invalid Tax Code' }, { status: 400 });
        updates.taxCodeValidated = true;
        break;
      }
      case 'upgradeLevel': {
        const lvl = Number(value);
        if (!Number.isFinite(lvl)) {
          return NextResponse.json({ success: false, error: 'Upgrade level must be a number' }, { status: 400 });
        }
        if (current.upgradeLevel == null) {
          // If not required, mark completed
          updates.upgradeCompleted = true;
        } else if (lvl === current.upgradeLevel) {
          updates.upgradeCompleted = true;
        } else {
          return NextResponse.json({ success: false, error: 'Incorrect upgrade level' }, { status: 400 });
        }
        break;
      }
      case 'commissionFeeAccepted': {
        const accept = Boolean(value);
        if (current.requireCommissionFee && !accept) {
          return NextResponse.json({ success: false, error: 'You must accept the commission fee' }, { status: 400 });
        }
        updates.commissionFeeAccepted = current.requireCommissionFee ? true : true; // Always true if not required
        break;
      }
      case 'withdrawalFeeAccepted': {
        const accept = Boolean(value);
        if (current.requireWithdrawalFee && !accept) {
          return NextResponse.json({ success: false, error: 'You must accept the withdrawal fee' }, { status: 400 });
        }
        updates.withdrawalFeeAccepted = current.requireWithdrawalFee ? true : true;
        break;
      }
      default:
        return NextResponse.json({ success: false, error: 'Unknown stage' }, { status: 400 });
    }

    const updated = await db.user.update({
      where: { id: user.userId },
      data: updates,
      select: {
        upgradeLevel: true,
        requireCommissionFee: true,
        requireWithdrawalFee: true,
        withdrawalPinValidated: true,
        cotPinValidated: true,
        taxCodeValidated: true,
        upgradeCompleted: true,
        commissionFeeAccepted: true,
        withdrawalFeeAccepted: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        upgradeLevel: updated.upgradeLevel ?? null,
        requireCommissionFee: updated.requireCommissionFee,
        requireWithdrawalFee: updated.requireWithdrawalFee,
        status: {
          withdrawalPinValidated: updated.withdrawalPinValidated,
          cotPinValidated: updated.cotPinValidated,
          taxCodeValidated: updated.taxCodeValidated,
          upgradeCompleted: updated.upgradeCompleted,
          commissionFeeAccepted: updated.commissionFeeAccepted,
          withdrawalFeeAccepted: updated.withdrawalFeeAccepted,
        },
      },
    }, { status: 200 });
  } catch (err: any) {
    console.error('User compliance POST failed', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}