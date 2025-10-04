# Schedule App

A Next.js application with Firebase authentication for organization-based scheduling.

## Features

- 🔐 Firebase Google Authentication
- 📱 Responsive design with Tailwind CSS
- 🛡️ Protected routes
- 📧 Email-based authorization system
- 💾 MongoDB integration

## Getting Started

### Prerequisites

- Node.js 18+ 
- MongoDB database
- Firebase project with Google Authentication enabled

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd sche
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:

Create a `.env.local` file in the root directory and add your configuration:

```env
# MongoDB
MONGODB_URI=your_mongodb_connection_string

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id

# API Configuration
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
```

### Firebase Setup

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select an existing one
3. Enable Authentication and configure Google sign-in
4. Get your Firebase configuration from Project Settings
5. Add your domain to the authorized domains list

### Database Setup

The app uses MongoDB with the following collections:
- `AuthEmails` - Authorized email addresses for application access
- `AuthUsers` - Authorized users for application access
- `Admin` - Admin users for administrative access

#### Creating an Admin User

You can create an admin user by making a POST request to `/api/admin`:

```bash
curl -X POST http://localhost:3000/api/admin \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123",
    "email": "admin@example.com"
  }'
```

Or add directly to your MongoDB `Admin` collection:
```javascript
{
  "username": "admin",
  "password": "admin123",
  "email": "admin@example.com",
  "role": "admin",
  "createdAt": new Date(),
  "updatedAt": new Date()
}
```

### Running the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Application Flow

1. **Welcome Page** (`/initial`) - Landing page with get started button
2. **Login** (`/login`) - Firebase Google authentication with email validation
3. **Dashboard** (`/dashboard`) - Main dashboard after successful login
4. **Admin Panel** (`/admin/login`) - Administrative access

## API Endpoints

- `GET /api/emails` - Get all authorized emails with full details
- `GET /api/authemails` - Get authorized email addresses for authentication
- `GET /api/users` - Get all users

## Project Structure

```
src/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── admin/             # Admin pages
│   ├── dashboard/         # Dashboard page
│   ├── initial/           # Welcome/landing page
│   └── login/             # Login page
├── components/            # Reusable components
├── contexts/              # React contexts (Auth)
├── lib/                   # Utilities (Firebase, DB)
└── types/                 # TypeScript types
```

## Technologies Used

- **Framework**: Next.js 15
- **Authentication**: Firebase Auth
- **Database**: MongoDB
- **Styling**: Tailwind CSS
- **Language**: TypeScript
- **HTTP Client**: Axios

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
