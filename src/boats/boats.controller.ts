import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { BoatsService } from './boats.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from 'generated/prisma';
import {
  CreateBoatShipmentDto,
  CreateBoatShipmentResponseDto,
} from './dto/create-boat-shipment.dto';
import {
  SearchBoatShipmentsDto,
  SearchBoatShipmentsResponseDto,
} from './dto/search-boat-shipments.dto';
import { GetBoatShipmentDetailResponseDto } from './dto/get-boat-shipment-detail.dto';
import {
  GetMyBoatShipmentsDto,
  GetMyBoatShipmentsResponseDto,
} from './dto/get-my-boat-shipments.dto';
import { CancelBoatShipmentResponseDto } from './dto/cancel-boat-shipment.dto';
import {
  CreateChatForBoatDto,
  CreateChatForBoatResponseDto,
} from './dto/create-chat-for-boat.dto';
import {
  BoatCreateIssueReportBodyDto,
  CreateIssueReportResponseDto,
} from './dto/create-issue-report.dto';

@ApiTags('Boats')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('boats')
export class BoatsController {
  constructor(private readonly boatsService: BoatsService) {}

  @Post('shipments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new boat shipment',
    description:
      'Create a new sea freight shipment with departure/arrival ports, dates, capacity, and pricing. Only logged-in users can create shipments.',
  })
  @ApiBody({ type: CreateBoatShipmentDto })
  @ApiResponse({
    status: 201,
    description: 'Shipment created successfully',
    type: CreateBoatShipmentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input data or validation errors',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'array',
          items: { type: 'string' },
          example: [
            'Departure date must be in the future',
            'Arrival date must be after departure date',
            'Available capacity cannot exceed maximum capacity',
          ],
        },
        error: { type: 'string', example: 'Bad Request' },
        statusCode: { type: 'number', example: 400 },
      },
    },
  })
  async createBoatShipment(
    @CurrentUser() user: User,
    @Body() createDto: CreateBoatShipmentDto,
  ): Promise<CreateBoatShipmentResponseDto> {
    return this.boatsService.createBoatShipment(user.id, createDto);
  }

  @Get('shipments/search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Search boat shipments',
    description:
      'Search for published boat shipments by port location text (country/region/address). Can filter by date and capacity. Returns matching shipments with pricing.',
  })
  @ApiResponse({
    status: 200,
    description: 'Search results returned successfully',
    type: SearchBoatShipmentsResponseDto,
  })
  async searchBoatShipments(
    @Query() searchDto: SearchBoatShipmentsDto,
  ): Promise<SearchBoatShipmentsResponseDto> {
    return this.boatsService.searchBoatShipments(searchDto);
  }

  @Get('shipments/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get boat shipment detail',
    description:
      'Get detailed information about a specific boat shipment including ship owner info, ports, dates, capacity, pricing, and KYC verification status.',
  })
  @ApiParam({
    name: 'id',
    description: 'Boat shipment ID',
    example: 'trip-uuid-123',
  })
  @ApiResponse({
    status: 200,
    description: 'Shipment details returned successfully',
    type: GetBoatShipmentDetailResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Shipment not found',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Shipment not found' },
        error: { type: 'string', example: 'Not Found' },
        statusCode: { type: 'number', example: 404 },
      },
    },
  })
  async getBoatShipmentDetail(
    @Param('id') shipmentId: string,
  ): Promise<GetBoatShipmentDetailResponseDto> {
    return this.boatsService.getBoatShipmentDetail(shipmentId);
  }

  @Get('my-shipments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get my shipments (ship owner view)',
    description:
      'Get all shipments created by the authenticated user (ship owner). Can filter by UPCOMING (published shipments with future departure), PAST (past shipments or cancelled), or ALL.',
  })
  @ApiQuery({
    name: 'filter',
    required: false,
    enum: ['UPCOMING', 'PAST', 'ALL'],
    description:
      'Filter shipments: UPCOMING (future shipments), PAST (completed/cancelled), ALL (all shipments)',
    example: 'UPCOMING',
  })
  @ApiResponse({
    status: 200,
    description: 'My shipments returned successfully',
    type: GetMyBoatShipmentsResponseDto,
  })
  async getMyBoatShipments(
    @CurrentUser() user: User,
    @Query() query: GetMyBoatShipmentsDto,
  ): Promise<GetMyBoatShipmentsResponseDto> {
    return this.boatsService.getMyBoatShipments(user.id, query);
  }

  @Post('shipments/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel a boat shipment',
    description:
      'Cancel a boat shipment. Only the ship owner who created the shipment can cancel it. Sends push notifications to all participants in chats for this shipment.',
  })
  @ApiParam({
    name: 'id',
    description: 'Boat shipment ID to cancel',
    example: 'trip-uuid-123',
  })
  @ApiResponse({
    status: 200,
    description: 'Shipment cancelled successfully',
    type: CancelBoatShipmentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Shipment is already cancelled',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Shipment is already cancelled' },
        error: { type: 'string', example: 'Bad Request' },
        statusCode: { type: 'number', example: 400 },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Only the ship owner can cancel this shipment',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Only the ship owner can cancel this shipment',
        },
        error: { type: 'string', example: 'Forbidden' },
        statusCode: { type: 'number', example: 403 },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Shipment not found',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Shipment not found' },
        error: { type: 'string', example: 'Not Found' },
        statusCode: { type: 'number', example: 404 },
      },
    },
  })
  async cancelBoatShipment(
    @CurrentUser() user: User,
    @Param('id') shipmentId: string,
  ): Promise<CancelBoatShipmentResponseDto> {
    return this.boatsService.cancelBoatShipment(user.id, shipmentId);
  }

  @Post('shipments/:id/chat')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create or get chat for a boat shipment',
    description:
      'Create a new chat with the ship owner for a boat shipment, or return existing chat if one already exists. Only logged-in users can create chats.',
  })
  @ApiParam({
    name: 'id',
    description: 'Boat shipment ID',
    example: 'trip-uuid-123',
  })
  @ApiResponse({
    status: 201,
    description: 'Chat created or existing chat returned',
    type: CreateChatForBoatResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot chat with yourself (user is the ship owner)',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Cannot chat with yourself' },
        error: { type: 'string', example: 'Bad Request' },
        statusCode: { type: 'number', example: 400 },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Shipment not found',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Shipment not found' },
        error: { type: 'string', example: 'Not Found' },
        statusCode: { type: 'number', example: 404 },
      },
    },
  })
  async createChatForBoat(
    @CurrentUser() user: User,
    @Param('id') shipmentId: string,
  ): Promise<CreateChatForBoatResponseDto> {
    return this.boatsService.createChatForBoat(user.id, {
      shipment_id: shipmentId,
    });
  }

  @Post('shipments/:id/report')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Report a boat shipment',
    description: 'Submit a report about a boat shipment (package issues, payment problems, communication problems, policy violations). The shipment_id is taken from the URL parameter.',
  })
  @ApiParam({ name: 'id', description: 'Boat shipment ID to report', example: 'trip-uuid-123' })
  @ApiBody({
    type: BoatCreateIssueReportBodyDto,
    description: 'Report details (shipment_id is taken from URL)',
    examples: {
      packageDamaged: {
        summary: 'Package damaged',
        value: {
          type: 'PACKAGE_ISSUE',
          description: 'Package was damaged during shipment',
        },
      },
      packageLost: {
        summary: 'Package lost or missing',
        value: {
          type: 'PACKAGE_LOST',
          description: 'Package was lost or missing during shipment',
        },
      },
      hiddenFees: {
        summary: 'Hidden fees or charges',
        value: {
          type: 'PAYMENT_PROBLEM',
          description: 'Hidden fees or charges were applied',
        },
      },
      customsDeclaration: {
        summary: 'Incorrect customs declaration',
        value: {
          type: 'POLICY_VIOLATION',
          description: 'Incorrect customs declaration was made',
        },
      },
      delayedDeparture: {
        summary: 'Delayed departure/arrival',
        value: {
          type: 'DELAYED_DEPARTURE',
          description: 'Departure or arrival was delayed',
        },
      },
      other: {
        summary: 'Other',
        value: {
          type: 'OTHER',
          description: 'Other issue not listed above',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Report submitted successfully',
    type: CreateIssueReportResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid report data',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'array',
          items: { type: 'string' },
          example: ['type must be one of the following values: PACKAGE_ISSUE, PAYMENT_PROBLEM, POLICY_VIOLATION, OTHER'],
        },
        error: { type: 'string', example: 'Bad Request' },
        statusCode: { type: 'number', example: 400 },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Shipment not found',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Shipment not found' },
        error: { type: 'string', example: 'Not Found' },
        statusCode: { type: 'number', example: 404 },
      },
    },
  })
  async createIssueReport(
    @CurrentUser() user: User,
    @Param('id') shipmentId: string,
    @Body() createDto: BoatCreateIssueReportBodyDto,
  ): Promise<CreateIssueReportResponseDto> {
    return this.boatsService.createIssueReport(user.id, {
      ...createDto,
      shipment_id: shipmentId,
    });
  }
}

