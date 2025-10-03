import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  Headers,
  UnauthorizedException,
  Req,
  RawBodyRequest,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { KycService } from '../services/kyc.service';
import { DiditService } from '../services/didit.service';
import { CreateKycsessionDto } from '../dto/create-kyc-session.dto';
import { KycSessionResponseDto } from '../dto/kyc-session-response.dto';
import { KycStatusDto } from '../dto/kyc-status.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@ApiTags('KYC Verification')
@Controller('kyc')
export class KycController {
  private readonly logger = new Logger(KycController.name);

  constructor(
    private kycService: KycService,
    private diditService: DiditService,
  ) {}

  @Post('session')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create KYC verification session',
    description: 'Creates a new KYC verification session with Didit and returns the WebView URL',
  })
  @ApiResponse({
    status: 201,
    description: 'KYC session created successfully',
    type: KycSessionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'User already verified or invalid request',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @HttpCode(HttpStatus.CREATED)
  async createVerificationSession(
    @Request() req: any,
    @Body() createKycDto: CreateKycsessionDto,
  ): Promise<KycSessionResponseDto> {
    const userId = req.user.id;
    this.logger.log(`Creating KYC session for user: ${userId}`);
    
    return this.kycService.createVerificationSession(userId, createKycDto);
  }


  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get user KYC status',
    description: 'Returns the current KYC verification status for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'KYC status retrieved successfully',
    type: KycStatusDto,
  })
  @ApiResponse({
    status: 404,
    description: 'No KYC record found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getKycStatus(@Request() req: any): Promise<KycStatusDto | null> {
    const userId = req.user.id;
    this.logger.log(`Getting KYC status for user: ${userId}`);
    
    return this.kycService.getUserKycStatus(userId);
  }

  @Get('verified')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Check if user is KYC verified',
    description: 'Returns a boolean indicating if the user is KYC verified',
  })
  @ApiResponse({
    status: 200,
    description: 'Verification status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        verified: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async isVerified(@Request() req: any): Promise<{ verified: boolean }> {
    const userId = req.user.id;
    this.logger.log(`Checking verification status for user: ${userId}`);
    
    const verified = await this.kycService.isUserVerified(userId);
    return { verified };
  }

  @Post('callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Handle Didit webhook callback',
    description: 'Webhook endpoint to receive verification status updates from Didit',
  })
  @ApiResponse({
    status: 200,
    description: 'Callback processed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid callback data',
  })
  async handleDiditCallback(
    @Body() callbackData: any,
    @Req() req: RawBodyRequest<Request>,
    @Headers() headers: any,
  ): Promise<{ success: boolean }> {
    try {
      // Get raw body for signature validation (fallback to JSON.stringify for testing)
      const rawBody = req.rawBody?.toString('utf8') || JSON.stringify(callbackData);
      
      if (!callbackData) {
        throw new BadRequestException('No request body provided');
      }

      this.logger.log(`Received Didit webhook: ${JSON.stringify(callbackData)}`);
      
      // Validate the callback data
      if (!callbackData.session_id || !callbackData.status) {
        throw new BadRequestException('Invalid webhook data: missing session_id or status');
      }

      // Validate webhook signature for security (skip in development/testing)
      const signature = headers['x-signature'] || headers['X-Signature'];
      const timestamp = headers['x-timestamp'] || headers['X-Timestamp'];
      
      if (signature && timestamp && process.env.NODE_ENV === 'production') {
        const isValidSignature = this.diditService.validateWebhookSignature(
          rawBody,
          signature,
          timestamp
        );
        
        if (!isValidSignature) {
          throw new UnauthorizedException('Invalid webhook signature');
        }
      } else {
        this.logger.warn('No webhook signature/timestamp provided - this should only happen in development');
      }

      // Parse the webhook payload
      const parsedWebhookData = this.diditService.parseWebhookPayload(callbackData);
      
      // Process the webhook
      await this.kycService.handleDiditCallback(parsedWebhookData);
      
      this.logger.log(`Successfully processed webhook for session: ${callbackData.session_id}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to process Didit webhook:`, error);
      throw error;
    }
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all KYC records (Admin only)',
    description: 'Returns all KYC verification records for administrative purposes',
  })
  @ApiResponse({
    status: 200,
    description: 'KYC records retrieved successfully',
    type: [KycStatusDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getAllKycRecords(@Request() req: any): Promise<KycStatusDto[]> {
    this.logger.log(`Admin ${req.user.id} requested all KYC records`);
    
    return this.kycService.getAllKycRecords();
  }

  @Get('session/:sessionId/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get session status from Didit',
    description: 'Manually check the status of a verification session with Didit',
  })
  @ApiResponse({
    status: 200,
    description: 'Session status retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getSessionStatus(@Request() req: any, @Param('sessionId') sessionId: string): Promise<any> {
    this.logger.log(`Getting session status for: ${sessionId}`);
    
    try {
      const status = await this.diditService.getSessionStatus(sessionId);
      return status;
    } catch (error) {
      this.logger.error(`Failed to get session status:`, error);
      throw error;
    }
  }
}
