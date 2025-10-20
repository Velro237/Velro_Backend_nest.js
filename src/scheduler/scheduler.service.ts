import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { I18nService } from 'nestjs-i18n';
import { TripStatus } from 'generated/prisma/client';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly i18n: I18nService,
  ) {}

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
    } catch (error) {
      this.logger.error('[CRON ERROR] Alert Check failed:', error);
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
      const title = await this.i18n.translate(
        'translation.notification.alertMatch.title',
        {
          lang: 'en', // Default to English for now
        },
      );

      const message = await this.i18n.translate(
        'translation.notification.alertMatch.message',
        {
          lang: 'en', // Default to English for now
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
        'en',
      );

      // Send push notification if user has device_id
      if (alert.user.device_id) {
        await this.notificationService.sendPushNotification({
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
              trip.destination?.city || trip.destination?.country || 'Unknown',
            departureDate: trip.departure_date.toISOString(),
          },
        });
      }

      // Send email notification
      if (alert.user.email) {
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
            'en',
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
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async updateTripStatuses(): Promise<void> {
    const startTime = new Date();
    this.logger.log(
      `[CRON START] Trip Status Update - Running at ${startTime.toISOString()}`,
    );

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
    } catch (error) {
      this.logger.error('[CRON ERROR] Trip Status Update failed:', error);
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
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      this.logger.error(
        `[CRON ERROR] Cleanup Expired Data - Failed after ${duration}ms`,
        error,
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
}
