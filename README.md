IntellMeet Backend
A real-time video meeting backend built using Node.js, Socket.io, MongoDB, and Redis.

Features:
 > Authentication (JWT-based)
 > Meeting creation & management
 > Real-time communication (Socket.io)
 > Chat functionality
 > Live notifications (join/leave/messages)
 > Redis caching

Tech Stack:
 > Node.js + Express
 > Socket.io
 > MongoDB (Mongoose)
 > Redis (ioredis)
 > TypeScript

Setup Instructions:

1. Clone repo
git clone <your-repo-url>
cd server
2. Install dependencies
npm install
3. Setup environment variables

Create .env file:

PORT=5000
MONGO_URI=your_mongodb_uri
REDIS_URL=your_redis_url
JWT_SECRET=your_secret
4. Run server
npm run dev

API Testing

Use Postman:

Register → /api/auth/register
Login → /api/auth/login
Create Meeting → /api/meetings

Socket Events
Join Room:
join-room { roomId, userId }
Chat:
send-message { roomId, message, userId }
Notifications:
user-joined
user-left
new-message-notification

Author

Ajay Paul

