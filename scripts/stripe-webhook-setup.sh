#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# PlayStake - Stripe Webhook Local Development Setup
# ---------------------------------------------------------------------------
#
# This script helps set up Stripe CLI webhook forwarding for local
# development. The Stripe webhook handler at /api/webhooks/stripe needs
# to receive real Stripe events to process deposits and withdrawals.
#
# Prerequisites:
#   - Stripe CLI installed (https://stripe.com/docs/stripe-cli)
#   - A Stripe account with test mode API keys
#
# ---------------------------------------------------------------------------

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}PlayStake - Stripe Webhook Setup${NC}"
echo "================================="
echo ""

# Check if Stripe CLI is installed
if ! command -v stripe &> /dev/null; then
  echo -e "${RED}Stripe CLI is not installed.${NC}"
  echo ""
  echo "Install it with one of the following:"
  echo ""
  echo "  macOS (Homebrew):"
  echo "    brew install stripe/stripe-cli/stripe"
  echo ""
  echo "  Linux (apt):"
  echo "    sudo apt install stripe"
  echo ""
  echo "  Docker:"
  echo "    docker run --rm -it stripe/stripe-cli"
  echo ""
  echo "  See: https://stripe.com/docs/stripe-cli#install"
  exit 1
fi

echo -e "${GREEN}Stripe CLI found.${NC}"
echo ""

# Check if user is logged in
if ! stripe config --list &> /dev/null 2>&1; then
  echo -e "${YELLOW}You may need to log in to Stripe CLI:${NC}"
  echo "  stripe login"
  echo ""
fi

# ---------------------------------------------------------------------------
# Forward webhooks to local dev server
# ---------------------------------------------------------------------------

echo "Starting webhook forwarding to localhost:3000/api/webhooks/stripe..."
echo ""
echo -e "${YELLOW}IMPORTANT:${NC} Copy the webhook signing secret (whsec_...) shown below"
echo "and add it to your .env file as STRIPE_WEBHOOK_SECRET."
echo ""
echo "Press Ctrl+C to stop."
echo ""

stripe listen --forward-to localhost:3000/api/webhooks/stripe \
  --events payment_intent.succeeded,payment_intent.payment_failed,payout.paid,payout.failed

# ---------------------------------------------------------------------------
# Useful test commands (run in a separate terminal):
# ---------------------------------------------------------------------------
#
# Trigger a successful payment:
#   stripe trigger payment_intent.succeeded
#
# Trigger a failed payment:
#   stripe trigger payment_intent.payment_failed
#
# Trigger a successful payout:
#   stripe trigger payout.paid
#
# Trigger a failed payout:
#   stripe trigger payout.failed
#
# List recent events:
#   stripe events list --limit 10
#
# Resend a specific event:
#   stripe events resend evt_xxxxxxxxxxxx
#
# ---------------------------------------------------------------------------
