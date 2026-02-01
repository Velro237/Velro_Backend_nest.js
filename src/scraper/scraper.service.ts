import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import * as cheerio from 'cheerio';
import puppeteer, { Browser, Page } from 'puppeteer';
import { ScrapedProduct, ScrapedBasket } from './dto/scrape-product.dto';
import { ProductSource } from 'generated/prisma';
import { RedisService } from '../redis/redis.service';
import {
  JsonLdProduct,
  JsonLdData,
  JsonLdOffer,
  JsonLdAggregateOffer,
  JsonLdImageObject,
  JsonLdQuantitativeValue,
  NikeReduxState,
  NikeProduct,
} from './interfaces/json-ld.interface';

/**
 * Production-ready product scraper service
 *
 * Uses Puppeteer (free, open-source) for JavaScript rendering
 *
 * Features:
 * - Puppeteer for JavaScript-rendered content (FREE, open-source)
 * - Cheerio for HTML parsing
 * - JSON-LD structured data extraction (most reliable)
 * - Redis caching to reduce requests
 * - ScraperAPI integration (OPTIONAL - only if you want to pay)
 *
 * Strategy:
 * 1. Try direct fetch first (fast, works for static content)
 * 2. If blocked or JavaScript needed → Use Puppeteer (free)
 * 3. ScraperAPI only as last resort (if configured)
 */
@Injectable()
export class ScraperService implements OnModuleDestroy {
  private readonly logger = new Logger(ScraperService.name);
  private readonly scraperApiKey: string | undefined;
  private readonly scraperApiEnabled: boolean;
  private readonly usePuppeteer: boolean;
  private readonly requestTimeout = 30000; // 30 seconds
  private readonly maxRetries = 3;
  private readonly cacheTtl = 86400; // 24 hours cache
  private browser: Browser | null = null;

