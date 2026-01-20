---
name: reboot
description: Restarts both frontend and backend servers for mi-gestor project. Kills processes on ports 3000 and 3001, then starts fresh development servers.
allowed-tools: Bash
---

# Server Reboot Command

This skill provides a quick way to restart both the frontend (Next.js) and backend (Express) servers.

## What it does

1. **Kills existing processes** on ports 3000 (backend) and 3001 (frontend)
2. **Starts fresh servers** using `npm run dev` from the project root
3. **Displays startup logs** with colored output (cyan for backend, magenta for frontend)

## Usage

Simply invoke `/reboot` and the skill will:
- Stop any running servers on ports 3000 and 3001
- Clear the terminal (optional)
- Start both servers simultaneously with hot-reload enabled

## Technical Details

**Ports:**
- Backend: http://localhost:3000
- Frontend: http://localhost:3001

**Process Management:**
- Uses `lsof -ti:PORT | xargs kill -9` to forcefully kill processes
- Ignores errors if ports are already free
- Uses `concurrently` to run both servers with colored output

**Hot Reload:**
- Backend: Nodemon watches `.ts` files and auto-restarts
- Frontend: Next.js watches `.tsx` files and auto-refreshes browser

## Implementation Instructions

When this skill is invoked, execute the following steps:

1. **Kill existing processes on ports 3000 and 3001:**
   ```bash
   lsof -ti:3000 | xargs kill -9 2>/dev/null || true
   lsof -ti:3001 | xargs kill -9 2>/dev/null || true
   ```

2. **Wait a moment for ports to free up:**
   ```bash
   sleep 2
   ```

3. **Start both servers from project root:**
   ```bash
   npm run dev
   ```

4. **Inform the user:**
   - Servers are starting
   - Backend will be available at http://localhost:3000
   - Frontend will be available at http://localhost:3001
   - Use Ctrl+C to stop both servers

## Notes

- This command should be run from the project root directory (`/Users/anayusta/workspace/mi-gestor`)
- The servers will run in the foreground with colored output
- Both servers have hot-reload enabled for development
- If you want to stop the servers, press Ctrl+C
