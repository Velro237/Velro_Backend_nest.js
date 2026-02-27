/**
 * Types for shopping/shipping request and offer data returned by chat endpoints.
 * These objects include a `type` field to differentiate SHOPPING vs SHIPPING.
 */

export interface ChatUserSummary {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  picture: string | null;
}

export interface ShoppingRequestData {
  type: 'SHOPPING';
  id: string;
  user_id: string;
  user: ChatUserSummary | null;
  version?: number;
  current_version?: number;
  source: string;
  products: unknown[];
  deliver_to: string;
  delivery_timeframe: string;
  packaging_option: boolean;
  product_price: number | null;
  product_currency: string;
  traveler_reward: number | null;
  platform_fee: number | null;
  additional_fees?: number | null;
  total_cost: number | null;
  suggested_reward_percentage?: number | null;
  reward_currency?: string;
  status: string;
  expires_at: Date | null;
  additional_notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ShoppingOfferData {
  type: 'SHOPPING';
  id: string;
  shopping_request_id: string;
  traveler_id: string;
  request_version?: number;
  reward_amount: number | null;
  reward_currency: string;
  additional_fees?: number | null;
  travel_date: Date | null;
  message: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
  traveler?: ChatUserSummary;
}

export interface ShippingRequestData {
  type: 'SHIPPING';
  id: string;
  user_id: string;
  user: ChatUserSummary | null;
  category: string;
  package_photo_urls: string[];
  package_description: string;
  details_description: string | null;
  from: string;
  to: string;
  delivery_timeframe: string;
  weight: string;
  packaging: boolean;
  traveler_reward: number | null;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface ShippingOfferData {
  type: 'SHIPPING';
  id: string;
  shipping_request_id: string;
  traveler_id: string;
  reward_amount: number | null;
  travel_date: Date | null;
  message: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
  traveler?: ChatUserSummary;
}