  // User agent rotation
  private readonly userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  ];

  constructor(
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
    private readonly redisService?: RedisService, // Optional - graceful degradation
  ) {
    this.scraperApiKey = this.configService.get<string>('SCRAPER_API_KEY');
    this.scraperApiEnabled = !!this.scraperApiKey;
    // Use Puppeteer by default (free solution)
    this.usePuppeteer =
      this.configService.get<string>('USE_PUPPETEER') !== 'false';

    if (this.scraperApiEnabled) {
      this.logger.log(
        '✅ ScraperAPI integration enabled (optional paid service)',
      );
    }

    if (this.usePuppeteer) {
      this.logger.log(
        '✅ Puppeteer enabled - Free JavaScript rendering support',
      );
      this.initializeBrowser();
    } else {
      this.logger.warn(
        '⚠️  Puppeteer disabled. Set USE_PUPPETEER=true for JavaScript sites.',
      );
    }
  }

  /**
   * Initialize Puppeteer browser (lazy loading)
   */
  private async initializeBrowser(): Promise<void> {
    try {
      if (!this.browser) {
        this.browser = await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1920x1080',
          ],
        });
        this.logger.log('✅ Puppeteer browser initialized');
      }
    } catch (error) {
      this.logger.error('Failed to initialize Puppeteer:', error);
      this.browser = null;
    }
  }

  /**
   * Get or create browser instance
   */
  private async getBrowser(): Promise<Browser | null> {
    if (!this.usePuppeteer) {
      return null;
    }

    if (!this.browser) {
      await this.initializeBrowser();
    }

    // Check if browser is still connected
    if (this.browser && !this.browser.isConnected()) {
      this.logger.warn('Browser disconnected, reinitializing...');
      this.browser = null;
      await this.initializeBrowser();
    }

    return this.browser;
  }

  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Scrape a single product from URL with caching
   */
  async scrapeProduct(
    url: string,
    lang: string = 'en',
  ): Promise<ScrapedProduct> {
    try {
      await this.validateUrl(url, lang);

      // Check cache first (if Redis available)
      if (this.redisService) {
        try {
          const cacheKey = `scraper:product:${this.hashUrl(url)}`;
          const cached = await this.redisService.get(cacheKey);
          if (cached) {
            try {
              this.logger.debug(`Cache hit for ${url}`);
              return JSON.parse(cached) as ScrapedProduct;
            } catch (parseError) {
              this.logger.warn(
                `Failed to parse cached data for ${url}, clearing cache`,
              );
              // Cache corrupted, continue with fresh scrape
            }
          }
        } catch (error) {
          this.logger.warn(
            'Redis cache check failed, continuing without cache:',
            error,
          );
        }
      }

      const source = this.detectSource(url);

      if (source === ProductSource.OTHER) {
        const message = await this.i18n.translate(
          'translation.errors.scraper.unsupported_store',
          { lang },
        );
        throw new BadRequestException({
          code: 'UNSUPPORTED_STORE',
          message,
        });
      }

      this.logger.debug(`Scraping ${source} product from: ${url}`);

      let html: string;

      // Strategy: Try direct fetch first, then Puppeteer if needed, then ScraperAPI as last resort
      try {
        html = await this.fetchDirect(url);

        // Check if we got blocked or need JavaScript rendering
        if (this.needsJavaScriptRendering(html, source)) {
          this.logger.debug(
            `JavaScript rendering needed for ${url}, using Puppeteer`,
          );
          html = await this.fetchWithPuppeteer(url);
        }
      } catch (error) {
        // If direct fetch fails, try Puppeteer (free)
        if (this.usePuppeteer) {
          this.logger.debug(`Direct fetch failed, trying Puppeteer for ${url}`);
          try {
            html = await this.fetchWithPuppeteer(url);
          } catch (puppeteerError) {
            // Last resort: ScraperAPI (if configured)
            if (this.scraperApiEnabled) {
              this.logger.debug(
                `Puppeteer failed, trying ScraperAPI for ${url}`,
              );
              html = await this.fetchWithScraperAPI(url);
            } else {
              throw puppeteerError;
            }
          }
        } else if (this.scraperApiEnabled) {
          // If Puppeteer disabled, try ScraperAPI
          html = await this.fetchWithScraperAPI(url);
        } else {
          throw error;
        }
      }

      // Parse HTML with Cheerio
      const $ = cheerio.load(html);

      // Try to extract JSON-LD structured data first (most reliable)
      const jsonLdData = this.extractJsonLd($);

      // Parse based on source
      let result: ScrapedProduct;
      switch (source) {
        case ProductSource.AMAZON:
          result = this.parseAmazon($, html, url, jsonLdData);
          break;
        case ProductSource.SHEIN:
          result = this.parseShein($, html, url, jsonLdData);
          break;
        case ProductSource.HM:
          result = this.parseHM($, html, url, jsonLdData);
          break;
        case ProductSource.NIKE:
          result = this.parseNike($, html, url, jsonLdData);
          break;
        case ProductSource.ZARA:
          result = this.parseZara($, html, url, jsonLdData);
          break;
        case ProductSource.APPLE:
          result = this.parseApple($, html, url, jsonLdData);
          break;
        case ProductSource.EBAY:
          result = this.parseEbay($, html, url, jsonLdData);
          break;
        default:
          this.logger.error(`Parser not implemented for source: ${source}`);
          throw new InternalServerErrorException({
            code: 'PARSER_NOT_IMPLEMENTED',
            message: `Product parser not implemented for source: ${source}`,
          });
      }

      // Extract variants if available
      result.variants = this.extractVariants($, html, jsonLdData, source);

      // Validate and enrich result
      this.validateScrapedProduct(result, url);
      result.url = url;

      // Cache the result (if Redis available)
      if (this.redisService) {
        try {
          const cacheKey = `scraper:product:${this.hashUrl(url)}`;
          await this.redisService.set(
            cacheKey,
            JSON.stringify(result),
            this.cacheTtl,
          );
        } catch (error) {
          this.logger.warn(
            'Redis cache set failed, continuing without cache:',
            error,
          );
        }
      }

      this.logger.debug(`✅ Successfully scraped product: ${result.name}`);
      return result;
    } catch (error) {
      this.logger.error(`❌ Failed to scrape product from ${url}:`, error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      // Log detailed error for debugging
      this.logger.error(
        `Scraping error details: ${JSON.stringify({
          url,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        })}`,
      );

      const message = await this.i18n.translate(
        'translation.errors.scraper.scrape_failed',
        { lang },
      );
      throw new InternalServerErrorException({
        code: 'SCRAPE_FAILED',
        message,
      });
    }
  }

  /**
   * Scrape multiple products (for webview basket import)
   */
  async scrapeBasket(
    urls: string[],
    lang: string = 'en',
  ): Promise<ScrapedBasket> {
    if (!urls || urls.length === 0) {
      const message = await this.i18n.translate(
        'translation.errors.scraper.empty_basket',
        { lang },
      );
      throw new BadRequestException({
        code: 'EMPTY_BASKET',
        message,
      });
    }

    if (urls.length > 50) {
      const message = await this.i18n.translate(
        'translation.errors.scraper.basket_too_large',
        { lang },
      );
      throw new BadRequestException({
        code: 'BASKET_TOO_LARGE',
        message,
      });
    }

    this.logger.log(`Scraping basket with ${urls.length} products`);

    const results: ScrapedProduct[] = [];
    const failedUrls: Array<{ url: string; error: string }> = [];

    // Process in parallel with concurrency limit
    const concurrency = 3; // Reduced to avoid overwhelming servers
    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map((url) => this.scrapeProduct(url, lang)),
      );

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          const errorMsg = result.reason?.message || 'Unknown error';
          failedUrls.push({
            url: batch[index],
            error: errorMsg,
          });
          this.logger.warn(`Failed to scrape ${batch[index]}: ${errorMsg}`);
        }
      });

      // Add delay between batches to avoid rate limiting
      if (i + concurrency < urls.length) {
        await this.delay(2000); // 2 second delay between batches
      }
    }

    this.logger.log(
      `Basket scraping complete: ${results.length} successful, ${failedUrls.length} failed`,
    );

    return {
      products: results,
      failedUrls,
    };
  }

  // ==================== Fetching Methods ====================

  /**
   * Direct fetching (fallback - FRAGILE, may fail)
   */
  private async fetchDirect(url: string): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const userAgent = this.userAgents[attempt % this.userAgents.length];

        const response = await fetch(url, {
          headers: {
            'User-Agent': userAgent,
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            Connection: 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Cache-Control': 'max-age=0',
          },
          signal: AbortSignal.timeout(this.requestTimeout),
        });

        if (!response.ok) {
          // Check for common blocking responses
          if (response.status === 403 || response.status === 429) {
            throw new Error(
              `Blocked by website (${response.status}). Use ScraperAPI for production.`,
            );
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();

        // Check for Cloudflare challenge or CAPTCHA
        if (
          html.includes('challenge-platform') ||
          html.includes('cf-browser-verification') ||
          html.includes('Just a moment')
        ) {
          throw new Error(
            'Cloudflare challenge detected. Use ScraperAPI to bypass.',
          );
        }

        return html;
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.maxRetries) {
          this.logger.warn(`Fetch attempt ${attempt + 1} failed, retrying...`);
          await this.delay(2000 * (attempt + 1)); // Exponential backoff
        }
      }
    }

    throw lastError || new Error('All fetch attempts failed');
  }

  // ==================== Parsing Methods ====================

  /**
   * Extract JSON-LD structured data (Schema.org) - MOST RELIABLE
   */
  private extractJsonLd(
    $: ReturnType<typeof cheerio.load>,
  ): JsonLdProduct | null {
    try {
      const jsonLdScripts = $('script[type="application/ld+json"]');
      const products: JsonLdProduct[] = [];

      jsonLdScripts.each((_, element) => {
        try {
          const content = $(element).html();
          if (content) {
            const data = JSON.parse(content) as JsonLdData;
            // Handle both single objects and arrays
            if (Array.isArray(data)) {
              products.push(
                ...data.filter(
                  (item): item is JsonLdProduct => item['@type'] === 'Product',
                ),
              );
            } else if (data['@type'] === 'Product') {
              products.push(data);
            } else if (
              data['@type'] === 'ItemList' &&
              'itemListElement' in data
            ) {
              // Handle ItemList with products
              data.itemListElement.forEach((item) => {
                if (item.item && item.item['@type'] === 'Product') {
                  products.push(item.item);
                }
              });
            }
          }
        } catch (e) {
          // Ignore parse errors for individual scripts
        }
      });

      return products.length > 0 ? products[0] : null;
    } catch (error) {
      this.logger.warn('Failed to extract JSON-LD data');
      return null;
    }
  }

  /**
   * Check if page needs JavaScript rendering
   */
  private needsJavaScriptRendering(
    html: string,
    source: ProductSource,
  ): boolean {
    // Check for common indicators that JavaScript is needed
    if (
      html.includes('challenge-platform') ||
      html.includes('cf-browser-verification') ||
      html.includes('Just a moment')
    ) {
      return true;
    }

    // Shein and some Amazon pages need JavaScript
    if (source === ProductSource.SHEIN) {
      return html.length < 5000 || !html.includes('product-intro');
    }

    // If HTML is very short, likely JavaScript-rendered
    if (html.length < 10000) {
      return true;
    }

    return false;
  }

  /**
   * Fetch using Puppeteer (FREE solution for JavaScript rendering)
   */
  private async fetchWithPuppeteer(url: string): Promise<string> {
    const browser = await this.getBrowser();
    if (!browser) {
      this.logger.error('Puppeteer browser not available');
      throw new InternalServerErrorException({
        code: 'PUPPETEER_NOT_AVAILABLE',
        message:
          'Puppeteer browser is not available. Please check server configuration.',
      });
    }

    let page: Page | null = null;
    try {
      page = await browser.newPage();

      // Set realistic viewport and user agent
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      );

      // Navigate with timeout
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.requestTimeout,
      });

      // Wait a bit for dynamic content
      await this.delay(2000);

      // Get HTML content
      const html = await page.content();
      return html;
    } catch (error) {
      this.logger.error(`Puppeteer fetch failed for ${url}:`, error);
      throw error;
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * Fetch using ScraperAPI (OPTIONAL - only if you want to pay)
   */
  private async fetchWithScraperAPI(url: string): Promise<string> {
    const scraperApiUrl = `http://api.scraperapi.com?api_key=${this.scraperApiKey}&url=${encodeURIComponent(url)}&render=true&country_code=us`;

    try {
      const response = await fetch(scraperApiUrl, {
        signal: AbortSignal.timeout(this.requestTimeout),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `ScraperAPI error: ${response.status} - ${errorText}`,
        );
        throw new Error(`ScraperAPI error: ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      this.logger.error(`ScraperAPI failed for ${url}:`, error);
      throw error; // Don't fallback - let caller handle
    }
  }

  /**
   * Parse Amazon product page
   * Multiple fallback selectors for robustness
   */
  private parseAmazon(
    $: ReturnType<typeof cheerio.load>,
    html: string,
    url: string,
    jsonLd: JsonLdProduct | null,
  ): ScrapedProduct {
    // Try JSON-LD first (most reliable)
    if (jsonLd && jsonLd.name) {
      const offers = jsonLd.offers;
      const offer: JsonLdOffer | undefined = Array.isArray(offers)
        ? offers[0]
        : offers && typeof offers === 'object' && 'price' in offers
          ? offers
          : undefined;

      return {
        name: jsonLd.name,
        description: jsonLd.description,
        price: this.parsePrice(offer?.price?.toString() || '0'),
        currency: offer?.priceCurrency || this.detectCurrencyFromUrl(url),
        imageUrls: this.extractImagesFromJsonLd(jsonLd.image),
        weight: this.extractWeightFromJsonLd(jsonLd),
        inStock:
          offer?.availability !== 'https://schema.org/OutOfStock' &&
          offer?.availability !== 'http://schema.org/OutOfStock',
        availabilityText:
          offer?.availability === 'https://schema.org/OutOfStock'
            ? 'Out of stock'
            : 'In stock',
        source: 'amazon',
        url,
      };
    }

    // Fallback to HTML parsing with multiple selectors
    const name =
      $('#productTitle').text().trim() ||
      $('h1.a-size-large').text().trim() ||
      $('h1#title').text().trim() ||
      $('meta[property="og:title"]').attr('content') ||
      $('title').text().split(' : ')[0].trim() ||
      'Product from Amazon';

    // Price extraction - try multiple selectors
    const priceText =
      $('.a-offscreen').first().text() ||
      $('.a-price-whole').first().text() ||
      $('#priceblock_ourprice').text() ||
      $('#priceblock_dealprice').text() ||
      $('#priceblock_saleprice').text() ||
      $('[data-a-color="price"] .a-offscreen').first().text() ||
      $('.a-price .a-offscreen').first().text() ||
      $('[data-a-color="base"] .a-offscreen').first().text() ||
      '0';
    const price = this.parsePrice(priceText);

    // Currency detection
    const currency =
      this.detectCurrencyFromUrl(url) ||
      this.extractCurrencyFromPrice(priceText) ||
      'USD';

    // Images - multiple selectors
    const imageUrls: string[] = [];

    // Main image
    const mainImage =
      $('#landingImage').attr('src') ||
      $('#landingImage').attr('data-old-src') ||
      $('#landingImage')
        .attr('data-a-dynamic-image')
        ?.match(/"([^"]+)"/)?.[1] ||
      $('img[data-a-image-name="landingImage"]').attr('src') ||
      $('img[data-old-src]').first().attr('data-old-src') ||
      '';
    if (mainImage) imageUrls.push(mainImage);

    // Additional images
    $('#altImages img, #imageBlock_feature_div img, .a-dynamic-image').each(
      (_, el) => {
        const src =
          $(el).attr('src') ||
          $(el).attr('data-src') ||
          $(el).attr('data-old-src');
        if (src && !imageUrls.includes(src) && !src.includes('pixel')) {
          imageUrls.push(src);
        }
      },
    );

    // Description
    const description =
      $('#productDescription').text().trim() ||
      $('#feature-bullets').text().trim() ||
      $('[data-feature-name="productDescription"]').text().trim() ||
      '';

    // Weight extraction from product details
    const productDetailsText =
      $('#productDetails_detailBullets_sections1').text() +
      $('#productDetails_techSpec_section_1').text() +
      $('[data-feature-name="productDetails"]').text();
    const weight = this.extractWeight(productDetailsText);

    // Availability
    const availabilityText =
      $('#availability span').text().trim() ||
      $('[data-asin] #availability').text().trim() ||
      '';
    const inStock =
      !availabilityText.toLowerCase().includes('unavailable') &&
      !availabilityText.toLowerCase().includes('out of stock') &&
      !availabilityText.toLowerCase().includes('temporarily') &&
      !html.toLowerCase().includes('currently unavailable');

    return {
      name: this.cleanText(name),
      description: description
        ? this.cleanText(description).substring(0, 2000)
        : undefined,
      price,
      currency,
      imageUrls: imageUrls.slice(0, 10),
      weight,
      inStock,
      availabilityText:
        availabilityText || (inStock ? 'In stock' : 'Out of stock'),
      source: 'amazon',
      url,
    };
  }

  /**
   * Parse Shein product page
   * Shein uses heavy JavaScript - Puppeteer handles this (FREE)
   */
  private parseShein(
    $: ReturnType<typeof cheerio.load>,
    html: string,
    url: string,
    jsonLd: JsonLdProduct | null,
  ): ScrapedProduct {
    if (jsonLd && jsonLd.name) {
      const offers = jsonLd.offers;
      const offer: JsonLdOffer | undefined = Array.isArray(offers)
        ? offers[0]
        : offers && typeof offers === 'object' && 'price' in offers
          ? offers
          : undefined;
      return {
        name: jsonLd.name,
        description: jsonLd.description,
        price: this.parsePrice(offer?.price?.toString() || '0'),
        currency: offer?.priceCurrency || this.detectCurrencyFromUrl(url),
        imageUrls: this.extractImagesFromJsonLd(jsonLd.image),
        inStock: offer?.availability !== 'https://schema.org/OutOfStock',
        availabilityText: 'In stock',
        source: 'shein',
        url,
      };
    }

    // HTML fallback (may not work if content is JavaScript-rendered)
    const name =
      $('h1.product-intro__head-name').text().trim() ||
      $('h1[class*="product-intro"]').text().trim() ||
      $('meta[property="og:title"]').attr('content') ||
      'Product from Shein';

    const priceText =
      $('.product-intro__head-price').text() ||
      $('[class*="price"]').first().text() ||
      $('meta[property="product:price:amount"]').attr('content') ||
      '0';
    const price = this.parsePrice(priceText);

    const imageUrls: string[] = [];
    $('img[class*="product-intro"], img[class*="product-image"]').each(
      (_, el) => {
        const src =
          $(el).attr('src') ||
          $(el).attr('data-src') ||
          $(el).attr('data-lazy-src');
        if (src && !imageUrls.includes(src)) {
          imageUrls.push(src);
        }
      },
    );

    return {
      name: this.cleanText(name),
      price,
      currency: this.detectCurrencyFromUrl(url),
      imageUrls: imageUrls.slice(0, 10),
      inStock: true,
      availabilityText: 'In stock',
      source: 'shein',
      url,
    };
  }

  /**
   * Parse H&M product page
   */
  private parseHM(
    $: ReturnType<typeof cheerio.load>,
    html: string,
    url: string,
    jsonLd: JsonLdProduct | null,
  ): ScrapedProduct {
    if (jsonLd && jsonLd.name) {
      const offers = jsonLd.offers;
      const offer: JsonLdOffer | undefined = Array.isArray(offers)
        ? offers[0]
        : offers && typeof offers === 'object' && 'price' in offers
          ? offers
          : undefined;
      return {
        name: jsonLd.name,
        description: jsonLd.description,
        price: this.parsePrice(offer?.price?.toString() || '0'),
        currency: offer?.priceCurrency || this.detectCurrencyFromUrl(url),
        imageUrls: this.extractImagesFromJsonLd(jsonLd.image),
        inStock: offer?.availability !== 'https://schema.org/OutOfStock',
        availabilityText: 'In stock',
        source: 'hm',
        url,
      };
    }

    const name =
      $('h1.product-item-headline').text().trim() ||
      $('meta[property="og:title"]').attr('content') ||
      'Product from H&M';

    const priceText =
      $('.product-item-price').text() ||
      $('[class*="price"]').first().text() ||
      '0';
    const price = this.parsePrice(priceText);

    return {
      name: this.cleanText(name),
      price,
      currency: this.detectCurrencyFromUrl(url),
      imageUrls: [],
      inStock: true,
      availabilityText: 'In stock',
      source: 'hm',
      url,
    };
  }

  /**
   * Parse Nike product page
   */
  private parseNike(
    $: ReturnType<typeof cheerio.load>,
    html: string,
    url: string,
    jsonLd: JsonLdProduct | null,
  ): ScrapedProduct {
    // Nike uses React - try to extract from script tags
    const reactDataMatch = html.match(
      /window\.INITIAL_REDUX_STATE\s*=\s*({.*?});/s,
    );
    let productData: NikeProduct = {};

    if (reactDataMatch) {
      try {
        const reduxState = JSON.parse(reactDataMatch[1]) as NikeReduxState;
        productData =
          reduxState?.Thread?.products?.[0] ||
          reduxState?.Product?.products?.[0] ||
          {};
      } catch (e) {
        this.logger.warn('Failed to parse Nike Redux state');
      }
    }

    if (jsonLd && jsonLd.name) {
      const offers = jsonLd.offers;
      let offer: JsonLdOffer | undefined;
      let aggregateOffer: JsonLdAggregateOffer | undefined;

      if (Array.isArray(offers)) {
        offer = offers[0];
      } else if (offers && typeof offers === 'object') {
        if ('price' in offers) {
          offer = offers;
        } else if ('lowPrice' in offers) {
          aggregateOffer = offers;
        }
      }

      return {
        name: jsonLd.name || productData.title || 'Product from Nike',
        description: jsonLd.description,
        price: this.parsePrice(
          offer?.price?.toString() ||
            aggregateOffer?.lowPrice?.toString() ||
            productData.currentPrice?.toString() ||
            '0',
        ),
        currency: offer?.priceCurrency || this.detectCurrencyFromUrl(url),
        imageUrls:
          productData.images || this.extractImagesFromJsonLd(jsonLd.image),
        inStock: productData.inStock !== false,
        availabilityText:
          productData.inStock !== false ? 'In stock' : 'Out of stock',
        source: 'nike',
        url,
      };
    }

    const name =
      productData.title ||
      $('#pdp_product_title').text().trim() ||
      $('h1').first().text().trim() ||
      'Product from Nike';

    return {
      name: this.cleanText(name),
      price: this.parsePrice(productData.currentPrice || '0'),
      currency: this.detectCurrencyFromUrl(url),
      imageUrls: productData.images || [],
      inStock: productData.inStock !== false,
      availabilityText: 'In stock',
      source: 'nike',
      url,
    };
  }

  /**
   * Parse Zara product page
   */
  private parseZara(
    $: ReturnType<typeof cheerio.load>,
    html: string,
    url: string,
    jsonLd: JsonLdProduct | null,
  ): ScrapedProduct {
    if (jsonLd && jsonLd.name) {
      const offers = jsonLd.offers;
      const offer: JsonLdOffer | undefined = Array.isArray(offers)
        ? offers[0]
        : offers && typeof offers === 'object' && 'price' in offers
          ? offers
          : undefined;
      return {
        name: jsonLd.name,
        price: this.parsePrice(offer?.price?.toString() || '0'),
        currency: offer?.priceCurrency || this.detectCurrencyFromUrl(url),
        imageUrls: this.extractImagesFromJsonLd(jsonLd.image),
        inStock: true,
        availabilityText: 'In stock',
        source: 'zara',
        url,
      };
    }

    const name =
      $('h1.product-detail-info__name').text().trim() || 'Product from Zara';

    return {
      name: this.cleanText(name),
      price: 0,
      currency: this.detectCurrencyFromUrl(url),
      imageUrls: [],
      inStock: true,
      availabilityText: 'In stock',
      source: 'zara',
      url,
    };
  }

  /**
   * Parse Apple product page
   */
  private parseApple(
    $: ReturnType<typeof cheerio.load>,
    html: string,
    url: string,
    jsonLd: JsonLdProduct | null,
  ): ScrapedProduct {
    if (jsonLd && jsonLd.name) {
      const offers = jsonLd.offers;
      const offer: JsonLdOffer | undefined = Array.isArray(offers)
        ? offers[0]
        : offers && typeof offers === 'object' && 'price' in offers
          ? offers
          : undefined;
      return {
        name: jsonLd.name,
        price: this.parsePrice(offer?.price?.toString() || '0'),
        currency: offer?.priceCurrency || this.detectCurrencyFromUrl(url),
        imageUrls: this.extractImagesFromJsonLd(jsonLd.image),
        inStock: offer?.availability !== 'https://schema.org/OutOfStock',
        availabilityText:
          offer?.availability === 'https://schema.org/OutOfStock'
            ? 'Out of stock'
            : 'In stock',
        source: 'apple',
        url,
      };
    }

    const name =
      $('h1.typography-headline').text().trim() ||
      $('h1').first().text().trim() ||
      'Product from Apple';

    return {
      name: this.cleanText(name),
      price: 0,
      currency: this.detectCurrencyFromUrl(url),
      imageUrls: [],
      inStock: true,
      availabilityText: 'In stock',
      source: 'apple',
      url,
    };
  }

  /**
   * Parse eBay product page
   */
  private parseEbay(
    $: ReturnType<typeof cheerio.load>,
    html: string,
    url: string,
    jsonLd: JsonLdProduct | null,
  ): ScrapedProduct {
    if (jsonLd && jsonLd.name) {
      const offers = jsonLd.offers;
      const offer: JsonLdOffer | undefined = Array.isArray(offers)
        ? offers[0]
        : offers && typeof offers === 'object' && 'price' in offers
          ? offers
          : undefined;
      return {
        name: jsonLd.name,
        price: this.parsePrice(offer?.price?.toString() || '0'),
        currency: offer?.priceCurrency || this.detectCurrencyFromUrl(url),
        imageUrls: this.extractImagesFromJsonLd(jsonLd.image),
        inStock: true,
        availabilityText: 'In stock',
        source: 'ebay',
        url,
      };
    }

    const name =
      $('#x-item-title-label').text().trim() ||
      $('h1.it-ttl').text().trim() ||
      $('h1').first().text().trim() ||
      'Product from eBay';

    const priceText =
      $('#prcIsum').text() ||
      $('.notranslate').first().text() ||
      $('[itemprop="price"]').text() ||
      '0';
    const price = this.parsePrice(priceText);

    return {
      name: this.cleanText(name),
      price,
      currency: this.detectCurrencyFromUrl(url),
      imageUrls: [],
      inStock: true,
      availabilityText: 'In stock',
      source: 'ebay',
      url,
    };
  }

  // ==================== Helper Methods ====================

  private detectSource(url: string): ProductSource {
    const urlLower = url.toLowerCase();

    if (urlLower.includes('amazon.') || urlLower.includes('amzn.')) {
      return ProductSource.AMAZON;
    }
    if (urlLower.includes('shein.')) {
      return ProductSource.SHEIN;
    }
    if (
      urlLower.includes('hm.com') ||
      urlLower.includes('h&m') ||
      urlLower.includes('hm.com')
    ) {
      return ProductSource.HM;
    }
    if (urlLower.includes('nike.')) {
      return ProductSource.NIKE;
    }
    if (urlLower.includes('zara.')) {
      return ProductSource.ZARA;
    }
    if (urlLower.includes('apple.com')) {
      return ProductSource.APPLE;
    }
    if (urlLower.includes('ebay.')) {
      return ProductSource.EBAY;
    }

    return ProductSource.OTHER;
  }

  private async validateUrl(url: string, lang: string = 'en'): Promise<void> {
    if (!url || typeof url !== 'string') {
      const message = await this.i18n.translate(
        'translation.errors.scraper.invalid_url',
        { lang },
      );
      throw new BadRequestException({
        code: 'INVALID_URL',
        message,
      });
    }

    try {
      const urlObj = new URL(url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch (error) {
      const message = await this.i18n.translate(
        'translation.errors.scraper.invalid_url',
        { lang },
      );
      throw new BadRequestException({
        code: 'INVALID_URL',
        message,
      });
    }
  }

  private validateScrapedProduct(product: ScrapedProduct, url: string): void {
    if (!product.name || product.name.trim().length === 0) {
      this.logger.error(`Scraped product missing name for ${url}`);
      throw new InternalServerErrorException({
        code: 'SCRAPE_VALIDATION_FAILED',
        message:
          'Failed to extract product name. The website structure may have changed.',
      });
    }

    if (product.price <= 0) {
      this.logger.warn(
        `⚠️  Price is 0 or negative for ${url} - may indicate scraping issue`,
      );
    }

    if (!product.currency) {
      this.logger.error(`Scraped product missing currency for ${url}`);
      throw new InternalServerErrorException({
        code: 'SCRAPE_VALIDATION_FAILED',
        message:
          'Failed to extract product currency. The website structure may have changed.',
      });
    }

    if (!product.url) {
      product.url = url;
    }

    // Warn if no images found
    if (product.imageUrls.length === 0) {
      this.logger.warn(`⚠️  No images found for ${url}`);
    }
  }

  private parsePrice(priceText: string | number): number {
    if (typeof priceText === 'number') {
      return priceText;
    }

    if (!priceText) {
      return 0;
    }

    // Remove currency symbols, commas, spaces
    const cleaned = priceText
      .toString()
      .replace(/[^\d.,]/g, '')
      .replace(/,/g, '')
      .replace(/\./g, (match, offset, string) => {
        // Keep last dot as decimal separator
        const lastDotIndex = string.lastIndexOf('.');
        return offset === lastDotIndex ? '.' : '';
      });

    const price = parseFloat(cleaned);
    return isNaN(price) ? 0 : price;
  }

  private detectCurrencyFromUrl(url: string): string {
    const urlLower = url.toLowerCase();

    // Amazon country domains
    if (urlLower.includes('amazon.co.uk')) {
      return 'GBP';
    }
    if (
      urlLower.includes('amazon.de') ||
      urlLower.includes('amazon.fr') ||
      urlLower.includes('amazon.es') ||
      urlLower.includes('amazon.it')
    ) {
      return 'EUR';
    }
    if (urlLower.includes('amazon.ca')) {
      return 'CAD';
    }
    if (urlLower.includes('amazon.co.jp') || urlLower.includes('amazon.jp')) {
      return 'JPY';
    }
    if (urlLower.includes('amazon.com.au') || urlLower.includes('amazon.au')) {
      return 'AUD';
    }
    if (urlLower.includes('amazon.in')) {
      return 'INR';
    }
    if (urlLower.includes('amazon.com')) {
      return 'USD';
    }

    // Nike country codes in path (e.g., nike.com/in/, nike.com/uk/)
    if (urlLower.includes('nike.')) {
      if (urlLower.includes('/in/') || urlLower.includes('.in/')) {
        return 'INR';
      }
      if (urlLower.includes('/uk/') || urlLower.includes('.co.uk/')) {
        return 'GBP';
      }
      if (urlLower.includes('/de/') || urlLower.includes('.de/')) {
        return 'EUR';
      }
      if (urlLower.includes('/fr/') || urlLower.includes('.fr/')) {
        return 'EUR';
      }
      if (urlLower.includes('/ca/') || urlLower.includes('.ca/')) {
        return 'CAD';
      }
      if (urlLower.includes('/au/') || urlLower.includes('.au/')) {
        return 'AUD';
      }
      // Default to USD for Nike
      return 'USD';
    }

    // Zara country codes in path (e.g., zara.com/ww/en/, zara.com/us/en/)
    if (urlLower.includes('zara.')) {
      if (urlLower.includes('/us/')) {
        return 'USD';
      }
      if (urlLower.includes('/uk/') || urlLower.includes('/gb/')) {
        return 'GBP';
      }
      if (urlLower.includes('/in/')) {
        return 'INR';
      }
      if (urlLower.includes('/ca/')) {
        return 'CAD';
      }
      if (urlLower.includes('/au/')) {
        return 'AUD';
      }
      // Default to EUR for Zara (most common)
      return 'EUR';
    }

    // Shein country subdomains (e.g., us.shein.com, uk.shein.com)
    if (urlLower.includes('shein.')) {
      if (urlLower.includes('us.shein.') || urlLower.includes('us.shein.com')) {
        return 'USD';
      }
      if (urlLower.includes('uk.shein.') || urlLower.includes('.shein.co.uk')) {
        return 'GBP';
      }
      if (urlLower.includes('de.shein.') || urlLower.includes('.shein.de')) {
        return 'EUR';
      }
      if (urlLower.includes('fr.shein.') || urlLower.includes('.shein.fr')) {
        return 'EUR';
      }
      if (urlLower.includes('in.shein.') || urlLower.includes('.shein.in')) {
        return 'INR';
      }
      // Default to USD for Shein
      return 'USD';
    }

    // H&M country codes
    if (urlLower.includes('hm.com')) {
      if (urlLower.includes('.com/us/') || urlLower.includes('us.hm.')) {
        return 'USD';
      }
      if (urlLower.includes('.com/uk/') || urlLower.includes('uk.hm.')) {
        return 'GBP';
      }
      // Default to EUR for H&M
      return 'EUR';
    }

    // Apple country codes
    if (urlLower.includes('apple.com')) {
      if (urlLower.includes('/uk/') || urlLower.includes('.co.uk')) {
        return 'GBP';
      }
      if (urlLower.includes('/de/') || urlLower.includes('.de')) {
        return 'EUR';
      }
      if (urlLower.includes('/fr/') || urlLower.includes('.fr')) {
        return 'EUR';
      }
      if (urlLower.includes('/ca/') || urlLower.includes('.ca')) {
        return 'CAD';
      }
      if (urlLower.includes('/in/') || urlLower.includes('.in')) {
        return 'INR';
      }
      if (urlLower.includes('/au/') || urlLower.includes('.au')) {
        return 'AUD';
      }
      // Default to USD for Apple
      return 'USD';
    }

    // eBay country codes
    if (urlLower.includes('ebay.')) {
      if (urlLower.includes('.co.uk') || urlLower.includes('ebay.co.uk')) {
        return 'GBP';
      }
      if (urlLower.includes('.de') || urlLower.includes('ebay.de')) {
        return 'EUR';
      }
      if (urlLower.includes('.fr') || urlLower.includes('ebay.fr')) {
        return 'EUR';
      }
      if (urlLower.includes('.ca') || urlLower.includes('ebay.ca')) {
        return 'CAD';
      }
      if (urlLower.includes('.in') || urlLower.includes('ebay.in')) {
        return 'INR';
      }
      if (urlLower.includes('.au') || urlLower.includes('ebay.com.au')) {
        return 'AUD';
      }
      // Default to USD for eBay
      return 'USD';
    }

    // Default fallback
    return 'USD';
  }

  private extractCurrencyFromPrice(priceText: string): string {
    if (priceText.includes('€')) return 'EUR';
    if (priceText.includes('$')) return 'USD';
    if (priceText.includes('£')) return 'GBP';
    if (priceText.includes('¥')) return 'JPY';
    if (priceText.includes('CAD') || priceText.includes('C$')) return 'CAD';
    if (priceText.includes('AUD') || priceText.includes('A$')) return 'AUD';
    return 'USD';
  }

  private extractWeight(text: string): number | undefined {
    // Try kg first
    const kgMatch = text.match(/([\d.]+)\s*(?:kg|kilograms?|kilo)/i);
    if (kgMatch) {
      return parseFloat(kgMatch[1]);
    }

    // Try grams
    const gMatch = text.match(/([\d.]+)\s*(?:g|grams?)/i);
    if (gMatch) {
      return parseFloat(gMatch[1]) / 1000; // Convert to kg
    }

    // Try pounds
    const lbMatch = text.match(/([\d.]+)\s*(?:lb|lbs|pounds?)/i);
    if (lbMatch) {
      return parseFloat(lbMatch[1]) * 0.453592; // Convert to kg
    }

    return undefined;
  }

  private extractWeightFromJsonLd(
    jsonLd: JsonLdProduct | null,
  ): number | undefined {
    if (!jsonLd?.weight) return undefined;

    const weight = jsonLd.weight;
    if (typeof weight === 'string') {
      return this.extractWeight(weight);
    }
    if (typeof weight === 'object' && 'value' in weight) {
      const quantitativeValue = weight;
      const value = quantitativeValue.value;
      if (typeof value === 'string') {
        return this.extractWeight(value);
      }
      if (typeof value === 'number') {
        return value; // Assume kg
      }
    }
    if (typeof weight === 'number') {
      return weight; // Assume kg
    }
    return undefined;
  }

  private extractImagesFromJsonLd(image: JsonLdProduct['image']): string[] {
    if (!image) return [];
    if (typeof image === 'string') return [image];
    if (Array.isArray(image)) {
      return image
        .map((img) => {
          if (typeof img === 'string') return img;
          if (typeof img === 'object' && 'url' in img) {
            return (img as JsonLdImageObject).url;
          }
          return null;
        })
        .filter((img): img is string => img !== null);
    }
    if (typeof image === 'object' && 'url' in image) {
      return [image.url];
    }
    return [];
  }

  private cleanText(text: string): string {
    if (!text) return '';

    return text.replace(/\s+/g, ' ').trim();
  }

  private hashUrl(url: string): string {
    // Simple hash for cache key
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Extract product variants (size, color, etc.) from JSON-LD and HTML
   * Returns undefined if no variants found
   */
  private extractVariants(
    $: ReturnType<typeof cheerio.load>,
    html: string,
    jsonLd: JsonLdProduct | null,
    source: ProductSource,
  ): Record<string, any> | undefined {
    const variants: Record<string, any> = {};

    // Try JSON-LD first
    if (jsonLd) {
      // Extract from additionalProperty
      if (
        jsonLd.additionalProperty &&
        Array.isArray(jsonLd.additionalProperty)
      ) {
        jsonLd.additionalProperty.forEach((prop) => {
          if (prop.name && prop.value !== undefined) {
            const propName = prop.name.toLowerCase();
            if (
              propName.includes('size') ||
              propName.includes('color') ||
              propName.includes('material') ||
              propName.includes('style')
            ) {
              variants[prop.name] = prop.value;
            }
          }
        });
      }

      // Extract direct properties
      if (jsonLd.size) {
        variants.size = Array.isArray(jsonLd.size)
          ? jsonLd.size
          : [jsonLd.size];
      }
      if (jsonLd.color) {
        variants.color = Array.isArray(jsonLd.color)
          ? jsonLd.color
          : [jsonLd.color];
      }
      if (jsonLd.material) {
        variants.material = Array.isArray(jsonLd.material)
          ? jsonLd.material
          : [jsonLd.material];
      }

      // Extract from hasVariant (if product has multiple variants)
      if (jsonLd.hasVariant && Array.isArray(jsonLd.hasVariant)) {
        const variantOptions: Record<string, string[]> = {};
        jsonLd.hasVariant.forEach((variant) => {
          if (variant.size) {
            const sizes = Array.isArray(variant.size)
              ? variant.size
              : [variant.size];
            variantOptions.size = [
              ...(variantOptions.size || []),
              ...sizes.map((s) => String(s)),
            ];
          }
          if (variant.color) {
            const colors = Array.isArray(variant.color)
              ? variant.color
              : [variant.color];
            variantOptions.color = [
              ...(variantOptions.color || []),
              ...colors.map((c) => String(c)),
            ];
          }
        });
        if (Object.keys(variantOptions).length > 0) {
          Object.assign(variants, variantOptions);
        }
      }
    }

    // HTML fallback - store-specific selectors
    if (Object.keys(variants).length === 0) {
      switch (source) {
        case ProductSource.AMAZON:
          // Amazon variant selectors
          const amazonSize = $('#variation_size_name .a-button-text')
            .map((_, el) => $(el).text().trim())
            .get();
          const amazonColor = $('#variation_color_name .a-button-text')
            .map((_, el) => $(el).text().trim())
            .get();
          if (amazonSize.length > 0) variants.size = amazonSize;
          if (amazonColor.length > 0) variants.color = amazonColor;
          break;

        case ProductSource.SHEIN:
          // Shein variant selectors
          const sheinSize = $('[class*="size"] option')
            .map((_, el) => $(el).text().trim())
            .get()
            .filter((s) => s && !s.includes('Select'));
          const sheinColor = $('[class*="color"] [class*="item"]')
            .map((_, el) => $(el).attr('title') || $(el).text().trim())
            .get();
          if (sheinSize.length > 0) variants.size = sheinSize;
          if (sheinColor.length > 0) variants.color = sheinColor;
          break;

        case ProductSource.HM:
          // H&M variant selectors
          const hmSize = $('.product-item-size-selector option')
            .map((_, el) => $(el).text().trim())
            .get()
            .filter((s) => s && !s.includes('Select'));
          const hmColor = $('.product-item-color-selector [data-color]')
            .map((_, el) => $(el).attr('data-color') || $(el).attr('title'))
            .get();
          if (hmSize.length > 0) variants.size = hmSize;
          if (hmColor.length > 0) variants.color = hmColor;
          break;

        case ProductSource.NIKE:
          // Nike variant selectors
          const nikeSize = $('[data-testid="size-selector"] button')
            .map((_, el) => $(el).text().trim())
            .get();
          const nikeColor = $('[data-testid="color-selector"] button')
            .map((_, el) => $(el).attr('aria-label') || $(el).text().trim())
            .get();
          if (nikeSize.length > 0) variants.size = nikeSize;
          if (nikeColor.length > 0) variants.color = nikeColor;
          break;

        case ProductSource.ZARA:
          // Zara variant selectors
          const zaraSize = $('.product-detail-info__size-list button')
            .map((_, el) => $(el).text().trim())
            .get();
          const zaraColor = $('.product-detail-info__color-list button')
            .map((_, el) => $(el).attr('title') || $(el).text().trim())
            .get();
          if (zaraSize.length > 0) variants.size = zaraSize;
          if (zaraColor.length > 0) variants.color = zaraColor;
          break;
      }
    }

    // Return undefined if no variants found (to keep it optional)
    return Object.keys(variants).length > 0 ? variants : undefined;
  }
}
