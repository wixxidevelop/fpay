import { NextRequest, NextResponse } from 'next/server';
import { db, handleDatabaseError } from '@/lib/db';
import { requireAuth, validateNFTOwnership } from '@/lib/auth';
import { nftUpdateSchema } from '@/lib/validations';

// GET /api/nfts/[id] - Get specific NFT
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const nft = await db.nFT.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
            isVerified: true,
          }
        },
        owner: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
            isVerified: true,
          }
        },
        collection: {
          select: {
            id: true,
            name: true,
            description: true,
            image: true,
          }
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              }
            }
          }
        },
        auctions: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            bids: {
              orderBy: { amount: 'desc' },
              take: 5,
              include: {
                bidder: {
                  select: {
                    id: true,
                    username: true,
                    avatar: true,
                  }
                }
              }
            }
          }
        },
        _count: {
          select: {
            transactions: true,
          }
        }
      }
    });

    if (!nft) {
      return NextResponse.json(
        { success: false, error: 'NFT not found' },
        { status: 404 }
      );
    }

    // Get current auction if exists
    const currentAuction = nft.auctions[0] || null;

    // Calculate statistics
    const stats = {
      totalTransactions: nft._count.transactions,
      currentAuction,
    };

    // Remove internal fields
    const { _count, auctions, ...nftData } = nft;

    return NextResponse.json({
      success: true,
      nft: {
        ...nftData,
        stats,
      },
    });

  } catch (error: any) {
    console.error('Get NFT error:', error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/nfts/[id] - Update NFT
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

    const { user } = authResult;
    const { id } = await params;
    const body = await request.json();
    
    // Validate request body
    const validation = nftUpdateSchema.safeParse(body);
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

    // Check if NFT exists and user has permission
    const existingNFT = await db.nFT.findUnique({
      where: { id },
      select: { creatorId: true, ownerId: true }
    });

    if (!existingNFT) {
      return NextResponse.json(
        { success: false, error: 'NFT not found' },
        { status: 404 }
      );
    }

    // Validate ownership
    const hasPermission = await validateNFTOwnership(user.userId, id, user.isAdmin);
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to update this NFT' },
        { status: 403 }
      );
    }

    const {
      name,
      description,
      price,
      isListed,
    } = validation.data;

    // Update NFT
    const updatedNFT = await db.nFT.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description && { description }),
        ...(price !== undefined && { price }),
        ...(isListed !== undefined && { isListed }),
        updatedAt: new Date(),
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            avatar: true,
          }
        },
        owner: {
          select: {
            id: true,
            username: true,
            avatar: true,
          }
        },
        collection: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'NFT updated successfully',
      nft: updatedNFT,
    });

  } catch (error: any) {
    console.error('Update NFT error:', error);
    
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

// DELETE /api/nfts/[id] - Delete NFT
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication
    const authResult = await requireAuth(request);
    if ('error' in authResult) {
      return authResult.error;
    }

    const { user } = authResult;
    const { id } = await params;

    // Check if NFT exists and user has permission
    const existingNFT = await db.nFT.findUnique({
      where: { id },
      select: { 
        creatorId: true, 
        ownerId: true, 
        _count: {
          select: {
            transactions: true,
            auctions: true,
          }
        }
      }
    });

    if (!existingNFT) {
      return NextResponse.json(
        { success: false, error: 'NFT not found' },
        { status: 404 }
      );
    }

    // Validate ownership
    const hasPermission = await validateNFTOwnership(user.userId, id, user.isAdmin);
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to delete this NFT' },
        { status: 403 }
      );
    }

    // Check if NFT has transactions or active auctions
    if (existingNFT._count.transactions > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete NFT with transaction history' },
        { status: 400 }
      );
    }

    if (existingNFT._count.auctions > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete NFT with auction history' },
        { status: 400 }
      );
    }

    // Delete NFT
    await db.nFT.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      message: 'NFT deleted successfully',
    });

  } catch (error: any) {
    console.error('Delete NFT error:', error);
    
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