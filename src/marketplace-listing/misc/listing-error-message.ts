export class ListingErrorMessage {
  public static readonly PUBLISH_QUOTA_EXCEEDED = `Active Listing Quota Exceeded. Please archive some of your active listings and try again. Alternatively you can save your listing as a draft.`;
  public static readonly LISTING_NOT_FOUND = `Listing not found`;
  public static readonly LISTING_ALREADY_PUBLISHED =
    'Listing is already published';

  public static readonly LISTING_CANNOT_BE_MODIFIED =
    'This listing cannot be modified. Please archive the listing and create a new one.';

  public static readonly LISTING_NOT_PAID_ESCROW =
    'Listing has not paid escrow. Please pay the escrow first.';
}
