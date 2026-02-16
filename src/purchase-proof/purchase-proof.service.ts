import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ImageService } from '../shared/services/image.service';
import { ChatGateway } from '../chat/chat.gateway';

@Injectable()
export class PurchaseProofService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imageService: ImageService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  async createProof(
    offerId: string,
    userId: string,
    files: any,
    metadata: any,
  ) {
    // Validate offer
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
    });
    if (!offer) throw new NotFoundException('Offer not found');

    // Only traveler who made the offer can upload proof
    if (offer.traveler_id !== userId) {
      throw new BadRequestException(
        'Only the traveler who created the offer can upload proofs',
      );
    }

    // files: { receipt?: [file], photos?: [file,...] }
    const receipt = files?.receipt?.[0] || null;
    const photos = files?.photos || [];

    if (!receipt && photos.length === 0) {
      throw new BadRequestException(
        'At least one file (receipt or product photo) is required',
      );
    }

    // Upload images via ImageService
    const savedImages: Array<{ id: string; url: string }> = [];

    if (receipt) {
      const res = await this.imageService.uploadFile(receipt, {
        folder: 'proofs',
        object_id: offer.chat_id,
      });
      savedImages.push({ id: res.image.id, url: res.image.url });
    }

    if (photos && photos.length > 0) {
      const res = await this.imageService.uploadMultipleFiles(photos, {
        folder: 'proofs',
        object_id: offer.chat_id,
      });
      for (const img of res.images)
        savedImages.push({ id: img.id, url: img.url });
    }

    // Create PurchaseProof record
    const proof = await this.prisma.purchaseProof.create({
      data: {
        offer_id: offerId,
        uploader_id: userId,
        status: 'PENDING',
        metadata: metadata || null,
        primary_receipt_image_id: receipt ? savedImages[0].id : null,
      },
    });

    // Create ProofImage records
    for (let i = 0; i < savedImages.length; i++) {
      const img = savedImages[i];
      await this.prisma.proofImage.create({
        data: {
          proof_id: proof.id,
          image_id: img.id,
          type: i === 0 && receipt ? 'RECEIPT' : 'PRODUCT_PHOTO',
          ord: i + 1,
        },
      });
    }

    // Create a SYSTEM message in the offer chat (no push notifications here)
    if (offer.chat_id) {
      const message = await this.prisma.message.create({
        data: {
          chat_id: offer.chat_id,
          sender_id: userId,
          type: 'SYSTEM',
          content: 'Purchase proof uploaded — awaiting verification',
          data: { offerId, proofId: proof.id, metadata: metadata || null },
        },
      });

      // Update image.object_id to point to message id
      await this.prisma.image.updateMany({
        where: { id: { in: savedImages.map((s) => s.id) } },
        data: { object_id: message.id },
      });

      // Emit to chat room (no notifications)
      try {
        await this.chatGateway.sendMessageProgrammatically({
          chatId: offer.chat_id,
          senderId: userId,
          content: message.content,
          type: message.type as any,
          messageData:
            message.data &&
            typeof message.data === 'object' &&
            !Array.isArray(message.data)
              ? (message.data as Record<string, any>)
              : undefined,
        });
      } catch (err) {
        // Non-blocking if emit fails
        console.warn(
          'Failed to emit proof message to chat:',
          err?.message || err,
        );
      }
    }

    return { proofId: proof.id, images: savedImages };
  }
}
