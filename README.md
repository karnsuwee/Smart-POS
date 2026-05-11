com# Smart Shop POS

AI-powered POS web application for small food and drink shops. Each shop owner can create an account, manage their own menu, mark favorite menu items, create dine-in or takeaway orders, and review sales patterns in a dashboard. The AI stock insight feature uses sales data to recommend what ingredients should be prepared more or less to reduce waste and cost.

## Features

- User register, login, and logout with JWT authentication
- Shop-specific data using `ownerId`
- POS order flow: dine-in/takeaway, table selection, cart, checkout
- Menu CRUD with image URL, category, price, and stock unit
- Favorite menu items per shop account
- Dashboard with sales stats, top menus, and hourly sales chart
- Dark mode toggle persisted in the browser
- External API integration: Google Gemini API for AI stock planning insight
- MongoDB Atlas support through `.env`

## Tech Stack

- Frontend: HTML, CSS, Vanilla JavaScript
- Backend: Express.js
- Database: MongoDB Atlas with Mongoose
- Auth: JWT and bcrypt
- External API: Google Gemini API

## Setup

1. Install dependencies.

```bash
npm install
```

2. Create `.env` from the example file.

```bash
cp .env.example .env
```

3. Fill in your environment variables.

```env
PORT=3000
MONGO_URI=mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/smart-pos?retryWrites=true&w=majority
JWT_SECRET=change-this-to-a-long-random-secret
GEMINI_API_KEY=your-google-ai-studio-api-key
GEMINI_MODEL=gemini-1.5-flash
```

4. Run the app.

```bash
npm run dev
```

5. Open the app.

```text
http://localhost:3000
```

If `MONGO_URI` is missing or MongoDB cannot connect, the server starts in memory demo mode. Use MongoDB Atlas for the submitted deployed version.

## Deployment Notes

This project is one Express app that serves both the API and the frontend from `public/`, so it can be deployed as a single Node.js service. Backend code is split under `src/`; frontend JavaScript modules are split under `public/js/`.

Recommended deploy settings:

- Build command: `npm install`
- Start command: `npm start`
- Environment variables: `MONGO_URI`, `JWT_SECRET`, `GEMINI_API_KEY`, `GEMINI_MODEL`

## Project Requirement Mapping

- User Login: register, login, logout with saved users in MongoDB
- API Integration: `/api/ai/stock-insight` calls Google Gemini API and uses real sales data
- Deployed & Live: deploy the Express app to a public Node hosting provider
- Tier B Saved/Favorites: each shop can favorite menu items and see them after refresh/login
- Tier B Dashboard & Data Visualization: dashboard cards, top menu list, and sales chart
- Tier C Dark Mode: theme toggle persisted per browser

## Demo Script

1. Open the public URL in a fresh browser tab.
2. Register a new shop account.
3. Add or favorite menu items.
4. Choose dine-in, select a table, add menu items, and checkout.
5. Open Dashboard and show updated stats/chart.
6. Click AI Stock Insight and explain that it calls an external AI API using sales data.
7. Toggle dark mode.
8. Logout and login again to show the shop data persists.
