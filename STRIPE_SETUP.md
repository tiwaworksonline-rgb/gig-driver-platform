# Stripe Identity + Weekly Billing Setup

## Customer flow
1. Applicant passes rental prequalification.
2. Applicant selects a vehicle.
3. Applicant requests a pickup date/window.
4. Applicant completes Stripe Identity document + selfie verification.
5. Server confirms Stripe Identity status is `verified`.
6. Stripe Checkout charges:
   - $500 refundable security deposit (one-time, initial invoice only)
   - first weekly rental payment
   - creates an automatic weekly subscription at the selected car's weekly rate
7. Checkout success page displays subscription and next payment information.
8. Stripe webhooks update CRM status.

## Required Render environment variables
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
PUBLIC_BASE_URL=https://gig-driver-platform.onrender.com

Keep the existing Airtable environment variables.

## Stripe dashboard
Use Stripe TEST MODE first.

Enable Stripe Identity.

Create a webhook destination:
https://gig-driver-platform.onrender.com/api/stripe/webhook

Subscribe to:
- identity.verification_session.verified
- checkout.session.completed
- invoice.paid
- invoice.payment_failed

Copy the webhook signing secret (starts `whsec_`) into Render as STRIPE_WEBHOOK_SECRET.

## Test
Use Stripe test mode until the complete flow is confirmed. Do not put a Stripe secret key in GitHub or browser JavaScript.
