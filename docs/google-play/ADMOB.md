# AdMob production activation

Version 3.6.84: native Android CI enables real ad unit IDs by default unless repository variable ABYSSAL_ADMOB_PRODUCTION_ENABLED=false. ABYSSAL_ADMOB_TEST_MODE=true still overrides with demo IDs and must not be promoted as the stable APK. Before installing the production-ID build on developer hardware, register that device as a test device in AdMob (Settings > Test devices) or configure app-level test mode for this version. Never click or repeatedly view your own monetized ads. No test traffic revenue.

Server: explicitly set ABYSSAL_ADMOB_SSV_ENABLED=true in the existing VPS service environment after confirming SSV URLs for both rewarded units are https://abyssalgame.duckdns.org/api/admob/ssv, reward amount 1 and valid signatures. Restart only when no live players, check /api/runtime-config for admobSsvEnabled:true. Do not enable unverified rewards. Current SSV gate also affects web rewarded requests: verify web behavior separately before enabling; if web does not issue a ticket, rewards fail closed. Use a separate server test account for SSV end-to-end checks. Test ads may not produce usable SSV callbacks; do not grant production currency on unverified events.

Public app-ads.txt is included in public/; verify HTTPS response after deployment. Use https://abyssalgame.duckdns.org as developer website in Play listing, link published app in AdMob, verify app-ads.txt and app readiness. Google may limit delivery until approved.

Native ads are temporarily adult-only until teen-specific consent and ad request behavior are validated. No ad request or initialization on unknown/teen/under16 age bands. Existing offline gameplay remains available. Rewarded placements only: wheel (10 daily) and revive. No forced ads.

References: https://support.google.com/admob/answer/9388275 ; https://support.google.com/admob/answer/14538460 ; https://support.google.com/admob/answer/10564477
