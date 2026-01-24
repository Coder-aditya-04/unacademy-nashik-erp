# Project Tech Stack Documentation

This document outlines the technologies, frameworks, and libraries used in the **Unacademy Nashik ERP** project.

## 1. Frontend
The application is built as a Single Page Application (SPA).

*   **Core Framework:** [React](https://react.dev/) (v19)
*   **Build Tool:** [Vite](https://vitejs.dev/) (v7) - For fast development and bundling.
*   **Language:** JavaScript (ES Modules) with JSX.
*   **Routing:** [React Router DOM](https://reactrouter.com/) (v7) - Client-side routing.

## 2. Styling & UI
*   **CSS Framework:** [Tailwind CSS](https://tailwindcss.com/) (v4) - Utility-first CSS framework.
*   **Icons:** [Lucide React](https://lucide.dev/) - Consistent and lightweight icon set.
*   **CSS Processing:** PostCSS & Autoprefixer.

## 3. Backend & Services (Serverless)
The project relies on **Firebase** for backend services.

*   **Platform:** [Firebase](https://firebase.google.com/) (v11)
*   **Database:** Cloud Firestore - NoSQL document database.
*   **Authentication:** Firebase Authentication (Login/Register flows).
*   **Storage:** Cloud Storage for Firebase - For storing user uploads/files.

## 4. Utilities & Libraries
*   **PDF Generation:**
    *   `jspdf` & `jspdf-autotable`: For generating PDF reports/receipts.
    *   `html2canvas`: For capturing DOM elements as images.

## 5. DevOps & Deployment
*   **Hosting:** [GitHub Pages](https://pages.github.com/) (via `gh-pages` package).
*   **Linting:** ESLint - For code quality and consistency.
*   **Version Control:** Git.

## 6. Project Structure Overview
*   `src/` - Source code.
*   `public/` - Static assets.
*   `firebase.json` & `*.rules` - Firebase configuration and security rules.
*   `vite.config.js` - Vite configuration.
*   `tailwind.config.js` - Tailwind configuration.
