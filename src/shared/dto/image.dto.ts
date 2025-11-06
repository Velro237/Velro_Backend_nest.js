import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class UploadImageDto {
  @ApiProperty({
    description: 'Base64 encoded image data or image URL',
    example: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD...',
  })
  @IsString()
  @IsNotEmpty()
  image: string;

  @ApiPropertyOptional({
    description: 'Folder path in Cloudinary where the image should be stored',
    example: 'trip-items',
  })
  @IsString()
  @IsOptional()
  folder?: string;

  @ApiPropertyOptional({
    description: 'Alt text for the image',
    example: 'Product image',
  })
  @IsString()
  @IsOptional()
  alt_text?: string;

  @ApiPropertyOptional({
    description: 'Object ID to associate with the image (e.g., trip_item_id)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsOptional()
  object_id?: string;
}

export class UploadImageResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Image uploaded successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Uploaded image information',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      url: 'https://res.cloudinary.com/example/image/upload/v1234567890/trip-items/image.jpg',
      public_id: 'trip-items/image',
      secure_url:
        'https://res.cloudinary.com/example/image/upload/v1234567890/trip-items/image.jpg',
      width: 1920,
      height: 1080,
      format: 'jpg',
      bytes: 245678,
      created_at: '2024-01-15T10:30:00.000Z',
    },
  })
  image: {
    id: string;
    url: string;
    public_id: string;
    secure_url: string;
    width: number;
    height: number;
    format: string;
    bytes: number;
    created_at: Date;
    alt_text?: string;
    object_id?: string;
  };
}

export class UploadMultipleImagesResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Images uploaded successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Array of uploaded image information',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        url: { type: 'string' },
        public_id: { type: 'string' },
        secure_url: { type: 'string' },
        width: { type: 'number' },
        height: { type: 'number' },
        format: { type: 'string' },
        bytes: { type: 'number' },
        created_at: { type: 'string', format: 'date-time' },
        alt_text: { type: 'string', nullable: true },
        object_id: { type: 'string', nullable: true },
      },
    },
    example: [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        url: 'https://res.cloudinary.com/example/image/upload/v1234567890/trip-items/image1.jpg',
        public_id: 'trip-items/image1',
        secure_url:
          'https://res.cloudinary.com/example/image/upload/v1234567890/trip-items/image1.jpg',
        width: 1920,
        height: 1080,
        format: 'jpg',
        bytes: 245678,
        created_at: '2024-01-15T10:30:00.000Z',
      },
    ],
  })
  images: Array<{
    id: string;
    url: string;
    public_id: string;
    secure_url: string;
    width: number;
    height: number;
    format: string;
    bytes: number;
    created_at: Date;
    alt_text?: string;
    object_id?: string;
  }>;
}

export class DeleteImageDto {
  @ApiProperty({
    description: 'Image ID to delete',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  imageId: string;
}

export class DeleteImageResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Image deleted successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Deleted image ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  imageId: string;
}
