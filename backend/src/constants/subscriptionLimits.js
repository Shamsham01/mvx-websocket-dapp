/**
 * Hard cap on subscription rows per user (API + optional DB trigger on Supabase).
 * Override with MAX_SUBSCRIPTIONS_PER_USER in Render/env.
 */
const MAX_SUBSCRIPTIONS_PER_USER = parseInt(process.env.MAX_SUBSCRIPTIONS_PER_USER, 10) || 10;

module.exports = {
  MAX_SUBSCRIPTIONS_PER_USER,
};
