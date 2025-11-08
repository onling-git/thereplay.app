# The Final Play - Football App with Stripe Subscriptions

A full-stack football application with premium subscription features powered by Stripe.

## Features

### Free Features
- ✅ Live Scores
- ✅ Basic Match Information
- ✅ Team Following (Single Team)

### Premium Features (Monthly/Yearly Subscription)
- 🔒 Premium Statistics & Analytics
- 🔒 Follow Multiple Teams
- 🔒 Ad-Free Experience
- 🔒 Push Notifications
- 🔒 Exclusive Content
- 🔒 API Access (Yearly subscribers only)

## Tech Stack

### Backend
- **Node.js** with Express
- **MongoDB** with Mongoose
- **Stripe** for subscription management
- **JWT** for authentication
- **Sportmonks API** for football data

### Frontend
- **React 19** with React Router
- **Stripe Elements** for payment processing
- **Context API** for state management

## Quick Start

### Prerequisites
- Node.js 20+
- MongoDB database
- Stripe account (test mode for development)
- Sportmonks API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd thefinalplay.com
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Environment Setup**
   
   **Backend (.env)**
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```
   
   **Frontend (.env)**
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

5. **Set up Stripe Products**
   ```bash
   cd backend
   npm run setup:stripe-products
   ```

6. **Start the application**
   
   **Backend:**
   ```bash
   cd backend
   npm run dev
   ```
   
   **Frontend:**
   ```bash
   cd frontend
   npm start
   ```

## Stripe Configuration

### 1. Create Stripe Account
1. Sign up at [stripe.com](https://stripe.com)
2. Get your test API keys from the dashboard
3. Add them to your `.env` files

### 2. Set up Products & Prices
Run the setup script to create subscription products:
```bash
cd backend
npm run setup:stripe-products
```

This creates:
- **Monthly Plan**: £9.99/month
- **Yearly Plan**: £99.99/year (17% savings)

### 3. Configure Webhooks
1. In Stripe Dashboard, go to Developers > Webhooks
2. Add endpoint: `https://your-domain.com/api/subscription/webhook`
3. Select these events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy the webhook secret to your `.env` file

## API Endpoints

### Subscription Management
- `GET /api/subscription/plans` - Get available subscription plans
- `POST /api/subscription/checkout` - Create checkout session
- `GET /api/subscription/status` - Get current subscription status
- `POST /api/subscription/cancel` - Cancel subscription
- `POST /api/subscription/reactivate` - Reactivate subscription
- `POST /api/subscription/billing-portal` - Create billing portal session
- `POST /api/subscription/webhook` - Stripe webhook handler

### User Management
- `POST /api/users/register` - User registration
- `POST /api/users/login` - User login
- `GET /api/users/me` - Get current user
- `PATCH /api/users/me` - Update user profile

## Subscription Flow

### 1. User Registration/Login
Users can register and use free features immediately.

### 2. Subscription Purchase
1. User visits `/subscription/plans`
2. Selects Monthly or Yearly plan
3. Redirected to Stripe Checkout
4. After payment, redirected to success page
5. Subscription status updated via webhooks

### 3. Subscription Management
Users can manage their subscription at `/account/subscription`:
- View current plan and billing info
- Cancel or reactivate subscription
- Access Stripe billing portal

### 4. Feature Access Control
Premium features are protected by middleware that checks:
- User authentication
- Active subscription status
- Feature-specific permissions

## Deployment

### Railway Deployment
This app is configured for Railway deployment:

1. **Connect Repository**
   - Connect your GitHub repo to Railway
   - Railway will auto-deploy on git pushes

2. **Environment Variables**
   Set all required environment variables in Railway dashboard

3. **Database**
   - Add MongoDB database service in Railway
   - Or use external MongoDB Atlas

### Environment Variables Required

**Backend:**
- `DBURI` - MongoDB connection string
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret
- `JWT_SECRET` - JWT signing secret
- `ADMIN_API_KEY` - Admin API key
- All other vars from `.env.example`

**Frontend:**
- `REACT_APP_API_BASE` - Backend API URL
- `REACT_APP_STRIPE_PUBLIC_KEY` - Stripe public key

## Development Scripts

### Backend
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run setup:stripe-products` - Create Stripe products and prices

### Frontend
- `npm start` - Start development server
- `npm run build` - Build for production

## Project Structure

```
thefinalplay.com/
├── backend/
│   ├── controllers/
│   │   ├── subscriptionController.js
│   │   └── userController.js
│   ├── models/
│   │   └── User.js
│   ├── routes/
│   │   ├── subscriptionRoutes.js
│   │   └── userRoutes.js
│   ├── utils/
│   │   ├── stripe.js
│   │   └── catchAsync.js
│   ├── scripts/
│   │   └── setup-stripe-products.js
│   └── server.js
└── frontend/
    ├── src/
    │   ├── components/
    │   │   └── Subscription/
    │   ├── contexts/
    │   │   ├── AuthContext.js
    │   │   └── SubscriptionContext.js
    │   ├── pages/
    │   │   ├── SubscriptionPlansPage.jsx
    │   │   └── SubscriptionManagementPage.jsx
    │   └── api/
    │       └── subscriptionApi.js
    └── public/
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support or questions:
- Create an issue in the GitHub repository
- Check the documentation above
- Review Stripe's documentation for payment-related questions