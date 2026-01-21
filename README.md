# The Deck

A self-hosted web application for managing projects, calendar events, tasks, and ideas with audio support.

## Features

- **User Authentication**: Secure JWT-based authentication with registration and login
- **Projects**: Create and manage projects with categories (personal, professional, academic) and status tracking
- **Tasks**: Task management with priorities, due dates, and Kanban-style status boards
- **Calendar**: Full calendar view with month/week/day views, plus Google and Outlook sync
- **Ideas**: Capture ideas with text notes and voice recordings
- **Search**: Global search across all your projects, tasks, events, and ideas
- **Responsive Design**: Modern UI built with Tailwind CSS that works on desktop and mobile

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, react-big-calendar
- **Backend**: Node.js, Express
- **Database**: SQLite (via better-sqlite3)
- **Authentication**: JWT (jsonwebtoken), bcrypt

## Quick Start with Docker

### Prerequisites

- Docker and Docker Compose installed

### Running the Application

1. Clone or download this repository:
   ```bash
   cd the-deck
   ```

2. Create a `.env` file for your JWT secret (recommended for production):
   ```bash
   echo "JWT_SECRET=$(openssl rand -base64 32)" > .env
   ```

3. Build and run with Docker Compose:
   ```bash
   docker compose up --build -d
   ```

4. Access the application at `http://localhost:3000`

5. Create your first account and start organizing!

### Stopping the Application

```bash
docker compose down
```

### Data Persistence

All data (SQLite database and uploaded audio files) is stored in a Docker volume named `deck-data`. Your data will persist across container restarts and rebuilds.

To backup your data:
```bash
docker cp the-deck:/app/data ./backup
```

To restore data:
```bash
docker cp ./backup/. the-deck:/app/data
```

## Development Setup

### Prerequisites

- Node.js 18+ installed
- npm or yarn

### Installation

1. Install all dependencies:
   ```bash
   npm run install-all
   ```

2. Copy the environment example:
   ```bash
   cp .env.example .env
   ```

3. Start the development server:
   ```bash
   # Terminal 1: Start backend
   npm run dev

   # Terminal 2: Start frontend
   npm run client
   ```

4. Access the development server at `http://localhost:5173`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Projects
- `GET /api/projects` - List projects
- `GET /api/projects/:id` - Get project with tasks/events
- `POST /api/projects` - Create project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Tasks
- `GET /api/tasks` - List tasks (filterable)
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Events
- `GET /api/events` - List events (filterable by date range)
- `POST /api/events` - Create event
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event

### Ideas
- `GET /api/ideas` - List ideas
- `POST /api/ideas` - Create idea (multipart/form-data for audio)
- `PUT /api/ideas/:id` - Update idea
- `DELETE /api/ideas/:id` - Delete idea
- `GET /api/ideas/:id/audio` - Stream audio file

### Search
- `GET /api/search?q=query` - Search across all entities

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `APP_URL` | Public URL of your app | `http://localhost:3000` |
| `JWT_SECRET` | Secret key for JWT tokens | (required in production) |
| `DATABASE_PATH` | Path to SQLite database | `./data/deck.db` |
| `UPLOAD_PATH` | Path for audio uploads | `./data/uploads` |
| `MAX_FILE_SIZE` | Max upload size in bytes | `10485760` (10MB) |

## Calendar Sync Setup

The Deck supports syncing with Google Calendar and Microsoft Outlook. This is optional - the app works without it.

**Important:** Calendar sync is configured on a per-user basis. Each user can set up their own OAuth credentials through the app's Calendar Sync Settings UI. No server-side configuration is required.

### Setting Up Calendar Sync (Per User)

1. Log into The Deck and go to the Calendar page
2. Click "Sync Settings" button
3. Go to the "OAuth Setup" tab
4. Follow the instructions to set up Google and/or Outlook credentials

### Google Calendar Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project or select an existing one
3. Enable the Google Calendar API
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URI: `https://your-domain.com/api/calendars/google/callback`
5. Copy the Client ID and Client Secret into The Deck's Calendar Sync Settings

### Microsoft Outlook Setup

1. Go to [Azure Portal](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Register a new application
3. Under "Authentication", add a Web platform with redirect URI: `https://your-domain.com/api/calendars/outlook/callback`
4. Under "Certificates & secrets", create a new client secret
5. Under "API permissions", add:
   - Microsoft Graph > Delegated > Calendars.Read
   - Microsoft Graph > Delegated > User.Read
6. Copy the Application (client) ID and client secret into The Deck's Calendar Sync Settings

### Docker Compose Example

```yaml
services:
  the-deck:
    image: ghcr.io/hypn0ti2ed/the-deck:latest
    ports:
      - "3000:3000"
    volumes:
      - deck-data:/app/data
    environment:
      - JWT_SECRET=your-secret-here
      - APP_URL=https://your-domain.com

volumes:
  deck-data:
```

## Project Structure

```
the-deck/
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── package.json
├── server/
│   ├── index.js           # Express entry point
│   ├── database.js        # SQLite setup
│   ├── middleware/
│   │   └── auth.js        # JWT middleware
│   └── routes/
│       ├── auth.js        # Auth endpoints
│       ├── projects.js    # Projects API
│       ├── tasks.js       # Tasks API
│       ├── events.js      # Events API
│       ├── ideas.js       # Ideas API
│       └── search.js      # Search API
├── client/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── Layout/
│   │   │   ├── Projects/
│   │   │   ├── Tasks/
│   │   │   ├── Calendar/
│   │   │   ├── Ideas/
│   │   │   └── Search/
│   │   ├── hooks/
│   │   └── services/
│   └── package.json
└── data/                  # SQLite DB + uploads
```

## License

MIT
