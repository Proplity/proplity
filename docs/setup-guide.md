# Proplity — First-Time Platform Setup Guide

This guide walks through the one-time setup step required after your
Proplity instance is deployed: creating the platform's first administrator
account. It is written for whoever is deploying or configuring the
application — no coding knowledge required, just access to the deployed
site and its environment configuration.

---

## What this is

A brand-new Proplity deployment has a database with no user accounts in it
at all — including no administrator. Before anyone can log in and start
managing properties, tenants, or vendors, one administrator account has to
be created first.

Proplity includes a **First-Time Setup Wizard** for exactly this: a simple
form at `/setup` that creates that first administrator account. Once it's
used, it permanently switches itself off — it cannot be run a second time on
the same deployment, and the URL becomes inactive.

## Before you start

Make sure the following are already true:

- The application has been deployed and is reachable at its production URL
  (for example, `https://app.yourcompany.com`).
- The database has been migrated (your technical team or deployment
  pipeline runs this automatically as part of deployment).
- You know the production URL. You do **not** need a username or password
  yet — that's what this wizard creates.

If your technical team configured a **Setup Token** for extra security (see
"Setup Token" below), have that value ready — you'll be asked for it during
setup.

## Step-by-step

1. **Open the setup page.**
   Go to `https://<your-domain>/setup` in a web browser (replace
   `<your-domain>` with your actual deployment URL).

   - If the page shows the setup form, continue to step 2.
   - If you're instead redirected straight to the login page, setup has
     already been completed on this deployment — see "Already set up?"
     below.

2. **Fill in the administrator's details.**
   - **Administrator Name** — the name that will appear for this account.
   - **Admin Email Address** — the email address this administrator will
     log in with. This does not need to be a working inbox for setup to
     succeed, but it should be one you can access going forward, since it
     becomes the login for the account.
   - **Setup Token** (only shown if your deployment requires one) — enter
     the value provided by your technical team.
   - **Password** and **Confirm Password** — choose a strong password.
     Requirements are shown live as you type:
     - At least 8 characters
     - Contains both letters and numbers
     - Both password fields match

3. **Submit the form.**
   Click **Complete Platform Setup**. This takes a few seconds.

4. **Confirmation.**
   On success, you'll see a confirmation screen showing the administrator
   email that was just created, and the wizard confirms it has now
   permanently disabled itself. You'll be redirected to the login page
   automatically after a few seconds (or you can click **Proceed to
   Login**).

5. **Log in.**
   Use the email and password you just set to log in. You'll land in the
   admin console, from which you can create additional accounts, configure
   properties, and manage the platform.

That's it — setup is complete, and this is a one-time step for the life of
this deployment.

## Already set up?

If you (or someone on your team) already completed this step, visiting
`/setup` again will not show the form — it redirects straight to the login
page instead. This is expected and correct: it means the platform already
has its first administrator and doesn't need to be set up again.

If you need a **second** administrator account, that's a different, ongoing
capability — it's created from inside the admin console after logging in,
not through this one-time wizard.

## Setup Token (optional extra security)

Some deployments are configured with an additional **Setup Token** — a
secret value your technical team sets during deployment. If one is
configured, the setup form will show an extra "Deployment Setup Token"
field, and setup cannot be completed without the correct value.

This exists to prevent a narrow but real risk: on a fresh deployment,
whoever reaches `/setup` first becomes the administrator. If your
deployment is reachable on the public internet before you've had a chance
to complete setup yourself, a Setup Token ensures only someone who has that
value (i.e., your own team) can actually complete it. If your team hasn't
mentioned a Setup Token to you, your deployment likely isn't using one, and
the field won't appear at all.

## Troubleshooting

**"Platform setup has already been completed."**
Someone has already completed this step on this deployment (possibly by
someone else on your team, or automatically if the deployment was created
from a pre-configured template). Use the login page instead. If you
believe this is incorrect, contact your technical team — administrator
accounts can be added from the admin console once someone is logged in.

**"Invalid or missing setup token."**
Your deployment requires a Setup Token and either none was entered, or the
value entered doesn't match. Confirm the correct value with your technical
team.

**"Too many setup attempts from this IP. Please try again later."**
For security, setup attempts are rate-limited. Wait a few minutes and try
again.

**The `/setup` page won't load at all.**
This usually means the deployment itself isn't reachable yet, or is still
being deployed/migrated. Confirm with your technical team that deployment
has finished.

---

_This document covers the one-time initial setup step only. For day-to-day
platform administration — adding staff accounts, managing properties, and
so on — see the in-app admin console after logging in._
