# 🚀 Chroma Pour - Play Store Deployment Guide

This guide will help you turn your web game into a downloadable Android App for the Google Play Store.

## 1. Web Hosting (Prerequisite)
Your PWA must be hosted online first.
*   **GitHub Pages**: I've already added an automated workflow in `.github/workflows/deploy.yml`. 
    *   Simply push your code to a GitHub repository named `main`.
    *   Go to **Settings > Pages** on GitHub and set the source to **GitHub Actions**.

## 2. Generate Android Project (Bubblewrap)
Bubblewrap is the official Google tool for turning PWAs into Android apps.

1.  **Install the CLI**:
    ```bash
    npm install -g @bubblewrap/cli
    ```
2.  **Initialize**:
    ```bash
    bubblewrap init --manifest=https://your-domain.com/manifest.webmanifest
    ```
    *   *Follow the prompts to set your App Name, ID (e.g., com.yourname.chromapour), and Icons.*
3.  **Build**:
    ```bash
    npm run build:android
    ```
    *   This will generate a `.aab` (Android App Bundle) file in your folder.

## 3. Play Store Submission Check-list
*   [ ] **Google Play Console**: Create an account ($25 one-time fee).
*   [ ] **Assets**:
    *   **App Icon**: Use `public/pwa-512x512.png`.
    *   **Feature Graphic**: 1024x500 image (I can help you generate one).
    *   **Screenshots**: Take 2-4 screenshots of the game levels.
*   [ ] **Privacy Policy**: Use a free PWA privacy policy generator online and host it on your site/GitHub.

## 4. Key Security
When Bubblewrap asks to generate a "Signing Key", **KEEP IT SAFE**. You will need this same key to upload updates to your app in the future.

---
**Need help with specific step or an asset? Just ask!**
