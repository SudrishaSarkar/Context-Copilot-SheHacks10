# ContextCopilot Dashboard

A React dashboard web application for ContextCopilot Chrome extension.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the development server:**
   ```bash
   npm run dev
   ```

   This will start the server at `http://localhost:3000`

3. **Build for production:**
   ```bash
   npm run build
   ```

   This creates a `dist` folder with production-ready files.

## Pages

- `/` - Landing page with sign-up/login options
- `/login` - Login page
- `/signup` - Sign-up page
- `/dashboard` - Main dashboard (requires authentication)

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **React Router** - Routing

## Development

The dashboard runs on `http://localhost:3000` by default. Make sure this matches the `DASHBOARD_URL` in your Chrome extension.

## Deployment

You can deploy this to:
- **Vercel**: `vercel deploy`
- **Netlify**: Drag & drop the `dist` folder after building
- **GitHub Pages**: Configure in repository settings
