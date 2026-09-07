# Audience Source

Use the connected Google Sheets integration as the production source of truth for the Minor AM Audience Monitor. Find and inspect the Google Sheet named “Minor AM — Social Media Monitoring Sheet”. Read the actual tabs, columns, timestamps and values before changing the dashboard. Use the live sheet data for the roster, latest Instagram/SoundCloud/Resident Advisor metrics, historical Instagram data and observation dates. Calculate dashboard metrics dynamically from the sheet rather than hard-coding the September snapshot. Missing data must remain missing, never zero. Keep Instagram, SoundCloud and Resident Advisor separate and never sum them into a total audience. Preserve actual observation dates. Add a visible Last refreshed timestamp and a graceful cached/fallback state if Google Sheets is temporarily unavailable. Do not expose credentials, formulas, scraping infrastructure, internal notes or data-quality debugging in the public/work-facing UI. Once connected, verify that Jennifer Loveless, Kiss Nuka, Zvrra and Aöcram all load correctly and that new rows added to the Google Sheet will automatically appear in the dashboard without requiring code changes.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://mam-ai.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ec1df76a-079e-4e4f-88c1-a0a919ade38f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
