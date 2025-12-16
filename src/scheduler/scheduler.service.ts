import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { I18nService } from 'nestjs-i18n';
import { TripStatus } from 'generated/prisma/client';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly SCHEDULER_NOTIFICATION_EMAIL = 'kinslycho237@gmail.com';

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly i18n: I18nService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Helper method to send scheduler notification email
   */
  private async sendSchedulerNotification(
    schedulerName: string,
    status: 'START' | 'END' | 'ERROR',
    details?: string,
  ): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      const subject = `[Velro Scheduler] ${schedulerName} - ${status}`;
      const statusEmoji =
        status === 'START' ? '▶️' : status === 'END' ? '✅' : '❌';

      const text = `${statusEmoji} ${schedulerName}\nStatus: ${status}\nTime: ${timestamp}${details ? `\n\nDetails:\n${details}` : ''}`;

      const html = `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">${statusEmoji} ${schedulerName}</h2>
          <p><strong>Status:</strong> ${status}</p>
          <p><strong>Time:</strong> ${timestamp}</p>
          ${details ? `<div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;"><strong>Details:</strong><pre style="white-space: pre-wrap; font-family: monospace;">${details}</pre></div>` : ''}
        </div>
      `;

      await this.notificationService.sendEmail(
        {
          to: this.SCHEDULER_NOTIFICATION_EMAIL,
          subject,
          text,
          html,
        },
        'en',
      );
    } catch (error) {
      // Log error but don't throw - we don't want email failures to break schedulers
      this.logger.error(
        `Failed to send scheduler notification email for ${schedulerName}:`,
        error,
      );
    }
  }

  /**
   * Check for new trips created in the last hour and match them against alerts
   * Runs every hour at the top of the hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkAlertsForNewTrips(): Promise<void> {
    const startTime = new Date();
    this.logger.log(
      `[CRON START] Alert Check - Running at ${startTime.toISOString()}`,
    );

    await this.sendSchedulerNotification('Alert Check', 'START');

    try {
      // Get trips created in the last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const recentTrips = await this.prisma.trip.findMany({
        where: {
          // status: 'PUBLISHED',
          createdAt: {
            gte: oneHourAgo,
          },
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

      this.logger.log(
        `Found ${recentTrips.length} new trips to check against alerts`,
      );

      // Process each trip for alert matching
      for (const trip of recentTrips) {
        await this.checkAlertsForTrip(trip);
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      this.logger.log(
        `[CRON END] Alert Check - Completed in ${duration}ms at ${endTime.toISOString()}`,
      );
      await this.sendSchedulerNotification(
        'Alert Check',
        'END',
        `Completed in ${duration}ms`,
      );
    } catch (error) {
      this.logger.error('[CRON ERROR] Alert Check failed:', error);
      await this.sendSchedulerNotification(
        'Alert Check',
        'ERROR',
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Check alerts for a specific trip and create notifications for matches
   */
  private async checkAlertsForTrip(trip: any): Promise<void> {
    try {
      // Parse trip locations
      const tripDeparture = trip.departure as any;
      const tripDestination = trip.destination as any;

      if (!tripDeparture || !tripDestination) {
        this.logger.debug(
          `Trip ${trip.id} missing departure or destination data`,
        );
        return;
      }

      // Extract country from trip locations
      const tripDepartureCountry = tripDeparture.country || '';
      const tripDestinationCountry = tripDestination.country || '';

      console.log('tripDepartureCountry', tripDepartureCountry);
      console.log('tripDestinationCountry', tripDestinationCountry);

      if (!tripDepartureCountry && !tripDestinationCountry) {
        this.logger.debug(
          `Trip ${trip.id} missing country data in departure or destination`,
        );
        return;
      }

      // Build the where clause for matching alerts
      // Match if alert destination matches trip destination country OR alert departure matches trip departure country
      const alertWhereClause = {
        notificaction: true, // Only alerts with notification enabled
        user_id: { not: trip.user_id }, // Exclude trip creator's own alerts

        OR: [
          {
            depature: {
              mode: 'insensitive' as const,
              equals: tripDestinationCountry,
            },
          },
          {
            destination: {
              mode: 'insensitive' as const,
              equals: tripDestinationCountry,
            },
          },
          {
            depature: {
              mode: 'insensitive' as const,
              equals: tripDepartureCountry,
            },
          },
          {
            destination: {
              mode: 'insensitive' as const,
              equals: tripDepartureCountry,
            },
          },
        ],

        // Date range filter - if alert has date range, trip departure must be within it
        AND: [
          {
            OR: [
              // No date range specified (both dates are null)
              {
                AND: [{ form_date: null }, { to_date: null }],
              },
              // Only from_date specified (to_date is null)
              {
                AND: [
                  { form_date: { not: null } },
                  { to_date: null },
                  { form_date: { lte: trip.departure_date } },
                ],
              },
              // Only to_date specified (from_date is null)
              {
                AND: [
                  { form_date: null },
                  { to_date: { not: null } },
                  { to_date: { gte: trip.departure_date } },
                ],
              },
              // Both dates specified and trip departure is within range
              {
                AND: [
                  { form_date: { not: null } },
                  { to_date: { not: null } },
                  { form_date: { lte: trip.departure_date } },
                  { to_date: { gte: trip.departure_date } },
                ],
              },
            ],
          },
        ],
      };

      // Get matching alerts with user data in a single query
      const matchingAlerts = await this.prisma.alert.findMany({
        where: alertWhereClause,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              device_id: true,
              push_notification: true,
              email_notification: true,
            },
          },
        },
      });

      this.logger.log(
        `Found ${matchingAlerts.length} matching alerts for trip ${trip.id}`,
      );

      // Create notifications for all matching alerts
      if (matchingAlerts.length > 0) {
        await Promise.all(
          matchingAlerts.map((alert) =>
            this.createAlertNotification(alert, trip),
          ),
        );
      }
    } catch (error) {
      this.logger.error(`Error checking alerts for trip ${trip.id}:`, error);
    }
  }

  /**
   * Create notification and send push notification for alert match
   */
  private async createAlertNotification(alert: any, trip: any): Promise<void> {
    try {
      // Get alert user's language preference and normalize it
      const alertUser = await this.prisma.user.findUnique({
        where: { id: alert.user_id },
        select: { id: true, lang: true },
      });
      const userLangRaw = alertUser?.lang || 'en';
      // Normalize language to ensure it matches i18n format (lowercase)
      const userLang = userLangRaw ? userLangRaw.toLowerCase().trim() : 'en';
      // Ensure it's a valid language ('en' or 'fr'), default to 'en'
      const normalizedUserLang = userLang === 'fr' ? 'fr' : 'en';

      const title = await this.i18n.translate(
        'translation.notification.alertMatch.title',
        {
          lang: normalizedUserLang,
        },
      );

      const message = await this.i18n.translate(
        'translation.notification.alertMatch.message',
        {
          lang: normalizedUserLang,
          args: {
            tripCreator: trip.user.name || 'Unknown',
            departure:
              trip.departure?.city || trip.departure?.country || 'Unknown',
            destination:
              trip.destination?.city || trip.destination?.country || 'Unknown',
            departureDate: trip.departure_date.toLocaleDateString(),
          },
        },
      );

      // Create notification in database
      await this.notificationService.createNotification(
        {
          user_id: alert.user_id,
          title,
          message,
          type: 'ALERT',
          data: {
            tripId: trip.id,
            alertId: alert.id,
            departure: trip.departure,
            destination: trip.destination,
            departureDate: trip.departure_date,
            departureTime: trip.departure_time,
          },
        },
        normalizedUserLang,
      );

      // Send push notification if user has device_id and push_notification enabled (with user's language)
      if (alert.user.device_id && alert.user.push_notification) {
        await this.notificationService.sendPushNotification(
          {
            deviceId: alert.user.device_id,
            title,
            body: message,
            data: {
              tripId: trip.id,
              alertId: alert.id,
              type: 'ALERT',
              departure:
                trip.departure?.city || trip.departure?.country || 'Unknown',
              destination:
                trip.destination?.city ||
                trip.destination?.country ||
                'Unknown',
              departureDate: trip.departure_date.toISOString(),
            },
          },
          normalizedUserLang,
        );
      }

      // Send email notification if user has email_notification enabled
      if (alert.user.email && alert.user.email_notification) {
        try {
          const departureLocation =
            trip.departure?.city || trip.departure?.country || 'Unknown';
          const destinationLocation =
            trip.destination?.city || trip.destination?.country || 'Unknown';

          await this.notificationService.sendEmail(
            {
              to: alert.user.email,
              subject: title,
              text: message,
              html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #333;">${title}</h2>
                  <p style="color: #555; line-height: 1.6;">${message}</p>
                  <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <h3 style="color: #333; margin-top: 0;">Trip Details:</h3>
                    <p style="margin: 5px 0;"><strong>From:</strong> ${departureLocation}</p>
                    <p style="margin: 5px 0;"><strong>To:</strong> ${destinationLocation}</p>
                    <p style="margin: 5px 0;"><strong>Departure Date:</strong> ${trip.departure_date.toLocaleDateString()}</p>
                    <p style="margin: 5px 0;"><strong>Departure Time:</strong> ${trip.departure_time}</p>
                    <p style="margin: 5px 0;"><strong>Created by:</strong> ${trip.user.name}</p>
                  </div>
                  <p style="color: #777; font-size: 12px; margin-top: 30px;">
                    This is an automated notification from Velro. You received this because you set up an alert for trips matching this route.
                  </p>
                </div>
              `,
            },
            userLang,
          );

          this.logger.log(
            `Sent email notification to ${alert.user.email} for trip ${trip.id}`,
          );
        } catch (emailError) {
          this.logger.error(
            `Failed to send email to ${alert.user.email}:`,
            emailError,
          );
          // Don't throw error - email failure shouldn't stop the notification process
        }
      }

      this.logger.log(
        `Created alert notification for user ${alert.user_id} about trip ${trip.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Error creating alert notification for user ${alert.user_id}:`,
        error,
      );
    }
  }

  /**
   * Update trip statuses based on departure and arrival dates
   * Runs every day at the top of the hour
   */
  @Cron(CronExpression.EVERY_5_HOURS)
  async updateTripStatuses(): Promise<void> {
    const startTime = new Date();
    this.logger.log(
      `[CRON START] Trip Status Update - Running at ${startTime.toISOString()}`,
    );

    await this.sendSchedulerNotification('Trip Status Update', 'START');

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Update trips to COMPLETED (arrival_date < today)
      const completedResult = await this.prisma.trip.updateMany({
        where: {
          arrival_date: {
            not: null,
            lt: today,
          },
          status: {
            notIn: [TripStatus.COMPLETED, TripStatus.CANCELLED],
          },
        },
        data: {
          status: TripStatus.COMPLETED,
        },
      });

      this.logger.log(
        `Updated ${completedResult.count} trips to COMPLETED status`,
      );

      // Update trips to INPROGRESS (departure_date <= today AND (no arrival_date OR arrival_date >= today))
      const inProgressResult = await this.prisma.trip.updateMany({
        where: {
          departure_date: {
            lte: today,
          },
          OR: [{ arrival_date: null }, { arrival_date: { gte: today } }],
          status: {
            notIn: [
              TripStatus.INPROGRESS,
              TripStatus.COMPLETED,
              TripStatus.CANCELLED,
            ],
          },
        },
        data: {
          status: TripStatus.INPROGRESS,
        },
      });

      this.logger.log(
        `Updated ${inProgressResult.count} trips to INPROGRESS status`,
      );

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      const totalUpdated = completedResult.count + inProgressResult.count;
      this.logger.log(
        `[CRON END] Trip Status Update - Updated ${totalUpdated} trips in ${duration}ms at ${endTime.toISOString()}`,
      );
      await this.sendSchedulerNotification(
        'Trip Status Update',
        'END',
        `Updated ${totalUpdated} trips (${completedResult.count} COMPLETED, ${inProgressResult.count} INPROGRESS) in ${duration}ms`,
      );
    } catch (error) {
      this.logger.error('[CRON ERROR] Trip Status Update failed:', error);
      await this.sendSchedulerNotification(
        'Trip Status Update',
        'ERROR',
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Clean up expired pending users and OTPs
   * Runs every day at midnight
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredData(): Promise<void> {
    const startTime = new Date();
    this.logger.log(
      `[CRON START] Cleanup Expired Data - Running at ${startTime.toISOString()}`,
    );

    await this.sendSchedulerNotification('Cleanup Expired Data', 'START');

    try {
      const now = new Date();

      // Delete expired pending users
      const deletedPendingUsers = await this.prisma.pendingUser.deleteMany({
        where: {
          expiresAt: {
            lt: now,
          },
        },
      });

      this.logger.log(
        `[CRON] Deleted ${deletedPendingUsers.count} expired pending users`,
      );

      // Delete expired OTPs
      const deletedOTPs = await this.prisma.otp.deleteMany({
        where: {
          expiresAt: {
            lt: now,
          },
        },
      });

      this.logger.log(`[CRON] Deleted ${deletedOTPs.count} expired OTPs`);

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      this.logger.log(
        `[CRON END] Cleanup Expired Data - Completed in ${duration}ms`,
      );
      await this.sendSchedulerNotification(
        'Cleanup Expired Data',
        'END',
        `Deleted ${deletedPendingUsers.count} pending users and ${deletedOTPs.count} OTPs in ${duration}ms`,
      );
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      this.logger.error(
        `[CRON ERROR] Cleanup Expired Data - Failed after ${duration}ms`,
        error,
      );
      await this.sendSchedulerNotification(
        'Cleanup Expired Data',
        'ERROR',
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Manual trigger for testing purposes
   */
  async triggerAlertCheck(): Promise<void> {
    this.logger.log('[MANUAL TRIGGER] Alert Check - Initiated manually');
    await this.checkAlertsForNewTrips();
    this.logger.log('[MANUAL TRIGGER] Alert Check - Completed');
  }

  /**
   * Manual trigger for trip status update (testing purposes)
   */
  async triggerTripStatusUpdate(): Promise<void> {
    this.logger.log('[MANUAL TRIGGER] Trip Status Update - Initiated manually');
    await this.updateTripStatuses();
    this.logger.log('[MANUAL TRIGGER] Trip Status Update - Completed');
  }

  /**
   * Manual trigger for cleanup (testing purposes)
   */
  async triggerCleanup(): Promise<void> {
    this.logger.log('[MANUAL TRIGGER] Cleanup - Initiated manually');
    await this.cleanupExpiredData();
    this.logger.log('[MANUAL TRIGGER] Cleanup - Completed');
  }

  /**
   * Update CONFIRMED requests to IN_TRANSIT when departure date is today
   * Runs every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async updateConfirmedRequestsToInTransit(): Promise<void> {
    const startTime = new Date();
    this.logger.log(
      `[CRON START] Update Confirmed Requests to In Transit - Running at ${startTime.toISOString()}`,
    );

    await this.sendSchedulerNotification(
      'Update Confirmed Requests to In Transit',
      'START',
    );

    try {
      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);

      // Get all CONFIRMED requests with trip data where departure_date is today
      const requests = await this.prisma.tripRequest.findMany({
        where: {
          status: 'CONFIRMED',
          trip: {
            departure_date: {
              gte: today,
              lt: new Date(today.getTime() + 24 * 60 * 60 * 1000), // Less than tomorrow (today + 1 day)
            },
          },
        },
        include: {
          trip: {
            select: {
              id: true,
              departure_date: true,
            },
          },
        },
      });

      // Update all matching requests to IN_TRANSIT
      const updateResult = await this.prisma.tripRequest.updateMany({
        where: {
          id: {
            in: requests.map((r) => r.id),
          },
        },
        data: {
          status: 'IN_TRANSIT',
          updated_at: new Date(),
        },
      });

      this.logger.log(
        `Updated ${updateResult.count} CONFIRMED requests to IN_TRANSIT`,
      );

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      this.logger.log(
        `[CRON END] Update Confirmed Requests to In Transit - Completed in ${duration}ms at ${endTime.toISOString()}`,
      );
      await this.sendSchedulerNotification(
        'Update Confirmed Requests to In Transit',
        'END',
        `Updated ${updateResult.count} requests to IN_TRANSIT in ${duration}ms`,
      );
    } catch (error) {
      this.logger.error(
        '[CRON ERROR] Update Confirmed Requests to In Transit failed:',
        error,
      );
      await this.sendSchedulerNotification(
        'Update Confirmed Requests to In Transit',
        'ERROR',
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Update PENDING requests to EXPIRED when trip departure date is today
   * Runs daily at midnight
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async updatePendingRequestsToExpired(): Promise<void> {
    const startTime = new Date();
    this.logger.log(
      `[CRON START] Update Pending Requests to Expired - Running at ${startTime.toISOString()}`,
    );

    await this.sendSchedulerNotification(
      'Update Pending Requests to Expired',
      'START',
    );

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const updatedRequests = await this.prisma.tripRequest.updateMany({
        where: {
          status: 'PENDING',
          trip: {
            departure_date: {
              gte: today,
              lt: tomorrow,
            },
          },
        },
        data: {
          status: 'EXPIRED',
          updated_at: new Date(),
        },
      });

      this.logger.log(
        `Updated ${updatedRequests.count} PENDING requests to EXPIRED`,
      );

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      this.logger.log(
        `[CRON END] Update Pending Requests to Expired - Completed in ${duration}ms at ${endTime.toISOString()}`,
      );
      await this.sendSchedulerNotification(
        'Update Pending Requests to Expired',
        'END',
        `Updated ${updatedRequests.count} requests to EXPIRED in ${duration}ms`,
      );
    } catch (error) {
      this.logger.error(
        '[CRON ERROR] Update Pending Requests to Expired failed:',
        error,
      );
      await this.sendSchedulerNotification(
        'Update Pending Requests to Expired',
        'ERROR',
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
