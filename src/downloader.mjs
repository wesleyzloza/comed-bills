// @ts-check
import puppeteer from 'puppeteer';
import { BASE_URL, LOGIN_URL } from './constants.mjs';

/**
 * ComEd Bill Download Utility
 * @description A utility for bulk downloading utility bills from ComEd
 * company. Unlike the web portal, this utility can collect bills beyond
 * two year range and utilizes polling to estimate issue dates.
 */
export class ComEdBillDownloader {
  /**
   * ComEd API base URL.
   * @type {string}
   * @private
   */
  _baseURL = 'https://secure.comed.com/';

  /**
   * Authentication status.
   * @description Specifies whether the user has successfully authenticated.
   * @type {boolean}
   * @private
   */
  _isAuthenticated = false;

  /**
   * Session cookies.
   * @type {import('puppeteer').Cookie[]}
   * @private
   */
  _sessionCookies = [];

  /**
   * Determines whether the active session has expired. If true, then the 
   * user will be required to reauthenticate.
   * @return {boolean}
   */
  hasSessionExpired() {
    const now = Date.now();
    const expirationDate = this._sessionCookies
      .filter(cookie => cookie.session)[0].expires;
    return now >= expirationDate;
  }

  /**
   * Authenticates the user by spawning a browser window and navigating to the
   * ComEd login page. The browser waits until the user has successfully
   * authenticated before closing and storing the necessary session cookies.
   */
  async authenticate() {
    const apiUrl = new URL(BASE_URL);
    const apiOrigin = apiUrl.origin;

    // Default viewport set to null to get more natural behavior:
    // https://github.com/puppeteer/puppeteer/issues/3688#issuecomment-453218745
    const browser = await puppeteer.launch({ headless: false, defaultViewport: null });
    const pages = await browser.pages();
    const page = pages[0];

    // Step 1: Navigate to the login page and wait for the page to be redirected
    // to the Azure B2C login portal.
    await Promise.all([
      page.goto(LOGIN_URL),
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 100000 }),
    ]);

    // Step 2: Wait for the user to input their credentials and login. There
    // may be several steps as the user may have two factor authentication
    // enabled. The user is assumed to be authenticated if the page URL matches
    // the ComEd domain/origin.
    let isSignedIn = false;
    while (isSignedIn === false) {
      await page.waitForNavigation();
      const currentOrigin = new URL(page.url()).origin;
      isSignedIn = currentOrigin === apiOrigin;
    }

    // Step 3: Close the browser and return the page cookies so they can be used
    // for authentication in later requests.
    this._sessionCookies = await page.cookies();
    this._isAuthenticated = true;
    browser.close();
  }
}
