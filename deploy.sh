#!/bin/bash
set -e

echo "=============================="
echo "Deploying SSDC Application"
echo "=============================="

cd /srv/ssdc

echo "Pulling latest code from Git..."
git pull

echo "Building backend..."
cd ssdclabs
./mvnw clean package -DskipTests

echo "Deploying backend JAR..."
cp target/*.jar /opt/ssdc-backend.jar

echo "Restarting backend service..."
systemctl restart ssdc-backend

echo "Deployment complete ✅"
