# Email Failure Handling System

## Overview

The email queue system has a robust failure handling mechanism that automatically retries failed emails, tracks failures, and provides visibility into failed jobs.

## Failure Handling Flow

```
Email Job Fails
    ↓
Error Caught in processEmail()
    ↓
Error Re-thrown → BullMQ Detects Failure
    ↓
Retry Logic Triggered (if attempts remaining)
    ↓
Exponential Backoff Applied
    ↓
Job Retried (up to 3 attempts)
    ↓
If All Attempts Fail → Job Marked as Failed
    ↓
Failed Job Stored in Redis (7 days)
    ↓
Failure Logged & Tracked in Stats
```

## Retry Configuration

### Retry Settings (Email Queue)

Located in `src/notification/queues/email.queue.ts` (lines 51-56):

```typescript
defaultJobOptions: {
  attempts: 3,              // Try 3 times before giving up
  backoff: {
    type: 'exponential',     // Exponential backoff strategy
    delay: 2000,            // Initial delay: 2 seconds
  },
}
```

### Retry Attempts Timeline

| Attempt           | Delay Before Retry | Total Time Since First Attempt |
| ----------------- | ------------------ | ------------------------------ |
| 1st (initial)     | -                  | 0s                             |
| 2nd (1st retry)   | 2s                 | 2s                             |
| 3rd (2nd retry)   | 4s (2² × 2s)       | 6s                             |
| 4th (3rd retry)   | 8s (2³ × 2s)       | 14s                            |
| **Final Failure** | -                  | After 3 attempts               |

**Note**: With `attempts: 3`, the job will be tried 3 times total (1 initial + 2 retries).

## Error Handling in Processor

### Error Detection (Email Processor)

Located in `src/notification/processors/email.processor.ts` (lines 181-199):

```typescript
try {
  await this.mailgunClient.messages.create(mailgunDomain, {
    from: mailgunFromEmail,
    to: email,
    subject: subject,
    text: text,
    html: html,
  });
  // Success - job completes
} catch (error: any) {
  // Log the error
  this.logger.error(
    `Failed to send email to ${email}: ${error.message}`,
    error.stack,
  );
  // Re-throw to trigger BullMQ retry mechanism
  throw error;
}
```

### Key Points

1. **Error Re-throwing**: Errors are re-thrown to signal BullMQ that the job failed
2. **Error Logging**: All failures are logged with email address and error message
3. **Stack Traces**: Full stack traces are logged for debugging

## Failure Event Handling

### Worker Event Handlers

Located in `src/notification/processors/email.processor.ts` (lines 99-112):

```typescript
// Success handler
this.worker.on('completed', (job) => {
  this.logger.log(`Email sent successfully to ${job.data.email}`);
});

// Failure handler
this.worker.on('failed', (job, err) => {
  this.logger.error(
    `Failed to send email to ${job?.data?.email}: ${err.message}`,
  );
});

// Worker error handler
this.worker.on('error', (err) => {
  this.logger.error(`Email worker error: ${err.message}`);
});
```

### Event Types

1. **`completed`**: Job succeeded (email sent)
2. **`failed`**: Job failed after all retry attempts exhausted
3. **`error`**: Worker-level error (not job-specific)

## Failed Job Storage

### Retention Policy

Located in `src/notification/queues/email.queue.ts` (lines 61-63):

```typescript
removeOnFail: {
  age: 7 * 24 * 3600,  // Keep failed jobs for 7 days
}
```

**Benefits**:

- Failed jobs are retained for 7 days for investigation
- Allows manual retry of failed jobs if needed
- Provides audit trail of failures

## Failure Tracking & Statistics

### Queue Statistics

The system tracks failed jobs and makes them available via the stats endpoint:

**Endpoint**: `GET /notification/email/bulk/stats`

**Response includes**:

```json
{
  "waiting": 150,
  "active": 5,
  "completed": 4850,
  "failed": 10, // ← Failed jobs count
  "total": 5015,
  "successRate": 96.8,
  "failureRate": 0.2 // ← Failure percentage
}
```

### Statistics Implementation

Located in `src/notification/queues/email.queue.ts` (lines 126-141):

```typescript
async getQueueStats() {
  const [waiting, active, completed, failed] = await Promise.all([
    this.queue.getWaitingCount(),
    this.queue.getActiveCount(),
    this.queue.getCompletedCount(),
    this.queue.getFailedCount(),  // ← Failed jobs count
  ]);

  return {
    waiting,
    active,
    completed,
    failed,  // ← Available in stats
    total: waiting + active + completed + failed,
  };
}
```

## Common Failure Scenarios

### 1. Mailgun API Errors

**Causes**:

- Invalid API key
- Rate limit exceeded
- Invalid domain
- Network issues

**Handling**:

