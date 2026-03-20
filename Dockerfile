# Stage 1: Build frontend
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Go binary
FROM golang:1.25-alpine AS backend
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=frontend /app/frontend/dist ./frontend/dist
RUN CGO_ENABLED=0 GOOS=linux go build -o tessera ./cmd/analyst/

# Stage 3: Final minimal image
FROM alpine:3.21
RUN apk --no-cache add ca-certificates

# HF Spaces runs as user 1000
RUN adduser -D -u 1000 appuser
WORKDIR /app

COPY --from=backend /app/tessera .
COPY --from=backend /app/frontend/dist ./frontend/dist
COPY --from=backend /app/internal/report/assets ./internal/report/assets

# Reports directory (writable by appuser)
RUN mkdir -p reports && chown -R appuser:appuser /app

USER appuser

# HF Spaces expects port 7860
ENV PORT=7860
EXPOSE 7860

CMD ["./tessera", "serve"]
