// @ts-check
/// <reference path="./typedefs.mjs" />

import chalk from 'chalk';
import fsp from 'fs/promises';
import path from 'path';
import puppeteer from 'puppeteer';
import { API_URL, BASE_URL, LOGIN_URL } from './constants.mjs';
import { format, sub } from 'date-fns';
import { AuthenticationError } from './auth-error.mjs';
import { TemporaryStorage } from './storage.mjs';

/**
 * ComEd Bill Download Utility
 * @description A utility for bulk downloading utility bills from ComEd
 * company. Unlike the web portal, this utility can collect bills beyond
 * two year range and utilizes polling to estimate issue dates.
 */
export class ComEdBillDownloader {
  /**
   * Authentication status.
   * @description Specifies whether the user has successfully authenticated.
   * @type {boolean}
   */
  #isAuthenticated = false;

  /**
   * The bearer token associated with the active session.
   * @type {string | undefined}
   */
  #bearerToken = undefined;

  /**
   * The active account number/context.
   * @type {string | undefined}
   */
  #activeAccount = undefined;

  /**
   * Session cookies.
   * @type {import('puppeteer').Cookie[]}
   */
  #sessionCookies = [];

  /**
   * Session cookies as HTTP header string.
   */
  get _sessionCookiesHttpString() {
    return this.#sessionCookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
  }

