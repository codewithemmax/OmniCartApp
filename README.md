# OmniCart - Unified E-commerce Hub

OmniCart is a Next.js 15 application that aggregates product listings from Jumia, Konga, Temu, and Amazon into a single, cohesive interface. It provides a unified shopping experience with smart features like bundle detection, price drop alerts, social proof aggregation, and personalized recommendations.

## Features

### Core Functionality
- **Unified Search**: Search across all platforms simultaneously with parallel API calls
- **Smart Fallback Logic**: Prioritizes in-stock items from preferred sources
- **Real-time Product Data**: Live product listings with images, prices, and direct links
- **Source Badging**: Clear visual indicators for each e-commerce platform

### Advanced Features
- **Bundle Detector**: Automatically suggests complete bundles (e.g., iPhone + case + charger) across platforms
- **Price Drop Alerts**: Email notifications when saved searches drop below target prices
- **Social Proof Aggregation**: Unified trust scores combining ratings and reviews from all sources
- **Personalized Recommendations**: AI-powered suggestions based on user search history
- **Admin Dashboard**: Comprehensive analytics on user behavior, popular queries, and platform performance

### User Experience
- **Responsive Design**: Mobile-first layout with 2-5 column grids
- **URL-based State**: Browser back button works perfectly for searches and filters
- **Guest Access**: Search without registration, with optional account features
- **Visual Hierarchy**: Amazon products featured prominently, Jumia sections below

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Authentication**: NextAuth v5 with JWT strategy
- **Database**: MongoDB Atlas with Mongoose ODM
- **Styling**: Tailwind CSS with custom orange theme (#FF6600)
- **APIs**: RapidAPI integrations for Jumia and Amazon product data
- **Email**: Nodemailer for price alert notifications
- **Deployment**: Vercel-ready with Edge Runtime optimization

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB Atlas account
- RapidAPI account with Jumia and Amazon API subscriptions

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd omnicart
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables in `.env.local`:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/omnicart
AUTH_SECRET=your-random-32-char-secret
RAPIDAPI_KEY=your-rapidapi-key
ADMIN_EMAIL=your-admin-email@example.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
CRON_SECRET=your-cron-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## API Endpoints

### Public Endpoints
- `GET /` - Homepage with trending products
- `GET /?q=search-term` - Search results
- `POST /api/auth/register` - User registration
- `POST /api/auth/[...nextauth]` - Authentication

### Protected Endpoints
- `GET /api/alerts` - User's price alerts
- `POST /api/alerts` - Create price alert
- `DELETE /api/alerts` - Delete price alert
- `GET /api/alerts/check` - Cron endpoint for price checks

### Admin Endpoints
- `GET /admin` - Admin dashboard
- `GET /api/admin/stats` - Admin statistics

## Project Structure

```
app/
├── api/                    # API routes
│   ├── admin/stats/       # Admin analytics
│   ├── alerts/            # Price alerts
│   ├── auth/              # Authentication
│   └── debug/             # Debug endpoint
├── components/            # React components
│   ├── AlertButton.tsx    # Price alert UI
│   ├── AmazonFeatured.tsx # Amazon hero section
│   ├── AuthProvider.tsx   # NextAuth provider
│   ├── BundlePanel.tsx    # Bundle suggestions
│   ├── Filters.tsx        # Search filters
│   ├── PersonalizedSection.tsx # User recommendations
│   ├── ProductCard.tsx    # Product display
│   ├── ProductGrid.tsx    # Product layout
│   ├── SearchBar.tsx      # Search input
│   ├── TrustScore.tsx     # Rating aggregation
│   └── UserMenu.tsx       # User navigation
├── lib/                   # Utility functions
│   ├── auth.ts            # NextAuth config
│   ├── auth.edge.ts       # Edge-safe auth
│   ├── bundleDetector.ts  # Bundle logic
│   ├── fetchProducts.ts   # API integrations
│   ├── mailer.ts          # Email service
│   ├── mongodb.ts         # Database connection
│   ├── models/            # Mongoose models
│   ├── recommendations.ts # Personalization
│   ├── searchLogger.ts    # Search tracking
│   └── types.ts           # TypeScript types
├── admin/                 # Admin dashboard
├── login/                 # Login page
├── register/              # Registration page
└── layout.tsx             # Root layout
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with Next.js and Tailwind CSS
- Product data from Jumia and Amazon via RapidAPI
- Authentication powered by NextAuth.js
- Database hosting by MongoDB Atlas
