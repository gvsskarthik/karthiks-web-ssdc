#!/bin/bash
set -e

JAR_PATH="/opt/ssdc-backend.jar"
KEEP_BACKUPS=3
HEALTH_PORT=8080
HEALTH_TIMEOUT=30
BUILT_JAR="target/ssdclabs-0.0.1-SNAPSHOT.jar"

echo "=============================="
echo "Deploying SSDC Application"
echo "=============================="

cd /srv/ssdc

echo "Pulling latest code from Git..."
git pull

echo "Building backend (with tests)..."
cd ssdclabs
if ! ./mvnw clean package; then
    echo "BUILD FAILED — aborting deploy."
    exit 1
fi

if [ ! -f "$BUILT_JAR" ]; then
    echo "ERROR: Expected JAR not found at $BUILT_JAR"
    exit 1
fi

echo "Backing up current JAR..."
BACKUP_FILE=""
if [ -f "$JAR_PATH" ]; then
    BACKUP_FILE="${JAR_PATH}.bak.$(date +%Y%m%d_%H%M%S)"
    cp "$JAR_PATH" "$BACKUP_FILE"
    echo "Backup created: $BACKUP_FILE"
else
    echo "No existing JAR to back up."
fi

echo "Deploying backend JAR..."
cp "$BUILT_JAR" "$JAR_PATH"
chown ssdc:ssdc "$JAR_PATH"

echo "Cleaning old backups (keeping $KEEP_BACKUPS most recent)..."
ls -t ${JAR_PATH}.bak.* 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -f
echo "Backups after cleanup:"
ls -lh ${JAR_PATH}.bak.* 2>/dev/null || echo "  (none)"

echo "Restarting backend service..."
systemctl restart ssdc-backend

echo "Waiting for backend to start (up to ${HEALTH_TIMEOUT}s)..."
elapsed=0
while [ $elapsed -lt $HEALTH_TIMEOUT ]; do
    if ss -tlnp | grep -q ":${HEALTH_PORT}"; then
        echo "Backend is listening on port ${HEALTH_PORT} after ${elapsed}s."
        echo "Deployment complete."
        exit 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
done

echo "HEALTH CHECK FAILED — port ${HEALTH_PORT} not listening after ${HEALTH_TIMEOUT}s."
if [ -n "$BACKUP_FILE" ] && [ -f "$BACKUP_FILE" ]; then
    echo "Rolling back to previous JAR..."
    cp "$BACKUP_FILE" "$JAR_PATH"
    chown ssdc:ssdc "$JAR_PATH"
    systemctl restart ssdc-backend
    echo "Rollback complete. Previous version restored."
else
    echo "No backup available to rollback."
fi
echo "Check logs: journalctl -u ssdc-backend -n 50"
exit 1
