import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth(request);
    if ('error' in authResult) {
      return authResult.error;
    }

    const { user: authUser } = authResult;

    // Get fresh user data from database
    const user = await db.user.findUnique({
      where: { id: authUser.userId },
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
        updatedAt: true,
        _count: {
          select: {
            nfts: true,
            ownedNFTs: true,
            collections: true,
            bids: true,
            transactions: true,
            auctions: true,
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Calculate user statistics
    const stats = {
      nftsCreated: user._count.nfts,
      nftsOwned: user._count.ownedNFTs,
      collectionsCreated: user._count.collections,
      bidsPlaced: user._count.bids,
      transactions: user._count.transactions,
      auctions: user._count.auctions,
    };

    // Remove count data and add stats
    const { _count, ...userWithoutCount } = user;

    return NextResponse.json({
      success: true,
      user: {
        ...userWithoutCount,
        stats,
      },
    });

  } catch (error: any) {
    console.error('Get current user error:', error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
