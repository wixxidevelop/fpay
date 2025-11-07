import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, hashPassword, encryptData, decryptData } from '@/lib/auth';

function maskCode(code?: string | null) {
  if (!code) return null;
  // Reveal last 2 characters, mask the rest
  const visible = 2;
  const maskedLen = Math.max(0, code.length - visible);
  return `${'•'.repeat(maskedLen)}${code.slice(-visible)}`;
}

// Safe decrypt: returns null on any error
function safeDecrypt(enc?: string | null) {
  if (!enc) return null;
  try {
    return decryptData(enc);
  } catch (e) {
    console.error('Decrypt failed, returning null', e);
    return null;
  }
}

// Normalize decrypted values: empty strings -> null
function normalizeCode(code?: string | null) {
  if (code === null || code === undefined) return null;
  const trimmed = String(code).trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if ('error' in admin) return admin.error;

  try {
    // Safely extract user id from context params, query, or pathname fallback
    const ctx = await params;
    const pathnameId = req.nextUrl.pathname.split('/').pop() ?? '';
    const rawId = (ctx?.id ?? req.nextUrl.searchParams.get('userId') ?? pathnameId).toString();
    const id = rawId.trim();
    if (!id) {
      return NextResponse.json({ success: false, error: 'Invalid user id' }, { status: 400 });
    }
    let user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        upgradeLevel: true,
        requireCommissionFee: true,
        requireWithdrawalFee: true,
        withdrawalPinEnc: true,
        cotPinEnc: true,
        taxCodeEnc: true,
        withdrawalPinValidated: true,
        cotPinValidated: true,
        taxCodeValidated: true,
        upgradeCompleted: true,
        commissionFeeAccepted: true,
        withdrawalFeeAccepted: true,
        // @ts-ignore Prisma client types may lag behind schema
        withdrawalPinAttempts: true,
        // @ts-ignore Prisma client types may lag behind schema
        cotPinAttempts: true,
        // @ts-ignore Prisma client types may lag behind schema
        withdrawalPinLockedUntil: true,
        // @ts-ignore Prisma client types may lag behind schema
        cotPinLockedUntil: true,
        // @ts-ignore Prisma client types may lag behind schema
        withdrawalPinLastChangedAt: true,
        // @ts-ignore Prisma client types may lag behind schema
        cotPinLastChangedAt: true,
      } as any,
    }) as any;

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // No auto-backfill in GET to avoid side effects; missing values will return as null/masked

    const withdrawalPinRaw = safeDecrypt(user.withdrawalPinEnc);
    const cotPinRaw = safeDecrypt(user.cotPinEnc);
    const taxCodeRaw = safeDecrypt(user.taxCodeEnc);

    const withdrawalPin = normalizeCode(withdrawalPinRaw);
    const cotPin = normalizeCode(cotPinRaw);
    const taxCode = normalizeCode(taxCodeRaw);

    const reveal = (req.nextUrl.searchParams.get('reveal') || '').toLowerCase() === 'true';

    return NextResponse.json({
      success: true,
      data: {
        userId: user.id,
        upgradeLevel: user.upgradeLevel ?? null,
        requireCommissionFee: user.requireCommissionFee,
        requireWithdrawalFee: user.requireWithdrawalFee,
        codes: {
          withdrawalPin,
          withdrawalPinMasked: maskCode(withdrawalPin),
          cotPin,
          cotPinMasked: maskCode(cotPin),
          taxCode,
          taxCodeMasked: maskCode(taxCode),
        },
        ...(reveal ? {
          codesPlain: {
            withdrawalPin: withdrawalPinRaw,
            cotPin: cotPinRaw,
          }
        } : {}),
        pinSecurity: {
          withdrawal: {
            attempts: (user as any).withdrawalPinAttempts ?? 0,
            lockedUntil: (user as any).withdrawalPinLockedUntil ?? null,
            lastChangedAt: (user as any).withdrawalPinLastChangedAt ?? null,
          },
          cot: {
            attempts: (user as any).cotPinAttempts ?? 0,
            lockedUntil: (user as any).cotPinLockedUntil ?? null,
            lastChangedAt: (user as any).cotPinLastChangedAt ?? null,
          },
        },
        status: {
          withdrawalPinValidated: user.withdrawalPinValidated,
          cotPinValidated: user.cotPinValidated,
          taxCodeValidated: user.taxCodeValidated,
          upgradeCompleted: user.upgradeCompleted,
          commissionFeeAccepted: user.commissionFeeAccepted,
          withdrawalFeeAccepted: user.withdrawalFeeAccepted,
        },
      },
    }, { status: 200 });
  } catch (err: any) {
    console.error('Admin get user compliance failed', err);
    const message = (err && (err.message || err.code || String(err))) || 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if ('error' in admin) return admin.error;

  try {
    // Early return moved to top - editing is disabled
    return NextResponse.json({ 
      success: false, 
      error: 'Editing compliance codes & fees is disabled (read-only).' 
    }, { status: 403 });
  } catch (err: any) {
    console.error('Admin update user compliance failed', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
