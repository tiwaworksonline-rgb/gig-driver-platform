# GigReady — Fresh Start

Upload the CONTENTS of this folder directly to the root of your GitHub repository.

The repository root must contain:
- index.html
- vehicles.html
- server.js
- package.json
- render.yaml
- assets/

Do not upload a parent folder around these files.

## Render
Connect Render to the GitHub repository and deploy the root directory.

Required environment variables:
AIRTABLE_TOKEN
AIRTABLE_BASE_ID
AIRTABLE_APPLICANTS_TABLE
AIRTABLE_VEHICLES_TABLE
AIRTABLE_RENTALS_TABLE
AIRTABLE_FOLLOWUPS_TABLE
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
PUBLIC_BASE_URL
PORT

Optional:
AUTO_SEED_FLEET=true

Never commit real Airtable or Stripe secrets to GitHub.
