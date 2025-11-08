// src/services/stripeService.js
import { loadStripe } from '@stripe/stripe-js';

const stripePublicKey = process.env.REACT_APP_STRIPE_PUBLIC_KEY || 'pk_test_51SRCXqCIJObwi2H9JP3sInjOtPofawDMq5zyzo9pFByQkwB16ZsmljT32xgGv7c0C9FySQHuoDfcbULGBbE85Hu600dDyRqCwC';

// Initialize Stripe
let stripePromise = null;
const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(stripePublicKey);
  }
  return stripePromise;
};

export default getStripe;