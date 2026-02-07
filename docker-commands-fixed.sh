# Backend - AWS Docker commands (FIXED)

# 1) Clean up
docker stop school-backend-test 2>/dev/null || true
docker rm school-backend-test 2>/dev/null || true
docker rmi school-backend-local:latest 2>/dev/null || true

# 2) Build (with Redis installed)
docker build --platform linux/amd64 --no-cache \
  -f docker/backend/Dockerfile -t school-backend-local:latest backend/

# 3) Run (Redis working locally)
docker rm -f school-backend-test 2>/dev/null || true

docker run -d --name school-backend-test -p 3001:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e DATABASE_URL='postgresql://dbmasteruser:ftU96iSdTntxFABVyugRAgIINSRLrnrs@ls-3c5e763705e9a8092a52ffa071968d3045936947.c9mca6se4wvj.ap-south-1.rds.amazonaws.com:5432/school_saas' \
  -e JWT_SECRET='your-super-secret-jwt-key-that-is-at-least-32-characters-long' \
  -e REDIS_URL='redis://localhost:6379' \
  -e AWS_ACCESS_KEY_ID='AKIA4MUMKFRK2WVGPIWA' \
  -e AWS_SECRET_ACCESS_KEY='HbZbhixK8AvbgYOX2waJu/2RawwmjVnitw7FEo90' \
  -e AWS_REGION='us-east-1' \
  -e AWS_S3_BUCKET='school-saas-bucket' \
  -e CORS_ORIGINS='http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001,https://school-frontend.techstageit.com' \
  school-backend-local:latest

# 4) Logs
docker logs school-backend-test

# 5) Health check
curl -i http://localhost:3001/health

# 6) Test Redis
docker exec school-backend-test redis-cli ping

# 7) Push to Lightsail
aws lightsail push-container-image \
  --service-name school-backend \
  --label school-backend \
  --image school-backend-local:latest \
  --region us-east-1