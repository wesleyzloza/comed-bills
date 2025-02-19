import crypto from 'node:crypto'
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/**
 * Temporary Storage
 */
export class TemporaryStorage {
  /**
   * Constructs a new instance of temporary storage bucket.
   * @param {} bucketName Bucket name.
   */
  constructor(bucketName) {
    const hash = crypto.createHash('md5').update(bucketName).digest('hex');
    this._directory = path.resolve(os.tmpdir(), `bucket-${this._sanitizeKey(hash)}`);
  }

  /**
   * Sanities a key value so that it can be used as a file name.
   * @param {string} key Key
   * @private
   */
  _sanitizeKey(key) {
    // Replace invalid filename characters with underscores
    return key.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
  }

  /**
   * Saves the provided key-value pair to persistent storage.
   * @param {string} key Key
   * @param {string} value Value
   * @return {Promise<void>}
   */
  async set(key, value) {
    await fsp.mkdir(this._directory, { recursive: true });
    const filePath = path.join(this._directory, `${this._sanitizeKey(key)}.tmp`);
    await fsp.writeFile(filePath, value, 'utf8');
  }

  /**
   * Gets the value associated with the provided key from persistent storage.
   * @param {string} key Key
   * @returns {Promise<string | null>} Returns a promise that resolves to the
   * value associated with the provided key. The promise resolves to `null` if
   * no value is associated with the provided key.
   */
  async get(key) {
    try {
      const filePath = path.join(this._directory, `${this._sanitizeKey(key)}.tmp`);
      return await fsp.readFile(filePath, 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }
}