  /**
   * Performs authentication using the provided username and password.
   * @description Attempts to create an active session with the ComEd API.
   * The user will be required to sign if a previous session isn't available or
   * has expired. A browser window is opened to the ComEd login page if
   * authentication is required. The browser waits until the user has
   * successfully authenticated before closing and storing the necessary
   * session cookies needed for subsequent API request.
   * @param {string} username Username
   * @param {string} password Password
   */
  async authenticate(username, password) {
    // Step 1: Check if the user has a previous session that has been persisted
    // in the temporary storage directory. If the session is still valid, then
    // user is authenticated.
    const cookies = await ComEdBillDownloader.getCookies(username);
    if (cookies && !ComEdBillDownloader.hasSessionExpired(cookies)) {
      this.#sessionCookies = cookies;
      this.#isAuthenticated = true;
      this.#bearerToken = await this.getBearerToken();
      return;
    };

    // Step 2: The user does not have an active session and therefore must
    // authenticate against with the webserver.
    const apiUrl = new URL(BASE_URL);
    const apiOrigin = apiUrl.origin;

    // Default viewport set to null to get more natural behavior:
    // https://github.com/puppeteer/puppeteer/issues/3688#issuecomment-453218745
    const browser = await puppeteer.launch({ headless: false, defaultViewport: null });
    const pages = await browser.pages();
    const page = pages[0];

    // Step 2.1: Navigate to the login page and wait for the page to be
    // redirected to the Azure B2C login portal.
    await Promise.all([
      page.goto(LOGIN_URL),
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 0 }),
    ]);

    // Step 2.2: Fill in the users credentials and attempt to automatically
    // login on their behalf.
    await page.locator('#signInName').fill(username);
    await page.locator('#password').fill(password);
    await page.locator('#next').click();

    // Step 2.3: Wait for any any additional authentication steps to complete.
    // There may be several steps as the user may have two factor authentication
    // enabled. The user is assumed to be authenticated if the page URL matches
    // the ComEd domain/origin.
    let isSignedIn = false;
    while (isSignedIn === false) {
      await page.waitForNavigation({ timeout: 0 });
      const currentOrigin = new URL(page.url()).origin;
      isSignedIn = currentOrigin === apiOrigin;
    }

    // Step 2.4: Close the browser and return the page cookies so they can be
    // used for authentication in later requests.
    this.#sessionCookies = await page.cookies();
    this.#isAuthenticated = true;
    this.#bearerToken = await this.getBearerToken();
    try { ComEdBillDownloader.saveCookies(username, this.#sessionCookies )} catch {}
    browser.close();
  }

  /**
   * Determines whether the cookies associated with a ComEd session have expired.
   * @param {import('puppeteer').Cookie[]} cookies An array of cookies.
   * @return {boolean} Returns a boolean that specifies whether the provided
   * session cookies are expired.
   * @private
   */
  static hasSessionExpired(cookies) {
    const domains = new Set(['secure.comed.com', '.secure.comed.com']);
    const now = Date.now();
    return cookies
      .filter(cookie => domains.has(cookie.domain) && cookie.session === false)
      .every(cookie => now <= cookie.expires);
  }

  /**
   * Gets the cookies, if any, the have been persisted in the temporary storage
   * directory for the provided user.
   * @param {string} username Username
   * @returns {Promise<import('puppeteer').Cookie[] | null>}
   * @private
   */
  static async getCookies(username) {
    const storage = new TemporaryStorage(username);
    const cookiesJSON = await storage.get('cookies');
    if (cookiesJSON === null) return null;
    try {
      return JSON.parse(cookiesJSON);
    } catch {
      return null;
    }
  }

  /**
   * Saves the provided cookies to the temporary storage directory. The username
   * provides defines the data context.
   * @param {string} username Username
   * @param {import('puppeteer').Cookie[]} cookies An array of cookies.
   * @returns {Promise<void>}
   * @private
   */
  static async saveCookies(username, cookies) {
    const storage = new TemporaryStorage(username);
    const cookieJSON = JSON.stringify(cookies);
    return storage.set('cookies', cookieJSON);
  }

  /**
   * Gets the JSON web token / bearer token for the logged in user. 
   * @private
   */
  async getBearerToken() {
    if (!this.#isAuthenticated) throw new AuthenticationError('Operation can only be performed after authentication.');
    const url = `${BASE_URL}api/services/myaccountservice.svc/getsession`;
    const response = await fetch(url, {
      headers: { cookie: this._sessionCookiesHttpString },
      method: 'GET'
    });
    
    if (response.ok === false) throw new Error('Failed to get bearer token.'); 
    const result = await response.json();
    return result.token;
  }

  /**
   * Sets the active account/context for subsequent API request.
   * @param {string} accountNumber Account Number
   * @private
   */
  async activateAccount(accountNumber) {
    const url = 'https://secure.comed.com/api/Services/AccountList.svc/ViewAccount';
    const body = JSON.stringify({ accountNumber });
    const response = await fetch(url, {
      headers: {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.5",
        "Content-Type": "application/json;charset=utf-8",
        "Sec-GPC": "1",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        cookie: this._sessionCookiesHttpString
      },
      referrer: "https://secure.comed.com/Pages/ChangeAccount.aspx",
      body,
      method: 'POST',
      mode: 'cors'
    });

    if (response.ok === false) throw new Error('Failed to activate the specified account.');

    this.#activeAccount = accountNumber;
  }

  /**
   * Gets the list of bills issued between the provided date range.
   * @param {Date} to Start date.
   * @param {Date} from End date.
   * @returns {Promise<import('./typedefs.mjs').ComEdBillDetails[]>}
   */
  async getBills(to, from) {
    if (!this.#isAuthenticated) throw new AuthenticationError('Operation can only be performed after authentication.');

    const dateFormatString = 'yyyy-MM-dd';
    const start = format(from, dateFormatString);
    const end = format(to, dateFormatString);
    const url = `${API_URL}${this.#activeAccount}/billing/history`;
    const body = JSON.stringify({
      start_date: start,
      end_date: end,
      statement_type: '01',
      biller_id: 'ComEdRegistered'
    });

    const response = await fetch(url, {
      headers: { 
        Authorization: `Bearer ${this.#bearerToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        cookie: this._sessionCookiesHttpString
      },
      body,
      method: 'POST'
    });

    if (response.ok === false) throw new Error('Unable to gather bills for the specified dates.');

    /**
     * @type {import('./typedefs.mjs').ComEdResponse}
     */
    const result = await response.json();

    /**
     * @type {import('./typedefs.mjs').ComEdBillingHistory}
     */
    const billingHistory = result.data;
    return billingHistory.billing_and_payment_history;
  }
  
  /**
   * Downloads the specified bill.
   * @param {import('./typedefs.mjs').ComEdBillDetails} bill Bill details.
   * @param {string} saveDirectory Save Directory
   * @private
   */
  async downloadBill(bill, saveDirectory) {
    const accountNumber = this.#activeAccount;
    const billDate = new Date(bill.date);
    const billDateFormatted = format(billDate, 'yyyy-MM-dd');
    const url = `${API_URL}${accountNumber}/billing/${billDateFormatted}/pdf`;
    const response = await fetch(url, { 
      headers: {
        Authorization: `Bearer ${this.#bearerToken}`,
        Accept: 'application/json',
        cookie: this._sessionCookiesHttpString
      }, 
      method: 'GET'
    });

    if (response.ok === false) {
      throw new Error(
        'Failed to download bill. ' +
        'The associated HTTP request was unsuccessful.', 
        { cause: response }
      );
    }

    const result = await response.json();
    const base64Pdf = result.data.billImageData;
    const fileName = `${accountNumber}-${billDateFormatted}.pdf`;
    const filePath = path.resolve(saveDirectory, fileName);
    await fsp.writeFile(filePath, base64Pdf, { encoding: 'base64' });
  }

  /**
   * Performs a bulk download of bills from the last 24 months.
   * @param {string} accountNumber Account Number
   * @param {string} saveDirectory Save Directory
   * @returns {Promise<void>}
   */
  async bulkDownload(accountNumber, saveDirectory) {
    if (this.#isAuthenticated === false) throw new AuthenticationError('Operation can only be performed after authentication.');
    if (this.#activeAccount !== accountNumber) await this.activateAccount(accountNumber);
    const to = new Date();
    const from = sub(to, { months: 12 });
    const bills = await this.getBills(to, from);
    for (const bill of bills) {
      const billDate = new Date(bill.date);
      const billDateFormat = 'MM/yyyy';
      console.log(chalk.blue(`Downloading bill for ${format(billDate, billDateFormat)}`));
      await this.downloadBill(bill, saveDirectory);
      console.log(chalk.green('Success!\n'));
    }
  }
}
