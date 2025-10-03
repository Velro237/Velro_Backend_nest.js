import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse } from 'axios';
import * as crypto from 'crypto';

export interface DiditSessionRequest {
  workflow_id: string;
  vendor_data: string;
  callback: string;
  metadata?: string;
}

export interface DiditSessionResponse {
  session_id: string;
  session_number: number;
  session_token: string;
  vendor_data: string;
  metadata?: any;
  status: string;
  workflow_id: string;
  callback: string;
  url: string;
}

export interface IdVerification {
  status: string;
  document_type?: string;
  document_number?: string;
  personal_number?: string;
  portrait_image?: string;
}

export interface DiditWebhookPayload {
  session_id: string;
  status: string;
  webhook_type: 'status.updated' | 'data.updated';
  created_at: number;
  timestamp: number;
  workflow_id?: string;
  vendor_data?: string;
  metadata?: any;
  decision?: DiditDecision;
}

export interface DiditDecision {
  session_id: string;
  session_number: number;
  session_url: string;
  status: string;
  workflow_id: string;
  features: string[];
  vendor_data: string;
  metadata?: any;
  expected_details?: any;
  contact_details?: any;
  callback: string;
  id_verification?: IdVerification;
  reviews?: Array<{
    user: string;
    new_status: string;
    comment: string;
    created_at: string;
  }>;
  created_at: string;
}

export interface DiditCallbackData {
  session_id: string;
  status: string;
  webhook_type: 'status.updated' | 'data.updated';
  created_at: number;
  timestamp: number;
  workflow_id?: string;
  vendor_data?: string;
  metadata?: any;
  decision?: DiditDecision;
  // Legacy fields for backward compatibility
  verification_data?: any;
  rejection_reason?: string;
}

@Injectable()
export class DiditService {
  private readonly logger = new Logger(DiditService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly workflowId: string;
  private readonly webhookSecret: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('DIDIT_API_KEY');
    this.baseUrl = this.configService.get<string>('DIDIT_API_BASE_URL');
    this.workflowId = this.configService.get<string>('DIDIT_WORKFLOW_ID');
    this.webhookSecret = this.configService.get<string>('DIDIT_WEBHOOK_SECRET');
    
    if (!this.apiKey) {
      throw new Error('DIDIT_API_KEY is required');
    }
    if (!this.baseUrl) {
      throw new Error('DIDIT_API_BASE_URL is required');
    }
    if (!this.workflowId) {
      throw new Error('DIDIT_WORKFLOW_ID is required');
    }
    if (!this.webhookSecret) {
      throw new Error('DIDIT_WEBHOOK_SECRET is required');
    }
  }

  private getHeaders() {
    return {
      'x-api-key': this.apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  /**
   * Create a new verification session with Didit
   */
  async createVerificationSession(request: {
    userId: string;
    callbackUrl: string;
    metadata?: string;
  }): Promise<DiditSessionResponse> {
    try {
      const sessionData: DiditSessionRequest = {
        workflow_id: this.workflowId,
        vendor_data: request.userId,
        callback: request.callbackUrl,
        metadata: request.metadata,
      };

      this.logger.log(`Creating verification session for user: ${request.userId}`);
      this.logger.log(`Session data: ${JSON.stringify(sessionData, null, 2)}`);
      
      const response: AxiosResponse<DiditSessionResponse> = await axios.post(
        `${this.baseUrl}/session/`,
        sessionData,
        { headers: this.getHeaders() }
      );

      this.logger.log(`Session created successfully: ${response.data.session_id}`);
      this.logger.log(`Session URL: ${response.data.url}`);
      
      return response.data;
    } catch (error) {
      this.logger.error('Failed to create verification session:', error.response?.data || error.message);
      throw new Error(`Failed to create verification session: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get session status from Didit
   */
  async getSessionStatus(sessionId: string): Promise<DiditCallbackData> {
    try {
      this.logger.log(`Getting session status for: ${sessionId}`);
      
      const response: AxiosResponse<DiditCallbackData> = await axios.get(
        `${this.baseUrl}/session/${sessionId}/decision/`,
        { headers: this.getHeaders() }
      );

      this.logger.log(`Session status retrieved: ${response.data.status}`);
      
      return response.data;
    } catch (error) {
      this.logger.error('Failed to get session status:', error.response?.data || error.message);
      throw new Error(`Failed to get session status: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Validate webhook signature using HMAC-SHA256 (official Didit specification)
   */
  validateWebhookSignature(
    rawBody: string, 
    signature: string, 
    timestamp: string
  ): boolean {
    try {
      // Validate timestamp (within configured tolerance)
      const toleranceSeconds = parseInt(process.env.DIDIT_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS || '300', 10);
      const currentTime = Math.floor(Date.now() / 1000);
      const incomingTime = parseInt(timestamp, 10);
      if (Math.abs(currentTime - incomingTime) > toleranceSeconds) {
        this.logger.warn('Webhook timestamp is stale');
        return false;
      }

      // Create HMAC signature using the webhook secret
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(rawBody)
        .digest('hex');

      // Compare signatures using timing-safe comparison
      const expectedSignatureBuffer = Buffer.from(expectedSignature, 'utf8');
      const providedSignatureBuffer = Buffer.from(signature, 'utf8');

      const isValid = crypto.timingSafeEqual(
        expectedSignatureBuffer,
        providedSignatureBuffer
      );

      if (!isValid) {
        this.logger.warn(`Invalid webhook signature. Expected: ${expectedSignature}, Provided: ${signature}`);
      }

      return isValid;
    } catch (error) {
      this.logger.error('Error validating webhook signature:', error);
      return false;
    }
  }

  /**
   * Parse webhook payload from Didit (official webhook structure)
   */
  parseWebhookPayload(payload: any): DiditCallbackData {
    return {
      session_id: payload.session_id,
      status: payload.status,
      webhook_type: payload.webhook_type,
      created_at: payload.created_at,
      timestamp: payload.timestamp,
      workflow_id: payload.workflow_id,
      vendor_data: payload.vendor_data,
      metadata: payload.metadata,
      decision: payload.decision,
      // Legacy fields for backward compatibility
      verification_data: payload.decision?.id_verification,
      rejection_reason: payload.decision?.reviews?.find(r => r.new_status === 'Declined')?.comment,
    };
  }
}
