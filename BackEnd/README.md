# iMeetPro Microservices

## Setup

1. Clone the repo
2. Copy `.env.example` to `.env` in each service folder and fill in real values:
```bash
   for dir in analytics-service attendance-service face-auth-service meeting-core-service recording-service user-service whiteboard-service; do
     cp $dir/.env.example $dir/.env
   done
```
3. Ask the admin for the actual credentials (DB, AWS, LiveKit, Groq, OpenAI keys)
4. Add SSL certs to `nginx/ssl/` (selfsigned.crt and selfsigned.key)
5. Run: `docker-compose up -d --build`

## Services

| Service | Port |
|---------|------|
| Whiteboard | 8230 |
| Analytics & Feedback | 8231 |
| Face Auth (GPU) | 8232 |
| Attendance | 8233 |
| User | 8234 |
| Meeting Core | 8235 |
| Recording (GPU) | 8236 |

Nginx serves on ports 80 (HTTP) and 443 (HTTPS).