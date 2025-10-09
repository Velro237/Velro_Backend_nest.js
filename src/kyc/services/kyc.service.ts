import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { DiditService, DiditCallbackData } from './didit.service';
import { CreateKycsessionDto } from '../dto/create-kyc-session.dto';
import { KycSessionResponseDto } from '../dto/kyc-session-response.dto';
import { KycStatusDto } from '../dto/kyc-status.dto';
import { KYCStatus, KYCProvider } from '../../../generated/prisma';

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    private prisma: PrismaService,
    private diditService: DiditService,
    private configService: ConfigService,
  ) {}

  /**
   * Create a new KYC verification session for a user
   */
  async createVerificationSession(
    userId: string,
    createKycDto: CreateKycsessionDto,
  ): Promise<KycSessionResponseDto> {
    try {
      // Check if user exists
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Check if user already has a KYC record
      const existingKyc = await this.prisma.userKYC.findFirst({
        where: {
          userId,
          provider: KYCProvider.DIDIT,
        },
      });

      if (existingKyc) {
        // If already verified, don't allow creating new session
        if (existingKyc.status === KYCStatus.APPROVED) {
          throw new BadRequestException('User is already verified');
        }
        
        // If there's an existing session that hasn't expired, return it
        if (
          existingKyc.sessionUrl && 
          existingKyc.expiresAt && 
          new Date(existingKyc.expiresAt) > new Date() &&
          (existingKyc.status === KYCStatus.NOT_STARTED || existingKyc.status === KYCStatus.IN_PROGRESS)
        ) {
          this.logger.log(`Returning existing valid session for user ${userId}`);
          return {
            sessionId: existingKyc.diditSessionId || existingKyc.id,
            sessionNumber: 0, // Not available for existing sessions
            sessionToken: '', // Not available for existing sessions
            vendorData: existingKyc.userId,
            metadata: null,
            status: existingKyc.status,
            workflowId: existingKyc.diditWorkflowId || '',
            callback: existingKyc.callbackUrl || '',
            url: existingKyc.sessionUrl,
            recordId: existingKyc.id,
            expiresAt: existingKyc.expiresAt?.toISOString() || '',
          };
        }
        
        // If session expired or was rejected/declined, we'll create a new one below
        this.logger.log(`Existing session expired or invalid for user ${userId}, creating new session`);
      }

      // Generate callback URL
      const callbackUrl = createKycDto.callbackUrl || 
        `${this.configService.get<string>('APP_URL')}/kyc/callback`;

             // Prepare Didit session request with all available parameters
            const diditSessionRequest = {
              userId,
              callbackUrl,
              metadata: createKycDto.metadata,
            };

      // Create session with Didit
      const diditSession = await this.diditService.createVerificationSession(diditSessionRequest);

      // Calculate expiration time from environment variable
      const expirationHours = parseInt(process.env.KYC_SESSION_EXPIRATION_HOURS || '24', 10);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expirationHours);

      // Create or update KYC record
      const kycRecord = await this.prisma.userKYC.upsert({
        where: {
          userId_provider: {
            userId,
            provider: KYCProvider.DIDIT,
          },
        },
        create: {
          userId,
          provider: KYCProvider.DIDIT,
          diditSessionId: diditSession.session_id,
          diditWorkflowId: process.env.DIDIT_WORKFLOW_ID,
          sessionUrl: diditSession.url,
          callbackUrl,
                 status: KYCStatus.NOT_STARTED,
          expiresAt,
        },
        update: {
          diditSessionId: diditSession.session_id,
          diditWorkflowId: process.env.DIDIT_WORKFLOW_ID,
          sessionUrl: diditSession.url,
          callbackUrl,
                 status: KYCStatus.NOT_STARTED,
          expiresAt,
          updatedAt: new Date(),
        },
      });

      this.logger.log(`KYC session created for user ${userId}: ${kycRecord.id}`);

      return {
        sessionId: diditSession.session_id,
        sessionNumber: diditSession.session_number,
        sessionToken: diditSession.session_token,
        vendorData: diditSession.vendor_data,
        metadata: diditSession.metadata,
        status: diditSession.status,
        workflowId: diditSession.workflow_id,
        callback: diditSession.callback,
        url: diditSession.url,
        recordId: kycRecord.id,
        expiresAt: expiresAt.toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to create KYC session for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get KYC status for a user
   */
  async getUserKycStatus(userId: string): Promise<KycStatusDto | null> {
    try {
      const kycRecord = await this.prisma.userKYC.findFirst({
        where: {
          userId,
          provider: KYCProvider.DIDIT,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!kycRecord) {
        return null;
      }

      return {
        id: kycRecord.id,
        userId: kycRecord.userId,
        status: kycRecord.status,
        provider: kycRecord.provider,
        createdAt: kycRecord.createdAt,
        verifiedAt: kycRecord.verifiedAt,
        expiresAt: kycRecord.expiresAt,
        rejectionReason: kycRecord.rejectionReason,
      };
    } catch (error) {
      this.logger.error(`Failed to get KYC status for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Handle Didit callback
   */
  async handleDiditCallback(callbackData: DiditCallbackData): Promise<void> {
    try {
      this.logger.log(`Processing Didit callback for session: ${callbackData.session_id}`);

      // Find KYC record by Didit session ID
      const kycRecord = await this.prisma.userKYC.findUnique({
        where: {
          diditSessionId: callbackData.session_id,
        },
      });

      if (!kycRecord) {
        this.logger.warn(`No KYC record found for session: ${callbackData.session_id}`);
        return;
      }

      // Map Didit status to our KYC status (official Didit statuses)
      let newStatus: KYCStatus;
             switch (callbackData.status.toLowerCase()) {
               case 'approved':
                 newStatus = KYCStatus.APPROVED;
                 break;
               case 'declined':
                 newStatus = KYCStatus.DECLINED;
                 break;
               case 'expired':
                 newStatus = KYCStatus.EXPIRED;
                 break;
               case 'kyc expired':
                 newStatus = KYCStatus.KYC_EXPIRED;
                 break;
               case 'in review':
                 newStatus = KYCStatus.IN_REVIEW;
                 break;
               case 'in progress':
                 newStatus = KYCStatus.IN_PROGRESS;
                 break;
               case 'not started':
                 newStatus = KYCStatus.NOT_STARTED;
                 break;
               case 'abandoned':
                 newStatus = KYCStatus.ABANDONED;
                 break;
               default:
                 this.logger.warn(`Unknown Didit status: ${callbackData.status}, defaulting to IN_PROGRESS`);
                 newStatus = KYCStatus.IN_PROGRESS;
             }

      // Prepare verification data from the webhook structure
      const verificationData = {
        webhook_type: callbackData.webhook_type,
        decision: callbackData.decision,
        id_verification: callbackData.decision?.id_verification,
        features: callbackData.decision?.features,
        metadata: callbackData.metadata || callbackData.decision?.metadata,
        expected_details: callbackData.decision?.expected_details,
        contact_details: callbackData.decision?.contact_details,
        reviews: callbackData.decision?.reviews,
        // Legacy support
        verification_data: callbackData.verification_data,
      };

      // Update KYC record
      const updateData: any = {
        status: newStatus,
        verificationData,
        updatedAt: new Date(),
      };

             if (newStatus === KYCStatus.APPROVED) {
               updateData.verifiedAt = new Date();
             }

             if (newStatus === KYCStatus.DECLINED && callbackData.rejection_reason) {
        updateData.rejectionReason = callbackData.rejection_reason;
      }

      await this.prisma.userKYC.update({
        where: { id: kycRecord.id },
        data: updateData,
      });

      this.logger.log(`KYC status updated for user ${kycRecord.userId}: ${newStatus}`);
    } catch (error) {
      this.logger.error(`Failed to handle Didit callback:`, error);
      throw error;
    }
  }

  /**
   * Check if user is KYC verified
   */
  async isUserVerified(userId: string): Promise<boolean> {
    try {
      const kycRecord = await this.prisma.userKYC.findFirst({
        where: {
          userId,
               provider: KYCProvider.DIDIT,
               status: KYCStatus.APPROVED,
        },
      });

      return !!kycRecord;
    } catch (error) {
      this.logger.error(`Failed to check verification status for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Get all KYC records for admin purposes
   */
  async getAllKycRecords(skip = 0, take = 10): Promise<KycStatusDto[]> {
    try {
      const kycRecords = await this.prisma.userKYC.findMany({
        skip,
        take,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });

      return kycRecords.map(record => ({
        id: record.id,
        userId: record.userId,
        status: record.status,
        provider: record.provider,
        createdAt: record.createdAt,
        verifiedAt: record.verifiedAt,
        expiresAt: record.expiresAt,
        rejectionReason: record.rejectionReason,
      }));
    } catch (error) {
      this.logger.error('Failed to get all KYC records:', error);
      throw error;
    }
  }
}
