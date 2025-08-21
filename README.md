# Skyline Assistant Backend

A robust Node.js and Express backend for a personalized assistant that integrates with Google Calendar and Gmail through OAuth2 authentication.

## Features

- 🔐 **Google OAuth2 Authentication** - Secure login with Google accounts
- 📧 **Gmail Integration** - Read, search, and send emails
- 📅 **Calendar Integration** - Manage calendar events and appointments
- 🔒 **JWT Authentication** - Secure API access
- 🏗️ **RESTful API** - Clean, organized endpoints
- 🎯 **Task Management** - Built-in task tracking system
- 🗄️ **MongoDB Integration** - Scalable data storage
- 🧪 **Built-in Test Interface** - Easy API testing

- RESTful API architecture
- MongoDB database with Mongoose ODM
- JWT authentication
- Role-based access control
- Input validation and sanitization
- Error handling middleware
- Security middleware (Helmet, CORS)
- Request logging with Morgan

## Project Structure

```
skyline-assistant/
├── config/
│   └── database.js          # Database configuration
├── controllers/
│   ├── authController.js    # Authentication logic
│   ├── userController.js    # User management logic
│   └── taskController.js    # Task management logic
├── middleware/
│   ├── auth.js             # Authentication middleware
│   └── errorHandler.js     # Error handling middleware
├── models/
│   ├── User.js             # User model
│   └── Task.js             # Task model
├── routes/
│   ├── authRoutes.js       # Authentication routes
│   ├── userRoutes.js       # User routes
│   └── taskRoutes.js       # Task routes
├── utils/
│   ├── asyncHandler.js     # Async error handler
│   └── errorResponse.js    # Custom error class
├── .env                    # Environment variables
├── .gitignore             # Git ignore file
├── package.json           # Dependencies and scripts
└── server.js              # Main application file
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file in the root directory and configure the following variables:

```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/skyline-assistant
JWT_SECRET=your-super-secret-jwt-key-here-change-in-production
```

### 3. Start MongoDB

Make sure MongoDB is running on your system. If you're using MongoDB locally:

```bash
mongod
```

Or use MongoDB Atlas for cloud database.

### 4. Run the Application

Development mode (with nodemon):

```bash
npm run dev
```

Production mode:

```bash
npm start
```

## API Endpoints

### Authentication Routes (`/api/auth`)

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (protected)

### User Routes (`/api/users`)

- `GET /api/users` - Get all users (admin only)
- `GET /api/users/:id` - Get single user
- `POST /api/users` - Create user (admin only)
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user (admin only)

### Task Routes (`/api/tasks`)

- `GET /api/tasks` - Get all tasks (filtered by user)
- `GET /api/tasks/:id` - Get single task
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Health Check

- `GET /health` - Server health check

## Models

### User Model

- name (required, string, max 50 chars)
- email (required, unique, valid email)
- password (required, min 6 chars, hashed)
- role (enum: 'user', 'admin', default: 'user')
- isActive (boolean, default: true)
- lastLogin (date)
- timestamps (createdAt, updatedAt)

### Task Model

- title (required, string, max 100 chars)
- description (string, max 500 chars)
- status (enum: 'pending', 'in-progress', 'completed', 'cancelled')
- priority (enum: 'low', 'medium', 'high', 'urgent')
- dueDate (date)
- assignedTo (ObjectId, ref: User, required)
- createdBy (ObjectId, ref: User, required)
- tags (array of strings)
- isCompleted (boolean, auto-updated based on status)
- timestamps (createdAt, updatedAt)

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Error Handling

The API returns consistent error responses:

```json
{
  "success": false,
  "message": "Error message",
  "errors": [] // For validation errors
}
```

## Success Responses

All successful responses follow this format:

```json
{
  "success": true,
  "data": {
    // Response data
  }
}
```

## Development

### Adding New Routes

1. Create the controller function in the appropriate controller file
2. Add validation middleware if needed
3. Define the route in the appropriate routes file
4. Import and use the route in `server.js`

### Database Queries

Use Mongoose for all database operations. Examples are provided in the existing controllers.

### Middleware

- `protect`: Requires valid JWT token
- `authorize(roles)`: Requires specific user roles
- Validation middleware using `express-validator`

## Security Features

- Helmet.js for security headers
- CORS enabled
- Password hashing with bcrypt
- JWT token expiration
- Input validation and sanitization
- Rate limiting (can be added)

## Contributing

1. Follow the existing code structure
2. Use async/await for asynchronous operations
3. Add proper error handling
4. Include input validation
5. Test your endpoints before committing
