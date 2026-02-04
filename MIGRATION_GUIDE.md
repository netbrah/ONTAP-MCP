# Migration Guide: From Full ONTAP-MCP to Key Manager Only

## What Changed?

This project has been **simplified** to focus exclusively on NetApp ONTAP Key Manager operations.

### Before (v1.0.0)
- **64 MCP tools** across multiple domains:
  - Volume management (18 tools)
  - CIFS/SMB shares (8 tools)  
  - NFS export policies (9 tools)
  - QoS policies (5 tools)
  - Snapshot policies (4 tools)
  - Cluster management (4 tools)
  - Key manager operations (13 tools)
- Custom MCP SDK implementation with complex transport abstraction
- Multiple tool registries and session management
- 50+ source files

### After (v2.0.0)
- **13 MCP tools** - Key Manager operations only
- FastMCP framework (simpler, more maintainable)
- Single `index.ts` file for all server logic
- Environment-based configuration via `ONTAP_CLUSTERS` JSON
- Docker-first approach with `docker-compose.yml`
- ~80% code reduction

## Quick Start Guide

### 1. Configure Your Clusters

Create a `.env` file:

```bash
PORT=3000

ONTAP_CLUSTERS='[
  {
    "name": "prod-cluster-1",
    "cluster_ip": "10.1.1.100",
    "username": "admin",
    "password": "YourSecurePassword",
    "description": "Production Cluster 1",
    "verify_ssl": true
  }
]'
```

### 2. Start with Docker

```bash
docker-compose up -d
```

The server will be available at: `http://localhost:3000/mcp`

### 3. Test the Server

```bash
# Check if server is running
curl http://localhost:3000/mcp

# Should return: "No sessionId" (expected for GET without session)
```

## Available Commands

All 13 commands follow the pattern `cluster_<operation>_<resource>`:

### Key Manager Operations
1. `cluster_list_key_managers` - List all configured key managers
2. `cluster_get_key_manager` - Get details about specific key manager
3. `cluster_create_external_key_manager` - Configure KMIP external key management
4. `cluster_create_onboard_key_manager` - Enable Onboard Key Manager (OKM)
5. `cluster_update_key_manager_passphrase` - Update OKM passphrase
6. `cluster_sync_key_manager` - Sync keys across cluster nodes
7. `cluster_delete_key_manager` - Remove key manager configuration

### Key Server Operations (External Key Managers)
8. `cluster_list_key_servers` - List configured key servers
9. `cluster_add_key_server` - Add KMIP server to key manager
10. `cluster_delete_key_server` - Remove KMIP server

### Encryption Key Operations
11. `cluster_list_keys` - List encryption keys in key manager
12. `cluster_create_auth_key` - Create NSE authentication key
13. `cluster_restore_keys` - Restore missing keys to nodes

## Docker Usage

### Start Server
```bash
docker-compose up -d
```

### View Logs
```bash
docker-compose logs -f ontap-key-manager-mcp
```

### Stop Server
```bash
docker-compose down
```

### Rebuild After Code Changes
```bash
docker-compose build --no-cache
docker-compose up -d
```

## Development

### Local Development
```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run server
npm start
```

### File Structure
```
src/
├── index.ts                    # FastMCP server with all 13 tools
├── ontap-client.ts             # ONTAP API client (key manager methods only)
├── tools/
│   └── key-manager-tools.ts    # Tool handlers for all 13 commands
└── types/
    └── key-manager-types.ts    # TypeScript types for key management
```

## Security Best Practices

1. **Never commit `.env` files** - Add to `.gitignore`
2. **Use SSL verification** in production (`verify_ssl: true`)
3. **Save OKM backup data** from key manager creation operations
4. **Restrict network access** to MCP server port (3000)
5. **Use strong passphrases** (32-256 characters for OKM)

## Troubleshooting

### Server Won't Start
```bash
# Check if port is already in use
lsof -i :3000

# Try with different port
PORT=3001 docker-compose up
```

### Cluster Connection Issues
- Verify `cluster_ip` is reachable
- Check username/password credentials
- If using self-signed certs, set `verify_ssl: false`

### Tool Returns "Cluster Not Found"
- Ensure `cluster_name` in tool call matches name in `ONTAP_CLUSTERS`
- Check `.env` file is loaded correctly
- Verify JSON syntax in `ONTAP_CLUSTERS`

## Going Back to Full Version

If you need the full ONTAP-MCP server with all 64 tools, check out the commit before simplification.

## Support

For issues with:
- **Key Manager operations**: Check NetApp ONTAP documentation
- **MCP protocol**: See https://modelcontextprotocol.io
- **FastMCP framework**: See https://github.com/punkpeye/fastmcp
