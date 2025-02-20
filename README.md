# ComEd Electricity Bill Downloader

A Node.js library to bulk download utility bills from the
[ComEd web portal](https://secure.comed.com/accounts/login).

<img
  alt="Down arrow colors matching branding of the Commonwealth Edison Company"
  src="./assets/icon.svg"
  height="128" width="128" style="margin: 0 auto;">

## Background

Utility companies often do not provide a way to bulk download bills/invoices.
This library allows users to download the utility bills that have been issued by
the [ComEd (Commonwealth Edison Company)](https://www.comed.com/) within the
last 24 months. **Unfortunately ComEd does not appear to provide a method of
gathering utility beyond 24 months.**

## Usage

The `ComEdBillDownloader` class contains the following methods to for
requesting and saving a bill from the Commonwealth Edison Company customer
portal:  

- `authenticate()` - Authenticates and performs the necessary server operations
  to download bills.
- `tryBulkDownload()` - Attempts to download all bills from the last 24 months.

```javascript
import { ComEdBillDownloader } from 'comed-bills';

const ACCOUNT_NUMBER = '12349780000';
const USERNAME = 'JohnDoe';
const PASSWORD = 'FooBaBaz123';

const saveDirectory = import.meta.dirname;
const downloader = new ComEdBillDownloader();
await downloader.authenticate(USERNAME, PASSWORD);
await downloader.bulkDownload(ACCOUNT_NUMBER, saveDirectory);
```

## System Requirements

- Node v18+
- x64 Architecture

<!--
https://github.com/puppeteer/puppeteer/blob/puppeteer-v23.0.0/docs/guides/system-requirements.md
-->

## License

MIT License
