import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { MulterFile } from '../shared/types/multer.interface';

@Injectable()
export class CloudinaryService {
  constructor(private readonly configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadImage(
    file: MulterFile,
    folder?: string,
  ): Promise<{ secure_url: string; public_id: string }> {
    return new Promise((resolve, reject) => {
      const isPdf = file.mimetype === 'application/pdf';
      const resourceType = isPdf ? 'raw' : 'image';

      const uploadOptions: Record<string, unknown> = {
        resource_type: resourceType,
        folder: folder || 'velro',
      };

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error: unknown, result: { secure_url?: string; public_id?: string } | undefined) => {
          if (error) {
            reject(
              new BadRequestException(
                `Cloudinary upload failed: ${(error as Error).message}`,
              ),
            );
          } else if (result?.secure_url) {
            resolve({
              secure_url: result.secure_url,
              public_id: result.public_id || '',
            });
          } else {
            reject(new BadRequestException('Cloudinary upload failed: Unknown error'));
          }
        },
      );

      uploadStream.end(file.buffer);
    });
  }

  async deleteImage(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      console.error(`Failed to delete image from Cloudinary: ${publicId}`, error);
    }
  }
}
