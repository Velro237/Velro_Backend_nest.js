import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ImageService } from '../shared/services/image.service';
import { I18nService } from 'nestjs-i18n';
import {
  CreateDeliveryDto,
  CreateDeliveryResponseDto,
} from './dto/create-delivery.dto';
import {
  UpdateDeliveryDto,
  UpdateDeliveryResponseDto,
} from './dto/update-delivery.dto';
import {
  UpdateDeliveryProductDto,
  UpdateDeliveryProductResponseDto,
} from './dto/update-delivery-product.dto';
import {
  GetAllDeliveriesQueryDto,
  GetAllDeliveriesResponseDto,
} from './dto/get-all-deliveries.dto';
import { DeleteDeliveryResponseDto } from './dto/delete-delivery.dto';
import { Currency, DeliveryStatus } from 'generated/prisma';

@Injectable()
export class DeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imageService: ImageService,
    private readonly i18n: I18nService,
  ) {}

  async createDelivery(
    createDeliveryDto: CreateDeliveryDto,
    userId: string,
    lang?: string,
  ): Promise<CreateDeliveryResponseDto> {
    try {
      const { description, expected_date, reward, products } =
        createDeliveryDto;

      // Validate expected_date is greater than today
      const expectedDate = new Date(expected_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time to start of day for comparison
      expectedDate.setHours(0, 0, 0, 0);

      if (expectedDate <= today) {
        const message = await this.i18n.translate(
          'translation.delivery.expectedDate.invalid',
          {
            lang,
            defaultValue: 'Expected date must be greater than today',
          },
        );
        throw new BadRequestException(message);
      }

      // Validate reward is at least 15
      if (reward < 15) {
        const message = await this.i18n.translate(
          'translation.delivery.reward.minimum',
          {
            lang,
            defaultValue: 'Reward cannot be less than 15',
          },
        );
        throw new BadRequestException(message);
      }

      // Validate user exists and get their currency
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, is_deleted: true, currency: true },
      });

      if (!user || user.is_deleted) {
        const message = await this.i18n.translate(
          'translation.user.notFound',
          {
            lang,
            defaultValue: 'User not found',
          },
        );
        throw new NotFoundException(message);
      }

      // Use user's currency (default to XAF if not set)
      const userCurrency = (user.currency || 'XAF').toUpperCase() as Currency;

      // Calculate total cost from sum of all product prices
      const totalCost = products.reduce((sum, product) => {
        // Convert product price to delivery currency if needed
        // For now, assuming all products are in the same currency as delivery
        // If currencies differ, you might need currency conversion here
        return sum + product.price * (product.quantity || 1);
      }, 0);

      // Create delivery and products in a transaction
      const delivery = await this.prisma.$transaction(async (prisma) => {
        // Create the delivery
        const createdDelivery = await prisma.delivery.create({
          data: {
            userId,
            total_cost: totalCost,
            currency: userCurrency,
            description: description || null,
            status: DeliveryStatus.PENDING,
            reward,
            expected_date: new Date(expected_date),
          },
        });

        // Create products and handle images
        const createdProducts = await Promise.all(
          products.map(async (product) => {
            // Validate that each image item has either image or imageUrl, not both
            if (product.images && product.images.length > 0) {
              for (const imageData of product.images) {
                if (imageData.image && imageData.imageUrl) {
                  const message = await this.i18n.translate(
                    'translation.delivery.product.image.bothProvided',
                    {
                      lang,
                      defaultValue:
                        'Cannot provide both image and imageUrl for the same image item',
                    },
                  );
                  throw new BadRequestException(message);
                }
                if (!imageData.image && !imageData.imageUrl) {
                  const message = await this.i18n.translate(
                    'translation.delivery.product.image.missing',
                    {
                      lang,
                      defaultValue:
                        'Each image item must have either image or imageUrl',
                    },
                  );
                  throw new BadRequestException(message);
                }
              }
            }

            // Create the delivery product (use user's currency)
            const createdProduct = await prisma.deliveryProduct.create({
              data: {
                deliveryId: createdDelivery.id,
                name: product.name,
                price: product.price,
                currency: userCurrency,
                description: product.description || null,
                weight: product.weight || null,
                quantity: product.quantity || null,
                url: null, // url field can be used for product URL if needed
              },
            });

            // Handle images
            const productImages: Array<{
              id: string;
              url: string;
              alt_text: string | null;
            }> = [];

            if (product.images && product.images.length > 0) {
              for (const imageData of product.images) {
                if (imageData.image) {
                  // Upload to Cloudinary using uploadImage method
                  const uploadResult = await this.imageService.uploadImage({
                    image: imageData.image,
                    folder: 'delivery-products',
                    alt_text: product.name,
                    object_id: createdProduct.id,
                  });

                  productImages.push({
                    id: uploadResult.image.id,
                    url: uploadResult.image.url,
                    alt_text: uploadResult.image.alt_text || null,
                  });
                } else if (imageData.imageUrl) {
                  // Store imageUrl directly in Image table
                  const imageRecord = await prisma.image.create({
                    data: {
                      url: imageData.imageUrl,
                      alt_text: product.name,
                      object_id: createdProduct.id,
                    },
                  });

                  productImages.push({
                    id: imageRecord.id,
                    url: imageRecord.url,
                    alt_text: imageRecord.alt_text || null,
                  });
                }
              }
            }

            return {
              id: createdProduct.id,
              name: createdProduct.name,
              price: Number(createdProduct.price),
              currency: createdProduct.currency,
              description: createdProduct.description || undefined,
              weight: createdProduct.weight
                ? Number(createdProduct.weight)
                : undefined,
              quantity: createdProduct.quantity || undefined,
              url: createdProduct.url || undefined,
              images: productImages,
            };
          }),
        );

        // Fetch the created delivery with products
        return {
          id: createdDelivery.id,
          userId: createdDelivery.userId,
          total_cost: Number(createdDelivery.total_cost),
          currency: createdDelivery.currency,
          description: createdDelivery.description,
          status: createdDelivery.status,
          reward: createdDelivery.reward,
          expected_date: createdDelivery.expected_date,
          createdAt: createdDelivery.createdAt,
          updatedAt: createdDelivery.updatedAt,
          products: createdProducts,
        };
      });

      const message = await this.i18n.translate(
        'translation.delivery.create.success',
        {
          lang,
          defaultValue: 'Delivery created successfully',
        },
      );

      return {
        message,
        delivery,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      console.error('Error creating delivery:', error);
      const message = await this.i18n.translate(
        'translation.delivery.create.failed',
        {
          lang,
          defaultValue: 'Failed to create delivery',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async updateDelivery(
    deliveryId: string,
    updateDeliveryDto: UpdateDeliveryDto,
    lang?: string,
  ): Promise<UpdateDeliveryResponseDto> {
    try {
      const { description, expected_date, reward, status } = updateDeliveryDto;

      // Check if delivery exists
      const existingDelivery = await this.prisma.delivery.findUnique({
        where: { id: deliveryId },
        select: { id: true, userId: true, is_deleted: true },
      });

      if (!existingDelivery || existingDelivery.is_deleted) {
        const message = await this.i18n.translate(
          'translation.delivery.notFound',
          {
            lang,
            defaultValue: 'Delivery not found',
          },
        );
        throw new NotFoundException(message);
      }

      // Validate expected_date if provided
      if (expected_date) {
        const expectedDate = new Date(expected_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        expectedDate.setHours(0, 0, 0, 0);

        if (expectedDate <= today) {
          const message = await this.i18n.translate(
            'translation.delivery.expectedDate.invalid',
            {
              lang,
              defaultValue: 'Expected date must be greater than today',
            },
          );
          throw new BadRequestException(message);
        }
      }

      // Validate reward if provided
      if (reward !== undefined && reward < 15) {
        const message = await this.i18n.translate(
          'translation.delivery.reward.minimum',
          {
            lang,
            defaultValue: 'Reward cannot be less than 15',
          },
        );
        throw new BadRequestException(message);
      }

      // Build update data
      const updateData: any = {};
      if (description !== undefined) updateData.description = description;
      if (expected_date !== undefined)
        updateData.expected_date = new Date(expected_date);
      if (reward !== undefined) updateData.reward = reward;
      if (status !== undefined) updateData.status = status;

      // Update delivery
      const updatedDelivery = await this.prisma.delivery.update({
        where: { id: deliveryId },
        data: updateData,
      });

      const message = await this.i18n.translate(
        'translation.delivery.update.success',
        {
          lang,
          defaultValue: 'Delivery updated successfully',
        },
      );

      return {
        message,
        delivery: {
          id: updatedDelivery.id,
          userId: updatedDelivery.userId,
          total_cost: Number(updatedDelivery.total_cost),
          currency: updatedDelivery.currency,
          description: updatedDelivery.description,
          status: updatedDelivery.status,
          reward: updatedDelivery.reward,
          expected_date: updatedDelivery.expected_date,
          createdAt: updatedDelivery.createdAt,
          updatedAt: updatedDelivery.updatedAt,
        },
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      console.error('Error updating delivery:', error);
      const message = await this.i18n.translate(
        'translation.delivery.update.failed',
        {
          lang,
          defaultValue: 'Failed to update delivery',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async updateDeliveryProduct(
    productId: string,
    updateDeliveryProductDto: UpdateDeliveryProductDto,
    lang?: string,
  ): Promise<UpdateDeliveryProductResponseDto> {
    try {
      const { name, price, description, weight, quantity, images } =
        updateDeliveryProductDto;

      // Get the delivery product with its delivery
      const existingProduct = await this.prisma.deliveryProduct.findUnique({
        where: { id: productId },
        include: {
          delivery: {
            select: {
              id: true,
              userId: true,
              currency: true,
              is_deleted: true,
            },
          },
        },
      });

      if (!existingProduct) {
        const message = await this.i18n.translate(
          'translation.delivery.product.notFound',
          {
            lang,
            defaultValue: 'Delivery product not found',
          },
        );
        throw new NotFoundException(message);
      }

      if (existingProduct.delivery.is_deleted) {
        const message = await this.i18n.translate(
          'translation.delivery.notFound',
          {
            lang,
            defaultValue: 'Delivery not found',
          },
        );
        throw new NotFoundException(message);
      }

      // Validate images if provided
      if (images && images.length > 0) {
        for (const imageData of images) {
          if (imageData.image && imageData.imageUrl) {
            const message = await this.i18n.translate(
              'translation.delivery.product.image.bothProvided',
              {
                lang,
                defaultValue:
                  'Cannot provide both image and imageUrl for the same image item',
              },
            );
            throw new BadRequestException(message);
          }
          if (!imageData.image && !imageData.imageUrl) {
            const message = await this.i18n.translate(
              'translation.delivery.product.image.missing',
              {
                lang,
                defaultValue:
                  'Each image item must have either image or imageUrl',
              },
            );
            throw new BadRequestException(message);
          }
        }
      }

      // Update delivery product and recalculate total cost in a transaction
      const result = await this.prisma.$transaction(async (prisma) => {
        // Build update data
        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (price !== undefined) updateData.price = price;
        if (description !== undefined) updateData.description = description;
        if (weight !== undefined) updateData.weight = weight;
        if (quantity !== undefined) updateData.quantity = quantity;

        // Update the product
        const updatedProduct = await prisma.deliveryProduct.update({
          where: { id: productId },
          data: updateData,
        });

        // Handle images if provided
        const productImages: Array<{
          id: string;
          url: string;
          alt_text: string | null;
        }> = [];

        if (images && images.length > 0) {
          for (const imageData of images) {
            if (imageData.image) {
              // Upload to Cloudinary using uploadImage method
              const uploadResult = await this.imageService.uploadImage({
                image: imageData.image,
                folder: 'delivery-products',
                alt_text: updatedProduct.name,
                object_id: updatedProduct.id,
              });

              productImages.push({
                id: uploadResult.image.id,
                url: uploadResult.image.url,
                alt_text: uploadResult.image.alt_text || null,
              });
            } else if (imageData.imageUrl) {
              // Store imageUrl directly in Image table
              const imageRecord = await prisma.image.create({
                data: {
                  url: imageData.imageUrl,
                  alt_text: updatedProduct.name,
                  object_id: updatedProduct.id,
                },
              });

              productImages.push({
                id: imageRecord.id,
                url: imageRecord.url,
                alt_text: imageRecord.alt_text || null,
              });
            }
          }
        }

        // Get all products for this delivery to recalculate total cost
        const allProducts = await prisma.deliveryProduct.findMany({
          where: { deliveryId: existingProduct.deliveryId },
          select: {
            price: true,
            quantity: true,
          },
        });

        // Recalculate total cost from sum of all product prices
        const newTotalCost = allProducts.reduce((sum, product) => {
          return sum + Number(product.price) * (product.quantity || 1);
        }, 0);

        // Update delivery total cost
        await prisma.delivery.update({
          where: { id: existingProduct.deliveryId },
          data: {
            total_cost: newTotalCost,
          },
        });

        // Get existing images for this product
        const existingImages = await prisma.image.findMany({
          where: { object_id: productId },
          select: {
            id: true,
            url: true,
            alt_text: true,
          },
        });

        const allProductImages = [
          ...existingImages.map((img) => ({
            id: img.id,
            url: img.url,
            alt_text: img.alt_text,
          })),
          ...productImages,
        ];

        return {
          product: {
            id: updatedProduct.id,
            name: updatedProduct.name,
            price: Number(updatedProduct.price),
            currency: updatedProduct.currency,
            description: updatedProduct.description || null,
            weight: updatedProduct.weight ? Number(updatedProduct.weight) : null,
            quantity: updatedProduct.quantity || null,
            url: updatedProduct.url || null,
            images: allProductImages,
          },
          deliveryTotalCost: newTotalCost,
        };
      });

      const message = await this.i18n.translate(
        'translation.delivery.product.update.success',
        {
          lang,
          defaultValue: 'Delivery product updated successfully',
        },
      );

      return {
        message,
        product: result.product,
        deliveryTotalCost: result.deliveryTotalCost,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      console.error('Error updating delivery product:', error);
      const message = await this.i18n.translate(
        'translation.delivery.product.update.failed',
        {
          lang,
          defaultValue: 'Failed to update delivery product',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async deleteDelivery(
    deliveryId: string,
    lang?: string,
  ): Promise<DeleteDeliveryResponseDto> {
    try {
      // Check if delivery exists
      const existingDelivery = await this.prisma.delivery.findUnique({
        where: { id: deliveryId },
        select: { id: true, is_deleted: true },
      });

      if (!existingDelivery) {
        const message = await this.i18n.translate(
          'translation.delivery.notFound',
          {
            lang,
            defaultValue: 'Delivery not found',
          },
        );
        throw new NotFoundException(message);
      }

      if (existingDelivery.is_deleted) {
        const message = await this.i18n.translate(
          'translation.delivery.alreadyDeleted',
          {
            lang,
            defaultValue: 'Delivery is already deleted',
          },
        );
        throw new BadRequestException(message);
      }

      // Soft delete by setting is_deleted to true
      await this.prisma.delivery.update({
        where: { id: deliveryId },
        data: { is_deleted: true },
      });

      const message = await this.i18n.translate(
        'translation.delivery.delete.success',
        {
          lang,
          defaultValue: 'Delivery deleted successfully',
        },
      );

      return { message };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      console.error('Error deleting delivery:', error);
      const message = await this.i18n.translate(
        'translation.delivery.delete.failed',
        {
          lang,
          defaultValue: 'Failed to delete delivery',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async getAllDeliveries(
    query: GetAllDeliveriesQueryDto,
    lang?: string,
  ): Promise<GetAllDeliveriesResponseDto> {
    try {
      const { page = 1, limit = 10, status, userId } = query;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {
        is_deleted: false, // Only get non-deleted deliveries
      };

      if (status) {
        where.status = status;
      }

      if (userId) {
        where.userId = userId;
      }

      // Get total count
      const total = await this.prisma.delivery.count({ where });

      // Get deliveries with product count
      const deliveries = await this.prisma.delivery.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              deliveryProducts: true,
            },
          },
        },
      });

      const totalPages = Math.ceil(total / limit);

      return {
        deliveries: deliveries.map((delivery) => ({
          id: delivery.id,
          userId: delivery.userId,
          total_cost: Number(delivery.total_cost),
          currency: delivery.currency,
          description: delivery.description,
          status: delivery.status,
          reward: delivery.reward,
          expected_date: delivery.expected_date,
          createdAt: delivery.createdAt,
          updatedAt: delivery.updatedAt,
          productCount: delivery._count.deliveryProducts,
        })),
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      console.error('Error getting deliveries:', error);
      const message = await this.i18n.translate(
        'translation.delivery.getAll.failed',
        {
          lang,
          defaultValue: 'Failed to get deliveries',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }
}
