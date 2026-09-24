# bigredbox AI Exposure Map - proof of concept

Review build of the public site for the bigredbox third-party AI risk platform.

- Static: HTML, CSS, JS. No build step, no cookies, no analytics, no third-party requests.
- Strict CSP (no inline script or style). Fonts self-hosted.
- Demo data is illustrative; supplier names are fictional.
- Register-interest form is inactive on this staging host. On bigredbox.co.uk it posts to `api/lead.php` on bigredbox's own hosting.
