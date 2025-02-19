# ComEd Electricity Bill Downloader

A Node.js library to bulk download utility bills from the
[ComEd web portal](https://secure.comed.com/accounts/login).

## Background

Most utility companies don't provide a way to bulk download utility bills and
will limit the billing history to the last two years. This limit is often
restricted by the user interface and can be bypassed by querying the server
directly. This was the case for
[ComEd (Commonwealth Edison Company)](https://www.comed.com/)

## Usage

The `NicorGasBillDownloader` class contains the following methods to for
requesting and saving a bill for the Southern Gas Company customer portal:  

- `authenticate()` - Authenticates and performs the necessary server operations to download bills.
- `tryBulkDownload()` - Attempts to locate and download all bills within in range of dates.
- `tryDownloadingBill()` - Attempts to locate and download a bill for a specific month/year.
- `requestBill()` - Requests a bill for given issue date.

```javascript
import { sub } from 'date-fns';
import { NicorGasBillDownloader } from 'nicor-bills';

const ACCOUNT_NUMBER = '12349780000';
const USERNAME = 'JohnDoe';
const PASSWORD = 'FooBaBaz123';

const to = new Date();
const from = sub(to, { months: 2 });
const saveDirectory = import.meta.dirname;
const billDownloader = new NicorGasBillDownloader(ACCOUNT_NUMBER);
await billDownloader.authenticate(USERNAME, PASSWORD);
await billDownloader.tryBulkDownload(from, to, saveDirectory);
```

## System Requirements

- Node v18+
- x64 Architecture

<!--
https://github.com/puppeteer/puppeteer/blob/puppeteer-v23.0.0/docs/guides/system-requirements.md
-->

## License

MIT License
