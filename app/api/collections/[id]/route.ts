import { NextRequest, NextResponse } from 'next/server';
import { db, handleDatabaseError } from '@/lib/db';
import { requireAuth, validateCollectionOwnership } from '@/lib/auth';
import { collectionUpdateSchema } from '@/lib/validations';

// GET /api/collections/[id] - Get specific collection
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const collection = await db.collection.findUnique({
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
        nfts: {
          orderBy: { createdAt: 'desc' },
          take: 12,
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
            }
          }
        },
        _count: {
          select: {
            nfts: true,
          }
        }
      }
    });

    if (!collection) {
      return NextResponse.json(
        { success: false, error: 'Collection not found' },
        { status: 404 }
      );
    }

    // Calculate collection statistics
    const stats = await db.nFT.aggregate({
      where: { collectionId: id },
      _sum: { price: true },
      _min: { price: true },
      _max: { price: true },
      _avg: { price: true },
    });

    // Get transaction volume
    const volumeStats = await db.transaction.aggregate({
      where: {
        nft: { collectionId: id },
        type: 'SALE',
      },
      _sum: { amount: true },
      _count: true,
    });

    // Get owner count
    const ownerCount = await db.nFT.groupBy({
      by: ['ownerId'],
      where: { collectionId: id },
      _count: true,
    });

    const { _count, ...collectionData } = collection;

    const collectionWithStats = {
      ...collectionData,
      stats: {
        totalNFTs: _count.nfts,
        totalVolume: volumeStats._sum.amount || 0,
        totalSales: volumeStats._count || 0,
        floorPrice: stats._min.price || 0,
        ceilingPrice: stats._max.price || 0,
        averagePrice: stats._avg.price || 0,
        uniqueOwners: ownerCount.length,
      }
    };

    return NextResponse.json({
      success: true,
      collection: collectionWithStats,
    });

  } catch (error: any) {
    console.error('Get collection error:', error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/collections/[id] - Update collection
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
    const validation = collectionUpdateSchema.safeParse(body);
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

    // Check if collection exists and user has permission
    const existingCollection = await db.collection.findUnique({
      where: { id },
      select: { creatorId: true }
    });

    if (!existingCollection) {
      return NextResponse.json(
        { success: false, error: 'Collection not found' },
        { status: 404 }
      );
    }

    // Validate ownership
    const hasPermission = await validateCollectionOwnership(user.userId, id, user.isAdmin);
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to update this collection' },
        { status: 403 }
      );
    }

    const {
      name,
      description,
      image,
      isVerified,
    } = validation.data;

    // Update collection
    const updatedCollection = await db.collection.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description && { description }),
        ...(image && { image }),
        ...(isVerified !== undefined && { isVerified }),
        updatedAt: new Date(),
      },
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
        _count: {
          select: {
            nfts: true,
          }
        }
      }
    });

    // Calculate stats
    const stats = await db.nFT.aggregate({
      where: { collectionId: id },
      _sum: { price: true },
      _min: { price: true },
      _max: { price: true },
      _avg: { price: true },
    });

    const { _count, ...collectionData } = updatedCollection;

    const collectionWithStats = {
      ...collectionData,
      stats: {
        totalNFTs: _count.nfts,
        totalVolume: stats._sum.price || 0,
        floorPrice: stats._min.price || 0,
        ceilingPrice: stats._max.price || 0,
        averagePrice: stats._avg.price || 0,
      }
    };

    return NextResponse.json({
      success: true,
      message: 'Collection updated successfully',
      collection: collectionWithStats,
    });

  } catch (error: any) {
    console.error('Update collection error:', error);
    
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

// DELETE /api/collections/[id] - Delete collection
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

    // Check if collection exists and user has permission
    const existingCollection = await db.collection.findUnique({
      where: { id },
      select: { 
        creatorId: true,
        _count: {
          select: {
            nfts: true,
          }
        }
      }
    });

    if (!existingCollection) {
      return NextResponse.json(
        { success: false, error: 'Collection not found' },
        { status: 404 }
      );
    }

    // Validate ownership
    const hasPermission = await validateCollectionOwnership(user.userId, id, user.isAdmin);
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to delete this collection' },
        { status: 403 }
      );
    }

    // Check if collection has NFTs
    if (existingCollection._count.nfts > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete collection that contains NFTs' },
        { status: 400 }
      );
    }

    // Delete collection
    await db.collection.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      message: 'Collection deleted successfully',
    });

  } catch (error: any) {
    console.error('Delete collection error:', error);
    
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