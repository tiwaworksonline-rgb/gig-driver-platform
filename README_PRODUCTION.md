# GigReady production build — full booking-flow fix

## What this build fixes
- One consistent applicant session: `gigreadyApplicant`
- Eligibility redirects back into the selected-car booking flow
- `Request This Car` now creates a real Airtable vehicle hold + Rental record
- 30-minute vehicle holds and automatic release of expired holds
- Stripe Identity uses the real Applicant + Rental IDs
- Rental agreement verifies Stripe Identity before acceptance
- Stripe Checkout creates the weekly recurring rental subscription
- Checkout reconciliation handles webhook timing delays on the success page
- Pickup scheduling is blocked until Stripe checkout is complete
- Dashboard uses the secure applicant portal token
- Stripe Billing Portal is connected when a Stripe customer exists
- Vehicle photos have embedded fallback images, so the three starter models display even if asset paths fail
- Obsolete `/api/vehicle-request` flow removed from the user journey
- Dead placeholder support email removed
- Health endpoint reports Airtable/Stripe readiness

## Render environment variables
Set:
AIRTABLE_TOKEN
AIRTABLE_BASE_ID=appNbrwWOI6tVoB8G
AIRTABLE_APPLICANTS_TABLE=tblrn5pgRJJvoGkM4
AIRTABLE_VEHICLES_TABLE=tblu0eVkBBkIgJsCn
AIRTABLE_RENTALS_TABLE=tblQNZVJdAJxXz8wS
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
PUBLIC_BASE_URL=https://gig-driver-platform.onrender.com
AUTO_SEED_FLEET=true

`AUTO_SEED_FLEET=true` creates the three starter vehicle records only if the Vehicles table is completely empty. Turn it to `false` after real inventory is entered.

## Stripe webhook events
Use:
- identity.verification_session.verified
- checkout.session.completed
- invoice.paid
- invoice.payment_failed

Webhook URL:
`https://gig-driver-platform.onrender.com/api/stripe/webhook`

## End-to-end test
1. Open `/prequal.html`
2. Submit a test applicant that meets prequalification
3. Confirm an Applicant record appears in Airtable
4. Choose a car in `/vehicles.html`
5. Confirm the Vehicle becomes Reserved and a Rental record is created
6. Complete Stripe Identity in TEST mode
7. Accept agreement
8. Complete Stripe Checkout using a Stripe test card
9. Confirm success page reaches Pickup Pending
10. Schedule pickup
11. Open Driver Dashboard
12. Confirm Airtable Applicant, Rental and Vehicle statuses are consistent

## Important production note
The included agreement is a technical e-sign flow and operating draft. Before taking real renters or money, have Georgia counsel and the commercial auto insurer review the rental agreement, electronic-signature language, insurance allocation, recovery/default terms, privacy policy, and gig-platform representations.
