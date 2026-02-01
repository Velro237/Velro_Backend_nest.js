/**
 * JSON-LD Schema.org Product Interface
 * Based on https://schema.org/Product
 */
export interface JsonLdProduct {
  '@type': 'Product';
  name: string;
  description?: string;
  image?: string | string[] | JsonLdImageObject | JsonLdImageObject[];
  offers?: JsonLdOffer | JsonLdOffer[] | JsonLdAggregateOffer;
  weight?: string | JsonLdQuantitativeValue;
  brand?: JsonLdBrand;
  sku?: string;
  gtin?: string;
  mpn?: string;
  // Variants/Product options
  hasVariant?: JsonLdProduct[];
  additionalProperty?: Array<{
    '@type'?: 'PropertyValue';
    name?: string;
    value?: string | number;
  }>;
  // Size, color, etc. as additional properties
  size?: string | string[];
  color?: string | string[];
  material?: string | string[];
}

export interface JsonLdImageObject {
  '@type'?: 'ImageObject';
  url: string;
  contentUrl?: string;
}

export interface JsonLdOffer {
  '@type'?: 'Offer';
  price?: string | number;
  priceCurrency?: string;
  availability?: string;
  url?: string;
  seller?: JsonLdOrganization;
  itemCondition?: string;
}

export interface JsonLdAggregateOffer {
  '@type'?: 'AggregateOffer';
  lowPrice?: string | number;
  highPrice?: string | number;
  priceCurrency?: string;
  offerCount?: number;
  offers?: JsonLdOffer[];
}

export interface JsonLdQuantitativeValue {
  '@type'?: 'QuantitativeValue';
  value?: string | number;
  unitCode?: string;
  unitText?: string;
}

export interface JsonLdBrand {
  '@type'?: 'Brand';
  name: string;
}

export interface JsonLdOrganization {
  '@type'?: 'Organization';
  name: string;
}

export interface JsonLdItemList {
  '@type': 'ItemList';
  itemListElement: Array<{
    '@type'?: 'ListItem';
    item?: JsonLdProduct;
  }>;
}

export type JsonLdData = JsonLdProduct | JsonLdItemList | JsonLdProduct[];

/**
 * Nike Redux State Interface (for parsing React-rendered content)
 */
export interface NikeReduxState {
  Thread?: {
    products?: NikeProduct[];
  };
  Product?: {
    products?: NikeProduct[];
  };
}

export interface NikeProduct {
  title?: string;
  currentPrice?: string | number;
  images?: string[];
  inStock?: boolean;
  sku?: string;
}
