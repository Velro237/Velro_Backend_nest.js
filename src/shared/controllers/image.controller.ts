import {
  Controller,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFiles,
  UploadedFile,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { ImageService } from '../services/image.service';
import {
  UploadImageResponseDto,
  UploadMultipleImagesResponseDto,
  DeleteImageResponseDto,
} from '../dto/image.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Images')
@ApiBearerAuth('JWT-auth')
@Controller('image')
@UseGuards(JwtAuthGuard)
export class ImageController {
  constructor(private readonly imageService: ImageService) {}

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload a single image to Cloudinary',
    description:
      'Uploads a single image file to Cloudinary and saves metadata to the database. Returns the image URL and metadata.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file to upload',
        },
        folder: {
          type: 'string',
          description:
            'Folder path in Cloudinary where the image should be stored',
          example: 'trip-items',
        },
        alt_text: {
          type: 'string',
          description: 'Alt text for the image',
          example: 'Product image',
        },
        object_id: {
          type: 'string',
          description: 'Object ID to associate with the image',
          example: '123e4567-e89b-12d3-a456-426614174000',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Image uploaded successfully',
    type: UploadImageResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid image format or missing file',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error - Failed to upload image',
  })
  async uploadImage(
    @UploadedFile() file: any,
    @Body('folder') folder?: string,
    @Body('alt_text') alt_text?: string,
    @Body('object_id') object_id?: string,
  ): Promise<UploadImageResponseDto> {
    return this.imageService.uploadFile(file, { folder, alt_text, object_id });
  }

  @Post('upload-multiple')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FilesInterceptor('files', 10))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload multiple images to Cloudinary',
    description:
      'Uploads multiple image files (up to 10) to Cloudinary and saves metadata to the database. Returns an array of uploaded image information.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Image files to upload (max 10)',
        },
        folder: {
          type: 'string',
          description:
            'Folder path in Cloudinary where the images should be stored',
          example: 'trip-items',
        },
        object_id: {
          type: 'string',
          description: 'Object ID to associate with the images',
          example: '123e4567-e89b-12d3-a456-426614174000',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Images uploaded successfully',
    type: UploadMultipleImagesResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid image format or missing files',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error - Failed to upload images',
  })
  async uploadMultipleImages(
    @UploadedFiles() files: any[],
    @Body('folder') folder?: string,
    @Body('object_id') object_id?: string,
  ): Promise<UploadMultipleImagesResponseDto> {
    return this.imageService.uploadMultipleFiles(files, {
      folder,
      object_id,
    });
  }

  @Delete(':imageId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete an image',
    description:
      'Deletes an image from Cloudinary and removes its metadata from the database.',
  })
  @ApiResponse({
    status: 200,
    description: 'Image deleted successfully',
    type: DeleteImageResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Image not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error - Failed to delete image',
  })
  async deleteImage(
    @Param('imageId') imageId: string,
  ): Promise<DeleteImageResponseDto> {
    return this.imageService.deleteImage(imageId);
  }
}
