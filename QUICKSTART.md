# Quick Start Guide

Get the NetApp ONTAP Key Manager MCP Server running in 5 minutes.

## Step 1: Prerequisites

You need:
- Docker and Docker Compose (recommended)
- OR Node.js 20+ 
- NetApp ONTAP cluster with:
  - Management IP address
  - Admin credentials
  - HTTPS (port 443) access

## Step 2: Clone and Configure

```bash
# Clone the repository
git clone https://github.com/netbrah/ONTAP-MCP.git
cd ONTAP-MCP

# Create environment file
cp .env.example .env

# Edit .env with your cluster details
nano .env
```

Update these values in `.env`:
```bash
ONTAP_CLUSTER_IP=10.1.1.100      # Your ONTAP cluster IP
ONTAP_USERNAME=admin              # Your admin username
ONTAP_PASSWORD=yourpassword       # Your admin password
PORT=3000                         # Server port (optional)
```

## Step 3: Start the Server

### Option A: Docker (Recommended)
```bash
docker-compose up -d
```

### Option B: Local Development
```bash
npm install
npm run build
npm start
```

## Step 4: Verify It's Running

```bash
# Check health endpoint
curl http://localhost:3000/health

# Expected response: "healthy"
```

## Step 5: Test a Tool

List all key managers on your cluster:

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "list_key_managers",
      "arguments": {}
    }
  }'
```

## That's It! 🎉

Your server is now running with 13 key manager tools available.

## Next Steps

1. **Read the Examples**: See [EXAMPLES.md](EXAMPLES.md) for detailed usage
2. **Review Tools**: See [README.md](README.md) for all 13 available tools
3. **Understand the Transformation**: See [TRANSFORMATION.md](TRANSFORMATION.md)

## Common Issues

### Server won't start
```bash
# Check logs
docker-compose logs -f

# Common cause: Missing environment variables
# Solution: Verify ONTAP_CLUSTER_IP and ONTAP_PASSWORD are set
```

### Cannot connect to ONTAP
```bash
# Test connectivity
ping $ONTAP_CLUSTER_IP

# Test HTTPS access
telnet $ONTAP_CLUSTER_IP 443

# Test credentials
curl -k -u admin:password https://$ONTAP_CLUSTER_IP/api/cluster
```

### Port already in use
```bash
# Change port in .env
PORT=3001

# Or stop conflicting service
docker ps  # Find conflicting container
docker stop <container-id>
```

## Quick Reference

| Action | Command |
|--------|---------|
| Start server | `docker-compose up -d` |
| Stop server | `docker-compose down` |
| View logs | `docker-compose logs -f` |
| Restart server | `docker-compose restart` |
| Health check | `curl http://localhost:3000/health` |
| List tools | See EXAMPLES.md |

## Key Manager Tools Available

✅ List/Get key managers  
✅ Create external (KMIP) key manager  
✅ Create onboard key manager  
✅ Update passphrase  
✅ Sync keys across nodes  
✅ Delete key manager  
✅ Manage key servers  
✅ List/Create/Restore keys  

## Support

For issues or questions:
1. Check [EXAMPLES.md](EXAMPLES.md) for usage examples
2. Check [TRANSFORMATION.md](TRANSFORMATION.md) for architecture details
3. Review server logs: `docker-compose logs -f`

## Production Deployment

For production use:
1. Use secure credentials management (not .env files)
2. Enable HTTPS with proper certificates
3. Set up monitoring and alerting
4. Review security best practices
5. Backup key manager data regularly

---

**Total Time**: ~5 minutes  
**Difficulty**: Easy  
**Result**: Fully functional key manager MCP server 🚀
