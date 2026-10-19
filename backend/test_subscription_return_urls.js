const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const controllerSource = fs.readFileSync(path.join(__dirname, 'controllers', 'subscriptionController.js'), 'utf8');

function loadController(frontendUrl) {
  const calls = { checkout: [], portal: [], metadata: [], errors: [], userLookups: 0 };
  const user = { _id: 'user-123', stripe_customer_id: 'cus_test' };
  const dependencies = {
    '../utils/stripe': {
      stripe: {
        checkout: {
          sessions: {
            update: async (...args) => calls.metadata.push(args)
          }
        }
      },
      stripeHelpers: {
        createCheckoutSession: async (...args) => {
          calls.checkout.push(args);
          return { id: 'cs_test', url: 'https://checkout.stripe.com/test' };
        },
        createBillingPortalSession: async (...args) => {
          calls.portal.push(args);
          return { url: 'https://billing.stripe.com/test' };
        }
      },
      SUBSCRIPTION_PLANS: {}
    },
    '../models/User': {
      findById: async () => {
        calls.userLookups++;
        return user;
      }
    },
    '../utils/catchAsync': require('./utils/catchAsync')
  };
  const context = {
    module: { exports: {} },
    require: (name) => {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    process: { env: { FRONTEND_URL: frontendUrl, SELF_BASE: 'https://api.example.com' } },
    URL,
    console: { log() {}, error: (...args) => calls.errors.push(args) }
  };
  vm.runInNewContext(controllerSource, context);
  return { controller: context.module.exports, calls };
}

function invoke(handler) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        resolve({ statusCode: this.statusCode, body });
      }
    };
    handler({ user: { id: 'user-123' }, body: { priceId: 'price_test', plan: 'monthly' } }, res, reject);
  });
}

for (const origin of ['https://thereplay.app', 'https://staging.example.com', 'http://localhost:3000']) {
  test(`checkout and portal return to ${origin}, not the API`, async () => {
    const { controller, calls } = loadController(`${origin}/`);
    const checkout = await invoke(controller.createCheckoutSession);
    assert.equal(checkout.statusCode, 200);
    assert.equal(checkout.body.data.sessionId, 'cs_test');
    assert.deepEqual(calls.checkout[0], [
      'cus_test',
      'price_test',
      `${origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      `${origin}/subscription/cancel`
    ]);
    assert.equal(calls.metadata[0][0], 'cs_test');
    assert.equal(calls.metadata[0][1].metadata.plan, 'monthly');
    const portal = await invoke(controller.createBillingPortalSession);
    assert.equal(portal.statusCode, 200);
    assert.deepEqual(calls.portal[0], ['cus_test', `${origin}/account/subscription`]);
    assert.equal(calls.errors.length, 0);
  });
}

for (const invalidUrl of [undefined, '', 'not-a-url', 'ftp://example.com', 'https://example.com/path', 'https://example.com?x=1', 'https://example.com#fragment', 'https://user:password@example.com']) {
  test(`rejects invalid FRONTEND_URL ${String(invalidUrl)} before creating Stripe sessions`, async () => {
    const { controller, calls } = loadController(invalidUrl);
    for (const handler of [controller.createCheckoutSession, controller.createBillingPortalSession]) {
      const response = await invoke(handler);
      assert.equal(response.statusCode, 500);
      assert.equal(response.body.status, 'error');
      assert.ok(response.body.error);
    }
    assert.equal(calls.userLookups, 0);
    assert.equal(calls.checkout.length, 0);
    assert.equal(calls.portal.length, 0);
    assert.equal(calls.errors.length, 2);
  });
}
