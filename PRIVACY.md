# Neya privacy policy

Updated: October 8, 2026

Neya is maintained by Malyaj Nailwal. This policy describes the Neya browser extension and the hosted studio at https://neya-eight.vercel.app.

## Shopping pages and extension storage

The extension examines page text, image elements, and product metadata locally to identify clothing. It runs on HTTP and HTTPS pages to support shopping across stores. Selecting an item sends its image URL, title, and a short list of candidate image URLs to the studio. Neya does not send the full shopping-page URL or product price as part of this selection.

Your configured studio URL is stored in browser extension sync storage and may sync through your browser account. The selected product and studio tab identifier are kept in browser session storage. Removing the extension clears its local extension storage; synced storage is subject to your browser provider's controls.

## Camera and garment images

The studio asks for camera permission when you start a live try-on. Camera video is sent from your browser to Decart for realtime processing, and the resulting video returns to your browser. Neya's application server does not record or store the camera stream. Stop the session or close the mirror to end streaming.

Selected or uploaded garment images are used to produce the try-on. Images may pass through Neya's server for preparation, and optional garment isolation sends an image to Decart. Neya does not persist these image files in its application database. Captures are downloaded to your device. Decart's processing and retention are governed by its own terms and privacy policy; this policy does not promise deletion by a third-party provider.

## Accounts and usage

The studio stores account details such as your name, email address, verification status, password hash, and authentication sessions. Authentication records may include IP addresses and browser user-agent information. Cookies keep you signed in.

Neya also stores try-on counts and limits, session identifiers, timestamps, status and duration, and an optional keyed fingerprint of a garment image URL. This fingerprint is used instead of storing the garment URL in the usage ledger. Administrators can manage account access and try-on limits.

Account and usage information is stored with Turso. Vercel hosts the studio and processes requests and operational logs. Decart provides image and video processing. If account email delivery is configured, Resend receives the recipient email address and the verification or password-reset message. Requests to these providers may include network information such as IP addresses under their respective service policies.

## Retention and controls

Account and usage records remain in the service until removed by the operator; the application currently has no automatic deletion schedule or self-service account deletion. Hosting logs, backups, and third-party processing follow the relevant provider's retention settings and policies.

You can stop a try-on, revoke camera permission in your browser, sign out, clear site data, or uninstall the extension. These actions do not automatically delete account records held by the studio. To request account deletion or ask a privacy question, use the [maintainer's GitHub profile](https://github.com/MalyajNailwal) or [open a support request](https://github.com/MalyajNailwal/neya-extension/issues) asking for a private follow-up channel. Do not include account identifiers or sensitive data in a public issue.

Changes to these practices will be reflected in this policy and its updated date.
