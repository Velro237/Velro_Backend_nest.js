# Email Queue and Processor Relationship

## Overview

The **Email Queue** and **Email Processor** work together using the **Producer-Consumer Pattern** with **BullMQ** (a Redis-based job queue system). They are two separate components that communicate through Redis.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Notification Service                      │
│  (When admin sends bulk emails)                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Calls addEmails()
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Email Queue (Producer)                    │
│  - Creates jobs in Redis                                     │
│  - Adds jobs to 'email-queue'                               │
│  - Manages job metadata                                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Jobs stored in Redis
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Redis (Message Broker)                    │
│  - Stores job queue: 'email-queue'                          │
│  - Job states: waiting, active, completed, failed            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Worker pulls jobs
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                 Email Processor (Consumer)                   │
│  - Listens to 'email-queue'                                  │
│  - Processes jobs (sends emails via Mailgun)                │
│  - Updates job status                                        │
└─────────────────────────────────────────────────────────────┘
```

## Key Connection Points

### 1. **Shared Queue Name**

Both components use the same queue name: `'email-queue'`

**Email Queue (line 49):**

```typescript
this.queue = new Queue('email-queue', {
  connection: this.connection,
  // ...
});
```

**Email Processor (line 84-85):**

```typescript
this.worker = new Worker<EmailJobData>(
  'email-queue', // ← Same queue name!
  async (job: Job<EmailJobData>) => {
    return await this.processEmail(job);
  },
  // ...
);
```

### 2. **Shared Redis Connection**

Both connect to the same Redis instance using the same configuration:

- Same `REDIS_URL` from environment
- Same connection settings
- Redis acts as the message broker between them

### 3. **Job Data Structure**

The job data structure is consistent between producer and consumer:

**Email Queue creates jobs with (lines 99-111):**

```typescript
await this.queue.add('send-email', {
  email: user.email,
  name: user.name,
  lang: user.lang || 'en',
  subject_en: templateData.subject_en,
  subject_fr: templateData.subject_fr,
  text_en: templateData.text_en,
  text_fr: templateData.text_fr,
  html_en: templateData.html_en,
  html_fr: templateData.html_fr,
});
```

**Email Processor receives the same structure (lines 13-23, 130-141):**

```typescript
interface EmailJobData {
  email: string;
  name?: string;
  lang?: string;
  subject_en: string;
  subject_fr: string;
  text_en?: string;
  text_fr?: string;
  html_en?: string;
  html_fr?: string;
}
```

## How They Work Together

### Step-by-Step Flow

1. **Admin sends bulk email** → `NotificationService.sendBulkEmail()`
2. **Service calls EmailQueue** → `emailQueue.addEmails(users, templateData)`
3. **EmailQueue creates jobs** → Each user becomes a job in Redis
4. **EmailProcessor Worker** → Automatically picks up jobs from Redis
5. **Worker processes job** → Calls `processEmail()` to send via Mailgun
6. **Job status updated** → Completed/Failed in Redis
7. **Stats available** → `EmailQueue.getQueueStats()` reads from Redis

### Example Flow

```typescript
// 1. Admin triggers bulk email
POST /notification/email/bulk
{
  "subject_en": "Hello",
  "subject_fr": "Bonjour",
  "html_en": "<p>Hello {{name}}</p>",
  "filter": "ALL"
}

// 2. NotificationService calls EmailQueue
await this.emailQueue.addEmails(users, templateData);
// → Creates 5000 jobs in Redis queue

// 3. EmailProcessor Worker (running in background)
// Automatically detects new jobs and processes them
// → Processes 5 emails concurrently
// → Rate limited to 50 emails/minute

// 4. Check stats
GET /notification/email/bulk/stats
// → Returns: waiting: 4950, active: 5, completed: 45, failed: 0
```

## Key Differences

| Aspect             | Email Queue (Producer)        | Email Processor (Consumer)         |
| ------------------ | ----------------------------- | ---------------------------------- |
| **Role**           | Creates jobs                  | Processes jobs                     |
| **Component**      | `Queue` from BullMQ           | `Worker` from BullMQ               |
| **When Active**    | When admin sends bulk email   | Continuously running in background |
| **Responsibility** | Add jobs to queue             | Execute jobs (send emails)         |
| **Access**         | Called by NotificationService | Runs independently                 |
| **Stats**          | Can read queue statistics     | Logs job completion/failure        |

## Configuration Alignment

Both components must have matching configurations:

### Redis Connection

- ✅ Same `REDIS_URL`
- ✅ Same connection settings
- ✅ Both use `maxRetriesPerRequest: null` (required for BullMQ)

### Queue Settings

- ✅ Same queue name: `'email-queue'`
- ✅ Job options (retries, backoff) set in Queue
- ✅ Worker respects these options

## Important Notes

1. **Decoupled Architecture**: Queue and Processor are separate services that can run on different servers
2. **Scalability**: You can run multiple workers to process jobs faster
3. **Reliability**: If processor crashes, jobs remain in Redis and will be processed when worker restarts
4. **Rate Limiting**: Worker enforces rate limits (50 emails/minute) to respect Mailgun limits
5. **Concurrency**: Worker processes 5 emails simultaneously for better throughput

## Lifecycle

### On Application Start

1. **EmailQueue.onModuleInit()** → Creates Queue, connects to Redis
2. **EmailProcessor.onModuleInit()** → Creates Worker, connects to Redis, starts listening

### During Operation

1. **EmailQueue** → Adds jobs as needed
2. **EmailProcessor** → Continuously processes jobs in background

### On Application Shutdown

1. **EmailQueue.onModuleDestroy()** → Closes queue connection
2. **EmailProcessor.onModuleDestroy()** → Closes worker, stops processing

## Summary

- **EmailQueue** = **Producer** (adds jobs to queue)
- **EmailProcessor** = **Consumer** (processes jobs from queue)
- **Redis** = **Message Broker** (stores and manages jobs)
- **BullMQ** = **Framework** (provides Queue and Worker classes)

They work together to enable asynchronous, scalable, and reliable bulk email sending without blocking the main application server.
