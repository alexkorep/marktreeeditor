# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/15mormDQ9ERK0BnLer052APS2_KXljq9u

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploy to GitHub Pages

The repository includes a GitHub Actions workflow that publishes the production build to GitHub Pages whenever commits land on the `main` branch.

1. Enable GitHub Pages for the repository and select **GitHub Actions** as the source.
2. Ensure the `main` branch contains the workflow defined in [.github/workflows/deploy.yml](.github/workflows/deploy.yml).
3. Push to `main` (or trigger the workflow manually). The workflow sets the correct base path for the Vite build and deploys the contents of the `dist` folder to GitHub Pages.