- Error caught and logged
- Job retried with exponential backoff
- After 3 attempts, marked as failed

**Example Error**:

```
Failed to send email to user@example.com: Mailgun API error: Rate limit exceeded
```

### 2. Configuration Errors

**Causes**:

- `MAILGUN_CLIENT` not initialized
- `MAILGUN_DOMAIN` not configured

**Handling**:

- Error thrown immediately
- Job fails on first attempt (no retry for config errors)
- Logged as critical error

**Example Error**:

```
Failed to send email to user@example.com: Mailgun client not initialized
```

### 3. Validation Errors

**Causes**:

- Missing email content for selected language
- Invalid email format

**Handling**:

- Error thrown during processing
- Job retried (may succeed if transient)
- After retries, marked as failed

**Example Error**:

```
Failed to send email to user@example.com: Either text_fr or html_fr content must be provided
```

### 4. Network/Timeout Errors

**Causes**:

- Network connectivity issues
- Mailgun service timeout
- DNS resolution failures

**Handling**:

- Error caught and logged
- Job retried with exponential backoff
- Good chance of success on retry

**Example Error**:

```
Failed to send email to user@example.com: Network timeout
```

## Failure Recovery Strategies

### Automatic Recovery

1. **Retry with Backoff**: Transient errors are automatically retried
2. **Exponential Backoff**: Prevents overwhelming the service during outages
3. **Rate Limiting**: Worker respects Mailgun rate limits (50 emails/minute)

### Manual Recovery

1. **View Failed Jobs**: Check stats endpoint for failure count
2. **Investigate Logs**: Review error logs for specific failure reasons
3. **Re-queue Failed Jobs**: (If needed, can be implemented) Manually retry specific failed jobs

## Monitoring Failed Jobs

### Logs to Monitor

1. **Worker Failure Logs**:

   ```
   [EmailProcessor] Failed to send email to user@example.com: Error message
   ```

2. **Worker Error Logs**:

   ```
   [EmailProcessor] Email worker error: Worker-level error message
   ```

3. **Stats Endpoint**:
   - Monitor `failed` count
   - Monitor `failureRate` percentage
   - Set up alerts for high failure rates

### Recommended Alerts

- **High Failure Rate**: Alert if `failureRate > 5%`
- **Consecutive Failures**: Alert if 10+ jobs fail in a row
- **Worker Errors**: Alert on any worker-level errors

## Best Practices

### 1. Monitor Failure Rates

Regularly check the stats endpoint:

```bash
GET /notification/email/bulk/stats
```

### 2. Review Error Logs

Check application logs for specific failure reasons:

```bash
# Look for EmailProcessor error logs
grep "EmailProcessor" logs/app.log | grep "Failed"
```

### 3. Investigate Patterns

If failures are clustered:

- **Time-based**: May indicate service outage
- **Email-based**: May indicate invalid email addresses
- **Content-based**: May indicate template issues

### 4. Handle Permanent Failures

Some failures are permanent and won't succeed on retry:

- Invalid email addresses
- Configuration errors
- Missing content

These will fail all 3 attempts and should be investigated manually.

## Configuration Summary

| Setting            | Value         | Purpose                     |
| ------------------ | ------------- | --------------------------- |
| `attempts`         | 3             | Total retry attempts        |
| `backoff.type`     | `exponential` | Backoff strategy            |
| `backoff.delay`    | 2000ms        | Initial retry delay         |
| `removeOnFail.age` | 7 days        | Failed job retention        |
| `concurrency`      | 5             | Concurrent email processing |
| `limiter.max`      | 50/min        | Rate limit protection       |

## Example Failure Scenario

```
1. Admin sends bulk email to 5000 users
2. Job created for user@example.com
3. First attempt: Mailgun API timeout
   → Error logged: "Failed to send email to user@example.com: Network timeout"
   → Job retried after 2 seconds
4. Second attempt: Mailgun API timeout
   → Error logged again
   → Job retried after 4 seconds
5. Third attempt: Success!
   → Email sent successfully
   → Job marked as completed
```

**If all attempts fail**:

```
1-3. All attempts fail
4. Job marked as failed
5. Failed job stored in Redis (7 days)
6. Stats endpoint shows: failed: 1
7. Admin can investigate via logs
```

## Summary

The system handles failures through:

1. ✅ **Automatic Retries**: 3 attempts with exponential backoff
2. ✅ **Error Logging**: Comprehensive error logging with stack traces
3. ✅ **Failure Tracking**: Failed jobs counted in statistics
4. ✅ **Job Retention**: Failed jobs kept for 7 days
5. ✅ **Event Handling**: Worker events for monitoring
6. ✅ **Rate Limiting**: Prevents overwhelming Mailgun API

This ensures maximum email delivery reliability while providing visibility into failures for investigation and resolution.
