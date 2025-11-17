# Deploy with Self-Signed SSL Certificate

## Simple 3-Step Deployment

### Step 1: Push changes to GitHub

From your local machine (Windows):

```powershell
git add .
git commit -m "Add HTTPS support with self-signed SSL"
git push origin main
```

### Step 2: SSH into droplet and generate SSL certificate

```bash
# SSH into your droplet
ssh root@164.90.235.67

# Navigate to project directory
cd livekit-livestream

# Pull latest changes
git pull origin main

# Create ssl directory
mkdir -p ssl

# Generate self-signed certificate (valid for 1 year)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/cert.key \
  -out ssl/cert.crt \
  -subj "/C=US/ST=State/L=City/O=LiveKit/CN=164.90.235.67"
```

### Step 3: Rebuild and restart containers

```bash
# Stop existing containers
docker-compose down

# Rebuild and start with new config
docker-compose up -d --build

# Check containers are running
docker-compose ps

# Check logs (optional)
docker-compose logs -f frontend
```

## Access the Site

Visit: **https://164.90.235.67**

⚠️ **You'll see a security warning** - Click "Advanced" → "Proceed to 164.90.235.67 (unsafe)"

This is normal for self-signed certificates. Every user will need to do this once per browser.

## What Changed

- ✅ nginx now listens on port 443 (HTTPS)
- ✅ HTTP (port 80) redirects to HTTPS
- ✅ SSL certificate mounted as volume (persists across rebuilds)
- ✅ Frontend calls backend via HTTPS
- ✅ Camera/microphone will work (HTTPS required by browsers)

## Troubleshooting

**Container won't start:**
```bash
# Check logs
docker-compose logs frontend

# Verify SSL files exist
ls -la ssl/
```

**Port already in use:**
```bash
# Find what's using port 443
sudo netstat -tulpn | grep :443

# Kill old containers
docker-compose down
docker rm -f $(docker ps -aq)
```

## Upgrade Path

To upgrade to a real SSL certificate later (no browser warnings):

1. Get free domain from afraid.org or duckdns.org
2. Point domain to 164.90.235.67
3. Install certbot and get Let's Encrypt certificate
4. Replace files in `ssl/` directory
5. Restart containers

No code changes needed!
