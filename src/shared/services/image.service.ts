import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { v2 as cloudinary } from 'cloudinary';
import {
  UploadImageDto,
  UploadImageResponseDto,
  UploadMultipleImagesResponseDto,
  DeleteImageResponseDto,
} from '../dto/image.dto';

@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    // Initialize Cloudinary
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });

    // Verify configuration
    if (!cloudinary.config().cloud_name) {
      this.logger.warn(
        'Cloudinary configuration is missing. Image uploads will fail.',
      );
    }
  }

  /**
   * Upload a file from multer to Cloudinary and save metadata to database
   * @param file - Multer file object
   * @param options - Upload options (folder, alt_text, object_id)
   * @returns Uploaded image information
   */
  async uploadFile(
    file: {
      buffer: Buffer;
      mimetype: string;
      originalname: string;
    },
    options?: {
      folder?: string;
      alt_text?: string;
      object_id?: string;
    },
  ): Promise<UploadImageResponseDto> {
    try {
      if (!file) {
        throw new BadRequestException('File is required');
      }

      // Validate file type
      if (!file.mimetype.startsWith('image/')) {
        throw new BadRequestException('File must be an image');
      }

      // Convert buffer to base64 data URL for Cloudinary
      const base64Image = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

      // Upload to Cloudinary
      const uploadResult = await cloudinary.uploader.upload(base64Image, {
        folder: options?.folder || 'velro',
        resource_type: 'auto',
        transformation: [{ quality: 'auto' }, { fetch_format: 'auto' }],
      });

      // Save image metadata to database
      const imageRecord = await this.prisma.image.create({
        data: {
          url: uploadResult.secure_url,
          alt_text: options?.alt_text || null,
          object_id: options?.object_id || null,
        },
      });

      this.logger.log(`Image uploaded successfully: ${imageRecord.id}`);

      return {
        message: 'Image uploaded successfully',
        image: {
          id: imageRecord.id,
          url: uploadResult.secure_url,
          public_id: uploadResult.public_id,
          secure_url: uploadResult.secure_url,
          width: uploadResult.width,
          height: uploadResult.height,
          format: uploadResult.format,
          bytes: uploadResult.bytes,
          created_at: imageRecord.created_at,
          alt_text: imageRecord.alt_text || undefined,
          object_id: imageRecord.object_id || undefined,
        },
      };
    } catch (error: any) {
      this.logger.error(`Failed to upload file: ${error.message}`, error.stack);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Failed to upload file: ${error.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Upload multiple files from multer to Cloudinary and save metadata to database
   * @param files - Array of multer file objects
   * @param options - Upload options (folder, object_id)
   * @returns Array of uploaded image information
   */
  async uploadMultipleFiles(
    files: Array<{
      buffer: Buffer;
      mimetype: string;
      originalname: string;
    }>,
    options?: {
      folder?: string;
      object_id?: string;
    },
  ): Promise<UploadMultipleImagesResponseDto> {
    try {
      if (!files || files.length === 0) {
        throw new BadRequestException('At least one file is required');
      }

      // Validate all files are images
      for (const file of files) {
        if (!file.mimetype.startsWith('image/')) {
          throw new BadRequestException(
            `File ${file.originalname} must be an image`,
          );
        }
      }

      // Upload all files in parallel
      const uploadPromises = files.map(async (file) => {
        // Convert buffer to base64 data URL for Cloudinary
        const base64Image = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

        // Upload to Cloudinary
        const uploadResult = await cloudinary.uploader.upload(base64Image, {
          folder: options?.folder || 'velro',
          resource_type: 'auto',
          transformation: [{ quality: 'auto' }, { fetch_format: 'auto' }],
        });

        // Save image metadata to database
        const imageRecord = await this.prisma.image.create({
          data: {
            url: uploadResult.secure_url,
            alt_text: file.originalname || null,
            object_id: options?.object_id || null,
          },
        });

        return {
          id: imageRecord.id,
          url: uploadResult.secure_url,
          public_id: uploadResult.public_id,
          secure_url: uploadResult.secure_url,
          width: uploadResult.width,
          height: uploadResult.height,
          format: uploadResult.format,
          bytes: uploadResult.bytes,
          created_at: imageRecord.created_at,
          alt_text: imageRecord.alt_text || undefined,
          object_id: imageRecord.object_id || undefined,
        };
      });

      const images = await Promise.all(uploadPromises);

      this.logger.log(`Successfully uploaded ${images.length} images`);

      return {
        message: `Successfully uploaded ${images.length} image(s)`,
        images,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to upload multiple files: ${error.message}`,
        error.stack,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Failed to upload files: ${error.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Upload an image to Cloudinary and save metadata to database
   * @param uploadDto - Image upload data (base64 or URL)
   * @returns Uploaded image information
   */
  async uploadImage(
    uploadDto: UploadImageDto,
  ): Promise<UploadImageResponseDto> {
    try {
      const { image, folder, alt_text, object_id } = uploadDto;

      // Validate image data
      if (!image) {
        throw new BadRequestException('Image data is required');
      }

      // Determine if image is base64 or URL
      const isBase64 =
        image.startsWith('data:image/') ||
        image.startsWith('data:application/');
      const isUrl = image.startsWith('http://') || image.startsWith('https://');

      let uploadResult: any;

      if (isBase64) {
        // Upload base64 image
        uploadResult = await cloudinary.uploader.upload(image, {
          folder: folder || 'velro',
          resource_type: 'auto',
          transformation: [{ quality: 'auto' }, { fetch_format: 'auto' }],
        });
      } else if (isUrl) {
        // Upload from URL
        uploadResult = await cloudinary.uploader.upload(image, {
          folder: folder || 'velro',
          resource_type: 'auto',
          transformation: [{ quality: 'auto' }, { fetch_format: 'auto' }],
        });
      } else {
        throw new BadRequestException(
          'Invalid image format. Expected base64 data URL or HTTP/HTTPS URL',
        );
      }

      // Save image metadata to database
      const imageRecord = await this.prisma.image.create({
        data: {
          url: uploadResult.secure_url,
          alt_text: alt_text || null,
          object_id: object_id || null,
        },
      });

      this.logger.log(`Image uploaded successfully: ${imageRecord.id}`);

      return {
        message: 'Image uploaded successfully',
        image: {
          id: imageRecord.id,
          url: uploadResult.secure_url,
          public_id: uploadResult.public_id,
          secure_url: uploadResult.secure_url,
          width: uploadResult.width,
          height: uploadResult.height,
          format: uploadResult.format,
          bytes: uploadResult.bytes,
          created_at: imageRecord.created_at,
          alt_text: imageRecord.alt_text || undefined,
          object_id: imageRecord.object_id || undefined,
        },
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to upload image: ${error.message}`,
        error.stack,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Failed to upload image: ${error.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Delete an image from Cloudinary and database
   * @param imageId - Image ID to delete
   * @returns Deletion confirmation
   */
  async deleteImage(imageId: string): Promise<DeleteImageResponseDto> {
    try {
      // Find image in database
      const imageRecord = await this.prisma.image.findUnique({
        where: { id: imageId },
      });

      if (!imageRecord) {
        throw new BadRequestException(`Image with ID ${imageId} not found`);
      }

      // Extract public_id from Cloudinary URL
      // Cloudinary URLs format: https://res.cloudinary.com/{cloud_name}/image/upload/{version}/{public_id}.{format}
      const urlParts = imageRecord.url.split('/');
      const uploadIndex = urlParts.findIndex((part) => part === 'upload');

      if (uploadIndex === -1 || uploadIndex >= urlParts.length - 1) {
        this.logger.warn(
          `Could not extract public_id from URL: ${imageRecord.url}`,
        );
      } else {
        // Extract public_id (everything after 'upload/' and before the file extension)
        const pathAfterUpload = urlParts.slice(uploadIndex + 1).join('/');
        const publicId = pathAfterUpload.replace(/\.[^/.]+$/, ''); // Remove file extension

        try {
          // Delete from Cloudinary
          await cloudinary.uploader.destroy(publicId, {
            resource_type: 'image',
          });
          this.logger.log(`Image deleted from Cloudinary: ${publicId}`);
        } catch (cloudinaryError: any) {
          // Log error but continue with database deletion
          this.logger.warn(
            `Failed to delete image from Cloudinary: ${cloudinaryError.message}`,
          );
        }
      }

      // Delete from database
      await this.prisma.image.delete({
        where: { id: imageId },
      });

      this.logger.log(`Image deleted from database: ${imageId}`);

      return {
        message: 'Image deleted successfully',
        imageId,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to delete image: ${error.message}`,
        error.stack,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Failed to delete image: ${error.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Delete an image by public_id directly from Cloudinary
   * @param publicId - Cloudinary public_id
   * @returns Deletion confirmation
   */
  async deleteImageByPublicId(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image',
      });
      this.logger.log(
        `Image deleted from Cloudinary by public_id: ${publicId}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to delete image from Cloudinary: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to delete image from Cloudinary: ${error.message || 'Unknown error'}`,
      );
    }
  }
}
