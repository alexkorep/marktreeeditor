# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/15mormDQ9ERK0BnLer052APS2_KXljq9u

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Configure Firebase:
   - Update [`services/firebaseConfig.ts`](services/firebaseConfig.ts) with your project's credentials.
   - In the Firebase console, enable **Cloud Firestore** for your project and ensure your security rules allow the authenticated user to read and write the `documents` collection. Firestore will create the collection automatically the first time a document is saved, so no manual table setup is required.
4. Run the app:
   `npm run dev`

### Progressive Web App

The editor is installable as a Progressive Web App. When you open the site in a supported browser, use the browser's **Install** or **Add to home screen** option to pin it like a native app. Core assets and documents you have opened are cached locally so the interface remains available while offline, and new changes are synchronized automatically once the network returns.

## Markdown import/export

Use the **Import** button in the editor toolbar to paste markdown that will replace the current outline. The **Export** button
opens a dialog where you can copy the generated markdown for the document.

## Deploy to GitHub Pages

The repository includes a GitHub Actions workflow that publishes the production build to GitHub Pages whenever commits land on the `main` branch.

1. Enable GitHub Pages for the repository and select **GitHub Actions** as the source.
2. Ensure the `main` branch contains the workflow defined in [.github/workflows/deploy.yml](.github/workflows/deploy.yml).
3. Push to `main` (or trigger the workflow manually). The workflow sets the correct base path for the Vite build and deploys the contents of the `dist` folder to GitHub Pages.
