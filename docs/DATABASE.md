# Velro Backend — Database Documentation

Technical reference for the Velro NestJS backend database. Use this as the single source of truth for schema, relations, enums, and workflows.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Configuration & Connection](#2-configuration--connection)
3. [Schema Overview](#3-schema-overview)
4. [Models by Domain](#4-models-by-domain)
5. [Enums Reference](#5-enums-reference)
6. [Indexes & Constraints](#6-indexes--constraints)
7. [Migrations](#7-migrations)
8. [Usage in Application](#8-usage-in-application)

---

## 1. Overview

| Item | Value |
|------|--------|
| **ORM** | Prisma |
| **Database** | PostgreSQL |
| **Schema location** | `prisma/schema.prisma` |
| **Generated client** | `generated/prisma` |
| **Injection** | `PrismaService` (NestJS, app-wide) |

The schema covers:

- **Users & auth** — registration, OTP, roles, KYC, accounts
- **Trips & trip requests** — traveler trips, items, requests, ratings
- **Shopping** — shopping requests, products, offers, purchase proofs, delivery tracking
- **Shipping** — shipping requests and shipping offers
- **Payments & wallet** — wallet, transactions, deliveries (reward flow)
- **Chat & messaging** — chats (trip/shopping/shipping), members, messages
- **Support** — reports, notifications, alerts, account deletion, logging

---

## 2. Configuration & Connection

### Environment

- **Variable:** `DATABASE_URL`
- **Format:** `postgresql://USER:PASSWORD@HOST:PORT/DATABASE`
- **Example (local):** `postgresql://velro:velro@localhost:5432/velro`
- **Docker (dev):** See `docker-compose.dev.yml` — e.g. `postgres://velro:velro@dev-db:5432/velro`

### Prisma config (schema.prisma)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider      = "prisma-client-js"
  output        = "../generated/prisma"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x", "linux-musl-arm64-openssl-3.0.x"]
}
```

- Client is generated into `generated/prisma` (not `node_modules`).
- Imports use: `import { PrismaClient } from 'generated/prisma';`

### Application wiring

- **Module:** `PrismaModule` (`src/prisma/prisma.module.ts`) — exports `PrismaService`.
- **Service:** `PrismaService` extends `PrismaClient`, connects in `onModuleInit()`.
- **Usage:** Inject `PrismaService` in any service; use `this.prisma.*` for all models.

---

## 3. Schema Overview

### Entity relationship (high level)

```
User (center)
├── Account, RefreshToken, Wallet, UserKYC, WithdrawalNumber
├── Trip (traveler) → TripRequest, TripItemsList, Rating, Report
├── ShoppingRequest → Product, Offer → PurchaseProof, DeliveryTracking
├── ShippingRequest → ShippingOffer
├── Delivery → DeliveryProduct, Transaction
├── Chat (via ChatMember) → Message
├── Notification, Alert, Report (reporter/reported/replier)
└── Transaction (wallet, trip, request, delivery)

PendingUser (pre-registration)
├── CompanyCity, CompanyService (M:N)
└── linked to Otp (by otp_id, not FK in schema)
```

### Naming conventions

- **Tables:** PascalCase (Prisma default) → e.g. `TripRequest`, `ShippingOffer`.
- **IDs:** `id` (UUID or CUID); FKs often `userId`, `trip_id`, `request_id`, etc.
- **Timestamps:** `createdAt`/`updatedAt` or `created_at`/`updated_at` (legacy mix).

---

## 4. Models by Domain

### 4.1 Users & Auth

#### User

Core app user (traveler, shopper, shipper).

| Field | Type | Notes |
|-------|------|--------|
| id | String (UUID) | PK |
| email | String | Required |
| password | String | Hashed |
| role | UserRole | USER \| ADMIN |
| name, firstName, lastName | String? | Profile |
| picture, phone, address, city, state, zip | String? | |
| companyName, companyAddress | String? | Business |
| isFreightForwarder | Boolean | Default false |
| stripe_account_id | String? | Unique, Stripe Connect |
| stripe_onboarding_complete | Boolean | |
| currency, payout_country, payout_currency | String? | |
| date_of_birth, lang, username | String? / DateTime? | |
| last_seen | DateTime? | |
| is_suspended, is_deleted | Boolean | |
| flag_count | Int | |
| status_message_en, status_message_fr | String? | |
| email_notification, push_notification, sms_notification | Boolean | |
| otpCode | String? | |

Relations: Account, RefreshToken, Wallet, UserKYC, WithdrawalNumber, Trip, TripRequest, ShoppingRequest, ShippingRequest, Offer, ShippingOffer, Delivery, ChatMember, Message, Notification, Alert, Rating, Report, PurchaseProof, Transaction, TravelerStrike, AccountDeleteRequest, CompanyCity, CompanyService.

#### PendingUser

Pre-registration (e.g. signup flow with OTP).

| Field | Type | Notes |
|-------|------|--------|
| id | String (UUID) | PK |
| email | String | |
| otp_id | String | References Otp (logical) |
| expiresAt | DateTime | |
| firstName, lastName, phone, city, companyName, companyAddress | String? | |
| additionalInfo | String | |
| isFreightForwarder | Boolean | |
| username, lang, businessType, country | String? | |

Relations: CompanyCity[], CompanyService[] (M:N).

#### Account

OAuth / social login (e.g. Google, Apple).

| Field | Type | Notes |
|-------|------|--------|
| id | String (CUID) | PK |
| userId | String | FK → User |
| provider | Provider | GOOGLE \| APPLE |
| providerAccountId | String | |
| accessToken, refreshToken, idToken | String? | |
| expiresAt | DateTime? | |

Unique: `[provider, providerAccountId]`.

#### RefreshToken

JWT refresh tokens.

| Field | Type | Notes |
|-------|------|--------|
| id | String (CUID) | PK |
| userId | String | FK → User |
| token | String | Unique |
| revoked | Boolean | Default false |
| expiresAt | DateTime | |

#### Otp

One-time codes (login, signup, forgot password, verify email).

| Field | Type | Notes |
|-------|------|--------|
| id | String (UUID) | PK |
| code | String | |
| email, phone | String? | |
| type | OtpType | LOGIN \| SIGNUP \| FORGOT_PASSWORD \| VERIFY_EMAIL |
| expiresAt | DateTime | |
| verified | Boolean | Default false |
| access_key | String? | Unique |

#### UserKYC

KYC verification (e.g. Didit).

| Field | Type | Notes |
|-------|------|--------|
| id | String (UUID) | PK |
| userId | String | FK → User |
| status | KYCStatus | NOT_STARTED \| IN_PROGRESS \| APPROVED \| ... |
| provider | KYCProvider | DIDIT \| OTHER |
| diditSessionId | String? | Unique |
| verificationData, rejectionReason | Json? / String? | |
| verifiedAt, expiresAt | DateTime? | |

Unique: `[userId, provider]`.

#### WithdrawalNumber

User’s payout phone numbers (e.g. mobile money).

| Field | Type | Notes |
|-------|------|--------|
| id | String (UUID) | PK |
| user_id | String | FK → User |
| number, carrier, name | String | |

#### CompanyCity, CompanyService

Many-to-many with User and PendingUser (company locations and services).

---

### 4.2 Trips & Trip Requests

#### Trip

Traveler’s planned trip (flight/travel).

| Field | Type | Notes |
|-------|------|--------|
| id | String (UUID) | PK |
| user_id | String | FK → User (traveler) |
| airline_id | String | FK → Airline |
| mode_of_transport_id | String? | FK → TransportType |
| status | TripStatus | PUBLISHED \| SCHEDULED \| ... |
| departure_date, departure_time | DateTime, String | |
| arrival_date, arrival_time | DateTime?, String? | |
| pickup, destination, departure, delivery | Json? | Locations / details |
| maximum_weight_in_kg | Decimal? | |
| currency | Currency | Default USD |
| notes | String? | |
| meetup_flexible | Boolean | Default false |
| fully_booked | Boolean | Default false |
| is_deleted | Boolean | Soft delete |

Relations: TripItemsList[], TripRequest[], Chat[], Rating[], Report[], Transaction[].

#### Airline

Lookup for trips.

| Field | Type | Notes |
|-------|------|--------|
| id | String (UUID) | PK |
| name | String | Unique |
| description | String? | |

#### TransportType

Mode of transport (e.g. car, flight).

| Field | Type | Notes |
|-------|------|--------|
| id | String (UUID) | PK |
| name | String | Unique |
| description | String? | |

#### TripItem

Catalog of items that can be carried (with translations).

| Field | Type | Notes |
|-------|------|--------|
| id | String (UUID) | PK |
| name | String | Unique |
| description | String? | |
| image_id | String? | FK → Image |

Relations: Translation[], TripItemsList[], TripRequestItem[].

#### Translation

Per-item, per-language names/descriptions.

| Field | Type | Notes |
|-------|------|--------|
| id | String (UUID) | PK |
| trip_item_id | String? | FK → TripItem |
| language | Language | en \| fr |
| name, description | String? | |

Unique: `[trip_item_id, language]`.

#### TripItemsList

Items and capacity offered on a trip (with optional per-currency prices).

| Field | Type | Notes |
|-------|------|--------|
| trip_id, trip_item_id | String | Composite PK, FK → Trip, TripItem |
| price | Decimal | Base price |
| avalailble_kg | Decimal? | Available weight |

Relations: TripItemsListPrice[].

#### TripItemsListPrice

Price per currency for a trip item.

| Field | Type | Notes |
|-------|------|--------|
| trip_id, trip_item_id, currency | String, Currency | Composite PK |
| price | Decimal | |

#### TripRequest

Sender’s request to use a trip (carry items).

| Field | Type | Notes |
|-------|------|--------|
| id | String (UUID) | PK |
| trip_id, user_id | String | FK → Trip, User |
| status | RequestStatus | PENDING \| ACCEPTED \| DELIVERED \| ... |
| cost, currency | Decimal?, Currency? | |
| payment_intent_id | String? | Unique (Stripe) |
| payment_status | PaymentStatus? | |
| sender_confirmed_delivery, traveler_confirmed_delivery | Boolean | |
| chat_id | String? | Unique, FK → Chat |
| cancellation_reason, cancellation_type, cancelled_at | String? / DateTime? | |
| message | String? | |
| is_deleted | Boolean | Soft delete |

Relations: TripRequestItem[], TripRequestImage[], Message[], Rating[], Report[], Transaction[], Chat.

#### TripRequestItem

Line item: which trip item and quantity.

| Field | Type | Notes |
|-------|------|--------|
| request_id, trip_item_id | String | Composite PK |
| quantity | Int | |
| special_notes | String? | |

#### TripRequestImage

Images attached to a trip request.

| Field | Type | Notes |
|-------|------|--------|
| trip_request_id, image_id | String | Composite PK |

#### Image

Reusable image (URL + optional alt).

| Field | Type | Notes |
|-------|------|--------|
| id | String (UUID) | PK |
| object_id | String | Logical owner id |
| url | String | |
| alt_text | String? | |

Used by: TripItem, TripRequestImage, PurchaseProof (ProofImage), etc.

---

### 4.3 Shopping (Requests, Products, Offers, Proofs)

#### ShoppingRequest

User’s request to have items bought and delivered.

| Field | Type | Notes |
|-------|------|--------|
| id | String (UUID) | PK |
| user_id | String | FK → User |
| version, current_version | Int | Versioning |
| source | RequestSource | WEBVIEW \| URL \| MANUAL |
| deliver_to | String | Destination |
| delivery_timeframe | DeliveryTimeframe | ONE_WEEK \| TWO_WEEKS \| ... |
| product_price, product_currency | Decimal, Currency | |
| traveler_reward, platform_fee, additional_fees | Decimal | |
| total_cost, reward_currency | Decimal, Currency | |
| suggested_reward_percentage | Decimal | Default 15 |
| status | ShoppingRequestStatus | PUBLISHED \| OFFER_ACCEPTED \| PAID \| ... |
| expires_at | DateTime? | |
| additional_notes, purchase_proof_url | String? / DateTime? | |
| paid_at, bought_at, delivered_at, completed_at, cancelled_at | DateTime? | |
| cancelled_by_id | String? | |

Relations: Product[], Offer[], Chat[], DeliveryTracking?, Rating[], User.

#### Product

Product linked to a shopping request.

| Field | Type | Notes |
|-------|------|--------|
| id | String (UUID) | PK |
| shopping_request_id | String | FK → ShoppingRequest |
| name, description | String, String? | |
| source | ProductSource | AMAZON \| SHEIN \| ... |
| url, image_urls | String?, String[] | |
| price, price_currency | Decimal, Currency | |
| weight | Decimal? | |
| quantity | Int | Default 1 |
| variants | Json? | |
| in_stock | Boolean | Default true |
| availability_text | String? | |

#### Offer

Traveler’s offer to fulfill a shopping request.

| Field | Type | Notes |
|-------|------|--------|
| id | String (UUID) | PK |
| shopping_request_id, traveler_id | String | FK → ShoppingRequest, User |
| request_version | Int | Snapshot of request version |
| reward_amount, reward_currency | Decimal, Currency | |
| additional_fees | Decimal | Default 0 |
| travel_date | DateTime? | |
| message | String? | |
| status | OfferStatus | PENDING \| ACCEPTED \| REJECTED \| ... |
| chat_id | String? | Unique, FK → Chat |
| accepted_at, rejected_at, cancelled_at | DateTime? | |

Relations: PurchaseProof[], Chat, ShoppingRequest, User.

#### PurchaseProof

Proof of purchase (receipts, product photos).

| Field | Type | Notes |
|-------|------|--------|
| id | String (UUID) | PK |
| offer_id | String? | FK → Offer |
| uploader_id | String | FK → User |
| status | ProofStatus | PENDING \| APPROVED \| REJECTED |
| primary_receipt_image_id | String? | FK → Image |
| metadata | Json? | |

Relations: ProofImage[], ProofVerification[], Offer, User, Image.

#### ProofImage

Links proof to images with type and order.

| Field | Type | Notes |
|-------|------|--------|
| id | String (UUID) | PK |
| proof_id, image_id | String | FK → PurchaseProof, Image |
| type | ProofImageType | RECEIPT \| PRODUCT_PHOTO |
| ord | Int? | Order |

#### ProofVerification

Verification decision on a proof.

| Field | Type | Notes |
|-------|------|--------|
| id | String (UUID) | PK |
| proof_id | String | FK → PurchaseProof |
| verified_by | String? | |
| decision | ProofDecision | APPROVE \| REJECT |
| reason | String? | |

#### DeliveryTracking

Delivery state for a shopping request (e.g. marked delivered, auto-release).

| Field | Type | Notes |
|-------|------|--------|
| id | String (UUID) | PK |
| shopping_request_id | String | Unique, FK → ShoppingRequest |
| marked_delivered_at, auto_release_at | DateTime? | |
| confirmed_at, confirmed_by | DateTime?, String? | |
| issue_reported, issue_reported_at, issue_reported_by | Boolean, DateTime?, String? | |

#### TravelerStrike

Strike/ban for traveler (e.g. after cancellation).

| Field | Type | Notes |
|-------|------|--------|
| id | String (UUID) | PK |
| traveler_id | String | FK → User |
| offer_id, shopping_request_id | String | |
| cancelled_at | DateTime | |
| is_banned, banned_at | Boolean, DateTime? | |

---

### 4.4 Shipping (Requests & Offers)

#### ShippingRequest

User’s request to ship a package.

| Field | Type | Notes |
|-------|------|--------|
| id | String (UUID) | PK |
| user_id | String | FK → User |
| category | ShippingCategory | LAPTOP \| PHONE \| DOCUMENTS \| ... |
| package_photo_urls | String[] | |
| package_description, details_description | String, String? | |
| from, to | String | |
| delivery_timeframe | ShippingDeliveryTimeframe | WITHIN_3_DAYS \| ... |
| weight | ShippingWeight | UNDER_1KG \| ... |
| packaging | Boolean | Default false |
| traveler_reward, reward_currency | Decimal, Currency? | |
| status | ShippingRequestStatus | PUBLISHED \| OFFER_ACCEPTED \| ... |

Relations: ShippingOffer[], Chat[], User.

#### ShippingOffer

Traveler’s offer to fulfill a shipping request.

| Field | Type | Notes |
|-------|------|--------|
| id | String (UUID) | PK |
| shipping_request_id, traveler_id | String | FK → ShippingRequest, User |
| reward_amount, reward_currency | Decimal, Currency? | |
| travel_date | DateTime? | |
| message | String? | |
| status | OfferStatus | |
| chat_id | String? | Unique, FK → Chat |
| accepted_at, rejected_at, cancelled_at, delivered_at | DateTime? | |

Relations: ShippingRequest, User, Chat.

---

### 4.5 Wallet & Transactions

#### Wallet

One per user; multi-currency balances.

| Field | Type | Notes |
|-------|------|--------|
| id | String (UUID) | PK |
| userId | String | Unique, FK → User |
| available_balance, hold_balance, total_balance | Decimal | |
| state | WalletState | ACTIVE \| BLOCKED |
| currency | String | Default "XAF" |
| available_balance_* / hold_balance_* | Decimal | CAD, EUR, USD, XAF |

Relations: Transaction[], User.

#### Transaction

All wallet-related movements.

| Field | Type | Notes |
|-------|------|--------|
| id | String (UUID) | PK |
| userId, wallet_id | String | FK → User, Wallet |
| trip_id, request_id | String? | FK → Trip, TripRequest (when applicable) |
| type | TransactionType | CREDIT \| DEBIT |
| status | TransactionStatus | PENDING \| SUCCESS \| ... |
| source | TransactionSource | ORDER \| WITHDRAW \| REFUND \| ... |
| provider | TransactionProvider | MTN \| ORANGE \| STRIPE |
| amount_paid, amount_requested | Decimal | |
| currency, fee_applied | String, Decimal | |
| reference | String? | Unique |
| stripe_account_id, stripe_transfer_id | String? | stripe_transfer_id unique |
| phone_number, provider_id | String? | Mobile money |
| processedAt, balance_after | DateTime?, Decimal? | |
| description, status_message, metadata | String? / Json? | |

Relations: User, Wallet, Trip?, TripRequest?, Delivery?.

#### Delivery

Reward/delivery tracking for a user (linked to transaction when paid).

| Field | Type | Notes |
|-------|------|--------|
| id | String (CUID) | PK |
| userId | String | FK → User |
| total_cost | Decimal | |
| currency | Currency | |
| status | DeliveryStatus | PENDING \| ONGOING \| EXPIRED |
| reward | Int | Default 15 |
| expected_date | DateTime | |
| transaction_id | String? | Unique, FK → Transaction |
| description, data | String?, Json? | |
| is_deleted | Boolean | Soft delete |

Relations: DeliveryProduct[], User, Transaction?.

#### DeliveryProduct

Line item in a delivery (product + price/weight).

| Field | Type | Notes |
|-------|------|--------|
| id | String (CUID) | PK |
| deliveryId | String | FK → Delivery |
| name, description | String, String? | |
| price, currency | Decimal, Currency | |
| url, weight | String?, Decimal? | |
| quantity | Int? | |

---

### 4.6 Chat & Messaging

#### Chat

Conversation linked to a trip, shopping request, or shipping request.

| Field | Type | Notes |
|-------|------|--------|
| id | String (UUID) | PK |
| type | ChatType | TRIP \| SUPPORT \| SHOPPING \| SHIPPING |
| trip_id | String? | FK → Trip (TRIP) |
| shopping_request_id | String? | FK → ShoppingRequest (SHOPPING) |
| shipping_request_id | String? | FK → ShippingRequest (SHIPPING) |
| name | String? | |
| is_flagged | Boolean | Default false |

Relations: ChatMember[], Message[], Trip?, ShoppingRequest?, ShippingRequest?, Offer?, ShippingOffer?, TripRequest? (reverse).

#### ChatMember

User membership in a chat.

| Field | Type | Notes |
|-------|------|--------|
| id | String (UUID) | PK |
| chat_id, user_id | String | FK → Chat, User |
| joinedAt | DateTime | |

Unique: `[user_id, chat_id]`.

#### Message

Single message in a chat.

| Field | Type | Notes |
|-------|------|--------|
| id | String (UUID) | PK |
| chat_id, sender_id | String | FK → Chat, User |
| content | String? | |
| image_url | String? | |
| type | MessageType | TEXT \| IMAGE \| REQUEST \| PAYMENT \| SYSTEM \| ... |
| request_id | String? | FK → TripRequest (when type relates to request) |
| reply_to_id | String? | FK → Message (thread) |
| review_id | String? | |
| data | Json? | |
| isRead, is_flagged | Boolean | |

---

### 4.7 Support & System

#### Report

User reports (e.g. about trip, request, or another user).

| Field | Type | Notes |
|-------|------|--------|
| id | String (UUID) | PK |
| user_id | String | Reporter, FK → User |
| reported_id | String | Reported user, FK → User |
| trip_id | String | FK → Trip |
| request_id | String? | FK → TripRequest |
| type | ReportType | COMMUNICATION_PROBLEM \| PACKAGE_ISSUE \| ... |
| priority | ReportPriority | HIGH \| LOW |
| status | ReportStatus | PENDING \| REPLIED \| ... |
| reply_to_id | String? | FK → Report (thread) |
| replied_by | String? | FK → User (admin/support) |
| text, data, images | String?, Json? | |

#### Rating

Rating from one user to another (trip or shopping request).

| Field | Type | Notes |
|-------|------|--------|
| id | String (UUID) | PK |
| giver_id, receiver_id | String | FK → User |
| trip_id | String? | FK → Trip |
| request_id | String? | FK → TripRequest |
| shopping_request_id | String? | FK → ShoppingRequest |
| rating | Int | Score |
| comment | String? | |

Unique: `[giver_id, receiver_id, trip_id]`.

#### Notification

In-app notification for a user.

| Field | Type | Notes |
|-------|------|--------|
| id | String (UUID) | PK |
| user_id | String | FK → User |
| title, message | String | |
| type | NotificationType | SYSTEM \| REQUEST \| ALERT |
| data | Json? | |
| read, read_at | Boolean, DateTime? | |
| request_id, trip_id | String? | Optional links |

#### Alert

User-defined travel alert (e.g. departure/destination/dates).

| Field | Type | Notes |
|-------|------|--------|
| id | String (UUID) | PK |
| user_id | String | FK → User |
| depature, destination | String | |
| form_date, to_date | DateTime? | |
| notificaction | Boolean | Default true |

#### AccountDeleteRequest

User request to delete account.

| Field | Type | Notes |
|-------|------|--------|
| id | String (UUID) | PK |
| user_id | String | FK → User |
| email | String | |
| reason | String? | |
| status | deleteRequestStatus | PENDING \| APPROVED \| REJECTED |

#### Logger

Error / operational logging.

| Field | Type | Notes |
|-------|------|--------|
| id | String (UUID) | PK |
| user_id | String | |
| error_message | String | |
| type | loggerType | MESSAGE |
| data | Json? | |

---

## 5. Enums Reference

| Enum | Values |
|------|--------|
| **Provider** | GOOGLE, APPLE |
| **UserRole** | USER, ADMIN |
| **Currency** | XAF, USD, EUR, CAD |
| **DeliveryStatus** | PENDING, ONGOING, EXPIRED |
| **ChatType** | TRIP, SUPPORT, SHOPPING, SHIPPING |
| **MessageType** | TEXT, IMAGE, REQUEST, PAYMENT, SYSTEM, REVIEW, WARNING, DELIVERY, SHOPPING, SHIPPING |
| **TripStatus** | PUBLISHED, SCHEDULED, RESCHEDULED, CANCELLED, COMPLETED, DRAFT, INPROGRESS |
| **RequestStatus** | PENDING, ACCEPTED, DELIVERED, DECLINED, CANCELLED, REFUNDED, CONFIRMED, EXPIRED, SENT, RECEIVED, IN_TRANSIT, PENDING_DELIVERY, REVIEWED |
| **PaymentStatus** | PENDING, PROCESSING, SUCCEEDED, FAILED, REFUNDED, DISPUTED |
| **ProofStatus** | PENDING, APPROVED, REJECTED |
| **ProofDecision** | APPROVE, REJECT |
| **ProofImageType** | RECEIPT, PRODUCT_PHOTO |
| **KYCStatus** | NOT_STARTED, IN_PROGRESS, APPROVED, DECLINED, KYC_EXPIRED, IN_REVIEW, EXPIRED, ABANDONED |
| **KYCProvider** | DIDIT, OTHER |
| **ReportType** | RESPONSE_TO_REPORT, COMMUNICATION_PROBLEM, PACKAGE_ISSUE, PACKAGE_LOST, PAYMENT_PROBLEM, POLICY_VIOLATION, DELAYED_DEPARTURE, APP_TECHNICAL, DRIVER_WAS_LATE, UNSAFE_DRIVING, WRONG_ROUTE_TAKEN, VEHICLE_CONDITION_ISSUE, INAPPROPRIATE_BEHAVIOR, OTHER |
| **ReportPriority** | HIGH, LOW |
| **ReportStatus** | PENDING, REPLIED, INVESTIGATION, RESOLVED |
| **TransactionType** | CREDIT, DEBIT |
| **TransactionStatus** | PENDING, SUCCESS, ONHOLD, COMPLETED, FAILED, PENDIND, IN_PROGRES, SEND, FAIL, RECEIVED |
| **TransactionSource** | ORDER, WITHDRAW, ADJUSTMENT, REFUND, COMMISSION, TRIP_EARNING, FEE, CANCELLATION_COMPENSATION, VELRO_FEE, PAYMENT_CANCELLATION, TRIP_PAYMENT |
| **TransactionProvider** | MTN, ORANGE, STRIPE |
| **WalletState** | ACTIVE, BLOCKED |
| **OtpType** | LOGIN, SIGNUP, FORGOT_PASSWORD, VERIFY_EMAIL |
| **NotificationType** | SYSTEM, REQUEST, ALERT |
| **OfferStatus** | PENDING, ACCEPTED, REJECTED, CANCELLED, DELIVERED, COMPLETED |
| **ShoppingRequestStatus** | PUBLISHED, OFFER_ACCEPTED, PAID, BOUGHT, PENDING_DELIVERY, DELIVERED, COMPLETED, DISPUTED, CANCELLED, EXPIRED |
| **ShippingRequestStatus** | PUBLISHED, OFFER_ACCEPTED, BOOKED, SHIPPED, IN_TRANSIT, DELIVERED, COMPLETED, CANCELLED, EXPIRED |
| **ShippingDeliveryTimeframe** | WITHIN_3_DAYS, WITHIN_1_WEEK, WITHIN_2_WEEKS, FLEXIBLE |
| **ShippingWeight** | UNDER_1KG, KG_1_TO_3, KG_3_TO_5, KG_5_TO_10, ABOVE_10_KG |
| **ShippingCategory** | LAPTOP, PHONE, DOCUMENTS, FULL_SUITCASE, ELECTRONICS, CUSTOM_WEIGHT |
| **DeliveryTimeframe** | ONE_WEEK, TWO_WEEKS, ONE_MONTH, FLEXIBLE |
| **RequestSource** | WEBVIEW, URL, MANUAL |
| **ProductSource** | AMAZON, SHEIN, HM, NIKE, ZARA, APPLE, EBAY, OTHER |
| **Language** | en, fr |
| **deleteRequestStatus** | PENDING, APPROVED, REJECTED |
| **loggerType** | MESSAGE |

---

## 6. Indexes & Constraints

### Unique constraints

- **Account:** `[provider, providerAccountId]`
- **User:** `stripe_account_id`
- **RefreshToken:** `token`
- **UserKYC:** `[userId, provider]`, `diditSessionId`
- **ChatMember:** `[user_id, chat_id]`
- **Translation:** `[trip_item_id, language]`
- **TripRequest:** `payment_intent_id`, `chat_id`
- **ShippingOffer:** `chat_id`
- **Offer:** `chat_id`
- **DeliveryTracking:** `shopping_request_id`
- **Transaction:** `reference`, `stripe_transfer_id`
- **Delivery:** `transaction_id`
- **Otp:** `access_key`

### Indexes (performance)

- **Delivery:** `userId`, `transaction_id`
- **TripRequest:** (via relations; consider compound on trip_id + status if needed)
- **PurchaseProof:** `offer_id`, `uploader_id`
- **ProofImage:** `proof_id`, `image_id`
- **ProofVerification:** `proof_id`
- **Wallet:** `userId`
- **Transaction:** `[userId, createdAt]`, `reference`, `stripe_transfer_id`
- **AccountDeleteRequest:** `user_id`, `email`
- **ShippingRequest:** `user_id`, `delivery_timeframe`, `weight`, `status`, `category`, `from`, `to`, `created_at`, `traveler_reward`
- **ShippingOffer:** `shipping_request_id`, `traveler_id`, `status`, `chat_id`
- **Product:** `shopping_request_id`
- **ShoppingRequest:** `user_id`, `status`, `expires_at`, `created_at`
- **Offer:** `shopping_request_id`, `traveler_id`, `status`, `request_version`, `chat_id`
- **DeliveryTracking:** `auto_release_at`, `marked_delivered_at`
- **TravelerStrike:** `traveler_id`, `is_banned`

When adding new query patterns, add indexes in the Prisma schema and create a migration.

---

## 7. Migrations

- **Location:** `prisma/migrations/`
- **Naming:** `YYYYMMDDHHMMSS_description/migration.sql`

### Commands

```bash
# Create migration after editing schema.prisma
npx prisma migrate dev --name your_migration_name

# Apply migrations (e.g. in CI/production)
npx prisma migrate deploy

# Regenerate client only (no DB change)
npx prisma generate

# Open Prisma Studio (browse data)
npx prisma studio
```

### Workflow for schema changes

1. Edit `prisma/schema.prisma`.
2. Run `npx prisma migrate dev --name descriptive_name`.
3. Commit the new folder under `prisma/migrations/` and the updated `schema.prisma`.
4. Ensure CI runs `prisma migrate deploy` (or equivalent) before starting the app.

---

## 8. Usage in Application

### Injecting PrismaService

```ts
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SomeService {
  constructor(private readonly prisma: PrismaService) {}

  async findUser(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async createTrip(data: Prisma.TripCreateInput) {
    return this.prisma.trip.create({ data });
  }
}
```

### Importing types

```ts
import type { User, Trip, Prisma } from 'generated/prisma';
// Prisma namespace: Prisma.TripCreateInput, Prisma.UserWhereInput, etc.
```

### Including relations

```ts
this.prisma.tripRequest.findMany({
  where: { trip_id: tripId },
  include: {
    user: true,
    request_items: { include: { trip_item: true } },
  },
});
```

### Transactions

```ts
await this.prisma.$transaction(async (tx) => {
  await tx.wallet.update({ ... });
  await tx.transaction.create({ ... });
});
```

---

## Quick reference: model → table

| Model | Typical usage |
|-------|----------------|
| User | Core identity, profile, Stripe, notifications |
| PendingUser | Pre-signup with OTP |
| Account, RefreshToken | Auth / OAuth |
| Otp | One-time codes |
| UserKYC | Verification |
| Trip, TripItem, TripItemsList, TripRequest, TripRequestItem | Trip marketplace |
| Airline, TransportType | Lookups |
| ShoppingRequest, Product, Offer, PurchaseProof, DeliveryTracking | Shopping flow |
| ShippingRequest, ShippingOffer | Shipping flow |
| Wallet, Transaction | Payments and balance |
| Delivery, DeliveryProduct | Reward/delivery tracking |
| Chat, ChatMember, Message | Messaging |
| Report, Rating, Notification, Alert | Support and feedback |
| Image | Shared image storage |
| AccountDeleteRequest, Logger | Account and ops |

For the exact list of fields and types, always refer to `prisma/schema.prisma` and the generated types in `generated/prisma`.
