// typedefs.js
/**
 * ComEd API Response
 * @typedef {Object} ComEdResponse
 * @property {boolean} success Response Status
 * @property {any} data Response Date
 */

/**
 * ComEd Billing and Payment History
 * @typedef {Object} ComEdBillingHistory
 * @property {ComEdBillDetails[]} billing_and_payment_history Billing and Payment History 
 */

/**
 * ComEd Bill Details
 * @typedef {Object} ComEdBillDetails
 * @property {string} type Type
 * @property {string} date Date
 * @property {string} payment_id Payment I.D.
 * @property {number} charge_amount Charge Amount [$USD]
 * @property {number} total_amount_due Total Amount Due [$USD]
 */
