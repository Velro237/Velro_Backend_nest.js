import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class AlertSchedulerService {
  private readonly logger = new Logger(AlertSchedulerService.name);

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
    this.logger.log('Starting hourly alert check for new trips');

    try {
      // Get trips created in the last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const recentTrips = await this.prisma.trip.findMany({
        where: {
          status: 'PUBLISHED',
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

      this.logger.log('Completed hourly alert check');
    } catch (error) {
      this.logger.error('Error during hourly alert check:', error);
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

      // Create location search strings for database query
      const tripDepartureStr = JSON.stringify(tripDeparture).toLowerCase();
      const tripDestinationStr = JSON.stringify(tripDestination).toLowerCase();

      // Extract city and country from trip locations for more precise matching
      const tripDepartureCity = tripDeparture.city?.toLowerCase() || '';
      const tripDepartureCountry = tripDeparture.country?.toLowerCase() || '';
      const tripDepartureAddress = tripDeparture.address?.toLowerCase() || '';
      const tripDestinationCity = tripDestination.city?.toLowerCase() || '';
      const tripDestinationCountry =
        tripDestination.country?.toLowerCase() || '';
      const tripDestinationAddress =
        tripDestination.address?.toLowerCase() || '';

      // Build the where clause for matching alerts
      const alertWhereClause = {
        notificaction: true, // Only alerts with notification enabled
        user_id: { not: trip.user_id }, // Exclude trip creator's own alerts
        OR: [
          // Departure matches
          {
            depature: {
              mode: 'insensitive' as const,
              in: [
                tripDepartureStr,
                tripDepartureCity,
                tripDepartureCountry,
                tripDepartureAddress,
              ].filter(Boolean),
            },
          },
          // Destination matches
          {
            destination: {
              mode: 'insensitive' as const,
              in: [
                tripDestinationStr,
                tripDestinationCity,
                tripDestinationCountry,
                tripDestinationAddress,
              ].filter(Boolean),
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
   * Manual trigger for testing purposes
   */
  async triggerAlertCheck(): Promise<void> {
    this.logger.log('Manually triggering alert check');
    await this.checkAlertsForNewTrips();
  }
}
