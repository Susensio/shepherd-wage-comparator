# ADR-0009: Sign in with Google's own button and an emailed code, offered on a skippable card, and upload the browser's offers without asking, instead of the Supabase redirect from Ajustes and a first-sign-in prompt

Status: Accepted
Date: 2026-10-30

## Context

On 30 October 2026 the first real sign-in worked, through ADR-0006's design: a «Entrar con Google» button in Ajustes, the Supabase OAuth redirect, and, on a first sign-in from a browser holding offers, a prompt to upload or discard them. The owner found three problems: Google's screen read «Sign in to etvrgexvjviavulflcqr.supabase.co», since Google names the domain the login returns to; signing in was hidden in Ajustes; and the upload prompt asked a question whose answer is nearly always «upload». They asked for the usual sign-in screen, with the Google accounts listed and Google or another way to choose.

Weighed and discarded:
- A custom domain for the Supabase project, so the redirect names our own domain: a paid plan plus a paid add-on, for a page with few users.
- Google's brand verification: it shows the app name only for a verified domain the owner controls, and the page lives on `github.io`.
- Sign-in required to use the page: ends ADR-0006's browser-only tier, which the owner kept.
- Microsoft, Apple or GitHub as further providers: each needs a developer registration (Apple a paid one), and few shepherds have GitHub accounts.
- An emailed link only: on a phone, the link often opens in the mail app's own browser, which lacks the PKCE verifier of the browser that asked for it.

## Decision

- Google sign-in uses Google Identity Services: Google's button and its account chooser, hashed nonce, and the ID token handed to Supabase with `signInWithIdToken`. The page never leaves for Google. The Supabase redirect stays only as the fallback when Google's script does not load.
- The other way in is an emailed six-digit code (Supabase's OTP), typed into the page; the same email also carries the link, which works when opened in the same browser.
- A sign-in card heads the page while signed out, until signed in or dismissed with «Continuar sin cuenta», which is remembered. The same choices sit in Ajustes → Cuenta.
- On a first sign-in, the browser's offers that the account lacks are uploaded and merged by id, without asking. Only if the upload fails is the person asked to retry or to keep the account's copy.

## Consequences

- ADR-0006's «the anonymous tier never touches the network» narrows: while the sign-in card or the signed-out Cuenta section is on screen, Google's script loads from `accounts.google.com`. A dismissed card and the Ajustes section closed again leave the page offline.
- The Google OAuth client needs the page's origins as Authorized JavaScript origins, besides the Supabase callback.
- Supabase's built-in email sender reached only the project's team, two emails an hour, and on the free plan its templates could not be changed to carry the code. The email way in was built but left switched off in the page's account config until the project has a custom SMTP sender and templates with `{{ .Token }}`.
- A browser signed out of one account and into another uploads the first account's offers still cached there into the second.

