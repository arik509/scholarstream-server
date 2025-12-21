# ScholarStream - Server

## Project Overview
RESTful API backend for ScholarStream scholarship management platform with JWT authentication, role-based access control, and Stripe payment integration.

## Live API URL
🔗 [API Base URL](https://your-api-name.vercel.app)

## Key Features
- 🔐 JWT-based authentication with httpOnly cookies
- 🛡️ Role-based middleware (Admin, Moderator, Student)
- 💳 Stripe payment integration
- 🔍 Server-side search, filter, and sort
- 📄 Pagination support
- 🗄️ MongoDB database with 4 collections
- ⚡ CORS enabled for cross-origin requests

## Tech Stack
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB
- **Authentication:** JWT (jsonwebtoken)
- **Payment:** Stripe
- **Security:** cookie-parser, dotenv

## NPM Packages Used
{
"express": "^4.21.2",
"mongodb": "^6.12.0",
"jsonwebtoken": "^9.0.2",
"cookie-parser": "^1.4.7",
"stripe": "^17.5.0",
"cors": "^2.8.5",
"dotenv": "^16.4.7"
}


## Installation

1. Clone the repository:
git clone https://github.com/arik509/scholarstream-server.git
cd scholarstream-server


2. Install dependencies:
npm install


3. Create `.env` file:
MONGODB_URI=your_mongodb_connection_string
DB_NAME=scholarstream
STRIPE_SECRET_KEY=your_stripe_secret_key
JWT_SECRET=your_jwt_secret_key
PORT=3000
NODE_ENV=development


4. Start the server:
npm start


## API Endpoints

### Authentication
- `POST /api/jwt` - Generate JWT token
- `POST /api/logout` - Clear JWT cookie

### Users
- `GET /api/users` - Get all users (Admin only)
- `GET /api/users/:email` - Get user by email
- `POST /api/users/register` - Register new user
- `PATCH /api/users/:email/role` - Update user role (Admin only)
- `DELETE /api/users/:email` - Delete user (Admin only)

### Scholarships
- `GET /api/scholarships` - Get all scholarships (with search, filter, sort, pagination)
- `GET /api/scholarships/:id` - Get scholarship by ID
- `POST /api/scholarships` - Create scholarship (Admin only)
- `DELETE /api/scholarships/:id` - Delete scholarship (Admin only)

### Applications
- `GET /api/applications` - Get all applications (Moderator/Admin)
- `GET /api/applications/user/:email` - Get user applications
- `POST /api/applications` - Create application
- `PATCH /api/applications/:id/status` - Update status (Moderator/Admin)
- `PATCH /api/applications/:id/feedback` - Add feedback (Moderator/Admin)
- `PATCH /api/applications/:id/payment` - Update payment status
- `DELETE /api/applications/:id` - Delete application

### Reviews
- `GET /api/reviews` - Get all reviews (Moderator/Admin)
- `GET /api/reviews/scholarship/:id` - Get reviews by scholarship
- `GET /api/reviews/user/:email` - Get user reviews
- `POST /api/reviews` - Create review
- `PATCH /api/reviews/:id` - Update review
- `DELETE /api/reviews/:id` - Delete review

### Payment
- `POST /api/create-payment-intent` - Create Stripe payment intent

## Database Collections

1. **users** - User profiles and roles
2. **scholarships** - Scholarship listings
3. **applications** - Student applications
4. **reviews** - User reviews

## Security Features
- JWT token verification
- Role-based access control
- httpOnly cookies
- Environment variable protection
- CORS configuration

## Author
Developed by Sabir Hossain Arik
