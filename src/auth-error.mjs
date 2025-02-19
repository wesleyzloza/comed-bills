//@ts-check
/**
 * Authentication Error
 */
export class AuthenticationError extends Error {
  /**
   * Constructs a new authentication error.
   * @param {string} message Error message.
   */
  constructor(message) { 
    super(message);
    this.name = this.constructor.name;
  }
}
