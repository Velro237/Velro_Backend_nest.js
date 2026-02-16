import {
  Controller,
  Post,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Body,
  Req,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PurchaseProofService } from './purchase-proof.service';
import { CreateProofDto } from './dto/create-proof.dto';
import {
  ApiTags,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

@ApiTags('Purchase Proofs')
@Controller('offers')
export class PurchaseProofController {
  constructor(private readonly proofService: PurchaseProofService) {}

  @Post(':offerId/proofs')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'receipt', maxCount: 1 },
      { name: 'photos', maxCount: 5 },
    ]),
  )
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Upload purchase proof (receipt + photos) for an offer',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description:
      'Receipt (single) and product photos (multiple) along with optional metadata',
    schema: {
      type: 'object',
      properties: {
        receipt: { type: 'string', format: 'binary' },
        photos: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
        total: { type: 'number' },
        currency: { type: 'string' },
        storeName: { type: 'string' },
        purchaseDate: { type: 'string' },
        notes: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Proof uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async uploadProof(
    @Param('offerId') offerId: string,
    @UploadedFiles()
    files: { receipt?: Express.Multer.File[]; photos?: Express.Multer.File[] },
    @Body() body: CreateProofDto,
    @Req() req: any,
  ) {
    const user = req.user;
    return this.proofService.createProof(offerId, user.sub, files, body);
  }
}
