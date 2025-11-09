import { NextRequest, NextResponse } from 'next/server';
import { db, handleDatabaseError } from '@/lib/db';
import { requireAuth, validateUserOwnership } from '@/lib/auth';
import { userUpdateSchema } from '@/lib/validations';

// GET /api/users/[id] - Get user profile
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        bio: true,
        walletAddress: true,
        preferredCurrency: true,
        isVerified: true,
        createdAt: true,
        _count: {
          select: {
            ownedNFTs: true,
            nfts: true,
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

    // Get additional statistics
    const [
      salesVolume,
      purchaseVolume,
      walletCredits,
      walletDebits,
      recentNFTs,
      recentCollections,
      recentActivity
    ] = await Promise.all([
      // Sales volume
      db.transaction.aggregate({
        where: {
          userId: user.id,
          type: 'SALE',
        },
        _sum: {
          amount: true,
        }
      }),
      
      // Purchase volume
      db.transaction.aggregate({
        where: {
          userId: user.id,
          type: 'PURCHASE',
        },
        _sum: {
          amount: true,
        }
      }),

      // Wallet credits (DEPOSIT)
      db.transaction.aggregate({
        where: {
          userId: user.id,
          type: 'DEPOSIT',
        },
        _sum: {
          amount: true,
        }
      }),

      // Wallet debits (WITHDRAWAL + MINT)
      db.transaction.aggregate({
        where: {
          userId: user.id,
          type: { in: ['WITHDRAWAL', 'MINT'] },
        },
        _sum: {
          amount: true,
        }
      }),

      // Recent NFTs
      db.nFT.findMany({
        where: { ownerId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          name: true,
          image: true,
          price: true,
          tokenId: true,
        }
      }),

      // Recent Collections
      db.collection.findMany({
        where: { creatorId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: {
          id: true,
          name: true,
          description: true,
          image: true,
          _count: {
            select: {
              nfts: true,
            }
          }
        }
      }),

      // Recent Activity
      db.transaction.findMany({
        where: {
          userId: user.id
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          nft: {
            select: {
              id: true,
              name: true,
              image: true,
              tokenId: true,
            }
          },
          user: {
            select: {
              id: true,
              username: true,
            }
          }
        }
      })
    ]);

    const userProfile = {
      ...user,
      stats: {
        totalNFTs: user._count.ownedNFTs,
        createdNFTs: user._count.nfts,
        collections: user._count.collections,
        totalBids: user._count.bids,
        totalTransactions: user._count.transactions,
        totalAuctions: user._count.auctions,
        salesVolume: salesVolume._sum.amount || 0,
        purchaseVolume: purchaseVolume._sum.amount || 0,
        totalEarnings: (salesVolume._sum.amount || 0) - (purchaseVolume._sum.amount || 0),
        walletBalance: (walletCredits._sum.amount || 0) - (walletDebits._sum.amount || 0),
      },
      recentNFTs,
      recentCollections,
      recentActivity,
    };

    // Remove _count from response
    const { _count, ...finalProfile } = userProfile;

    return NextResponse.json({
      success: true,
      user: finalProfile,
    });

  } catch (error: any) {
    console.error('Get user profile error:', error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/users/[id] - Update user profile
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication
    const authResult = await requireAuth(request);
    if ('error' in authResult) {
      return authResult.error;
    }

    const { user: currentUser } = authResult;
    const { id } = await params;
    const body = await request.json();

    // Validate ownership (users can only update their own profile, admins can update any)
    if (!currentUser.isAdmin && currentUser.userId !== id) {
      return NextResponse.json(
        { success: false, error: 'You can only update your own profile' },
        { status: 403 }
      );
    }

    // Validate request body
    const validation = userUpdateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Validation failed', 
          details: validation.error.issues 
        },
        { status: 400 }
      );
    }

    const updateData = validation.data;

    // Enforce admin-only on sensitive flags
    if ((updateData as any).isVerified !== undefined || (updateData as any).isSuspended !== undefined) {
      if (!currentUser.isAdmin) {
        return NextResponse.json(
          { success: false, error: 'Admin privileges required to update verification/suspension' },
          { status: 403 }
        );
      }
    }

    // Check if user exists
    const existingUser = await db.user.findUnique({
      where: { id },
      select: { id: true, username: true, email: true }
    });

    if (!existingUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Check for username uniqueness if updating username
    if (updateData.username && updateData.username !== existingUser.username) {
      const usernameExists = await db.user.findUnique({
        where: { username: updateData.username },
        select: { id: true }
      });

      if (usernameExists) {
        return NextResponse.json(
          { success: false, error: 'Username already taken' },
          { status: 400 }
        );
      }
    }

    // Check for email uniqueness if updating email
    if (updateData.email && updateData.email !== existingUser.email) {
      const emailExists = await db.user.findUnique({
        where: { email: updateData.email },
        select: { id: true }
      });

      if (emailExists) {
        return NextResponse.json(
          { success: false, error: 'Email already taken' },
          { status: 400 }
        );
      }
    }

    // Update user
    const updatedUser = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        bio: true,
        walletAddress: true,
        preferredCurrency: true,
        isVerified: true,
        isSuspended: true,
        updatedAt: true,
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser,
    });

  } catch (error: any) {
    console.error('Update user profile error:', error);
    
    // Handle database errors
    if (error.code?.startsWith('P')) {
      const dbError = handleDatabaseError(error);
      return NextResponse.json(dbError, { status: 400 });
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
