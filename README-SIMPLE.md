# NetApp ONTAP Key Manager MCP Server

A simplified FastMCP server providing **13 key manager commands** for NetApp ONTAP storage management.

## 🚀 Quick Start

### Using Docker Compose (Recommended)

1. **Configure Environment Variables**
   ```bash
   cp .env.example .env
   # Edit .env with your ONTAP cluster credentials
   ```

2. **Start the Server**
   ```bash
   docker-compose up -d
   ```

3. **Access the Server**
   - SSE Endpoint: `http://localhost:3000/sse`
   - The server provides 13 MCP tools for key manager operations

### Configuration

The server reads cluster configuration from the `ONTAP_CLUSTERS` environment variable.

#### Example .env file:
```bash
PORT=3000

ONTAP_CLUSTERS='[
  {
    "name": "prod-cluster",
    "cluster_ip": "10.1.1.100",
    "username": "admin",
    "password": "MySecurePassword123",
    "description": "Production Cluster",
    "verify_ssl": true
  }
]'
```

## 📋 Available Tools (13 Key Manager Commands)

### Key Manager Management
1. **cluster_list_key_managers** - List all key managers (onboard and external)
2. **cluster_get_key_manager** - Get detailed key manager information
3. **cluster_create_external_key_manager** - Configure external KMIP key management
4. **cluster_create_onboard_key_manager** - Enable Onboard Key Manager (OKM)
5. **cluster_update_key_manager_passphrase** - Update OKM passphrase
6. **cluster_sync_key_manager** - Synchronize onboard keys across nodes
7. **cluster_delete_key_manager** - Delete key manager configuration

### Key Server Management
8. **cluster_list_key_servers** - List key servers for external key manager
9. **cluster_add_key_server** - Add a key server to external key manager
10. **cluster_delete_key_server** - Remove key server from external key manager

### Key Operations
11. **cluster_list_keys** - List encryption keys in key manager
12. **cluster_create_auth_key** - Create authentication key for NSE drives
13. **cluster_restore_keys** - Restore missing encryption keys to nodes

## 🛠️ Development

### Local Development
```bash
# Install dependencies
npm install

# Build
npm run build

# Run locally
npm start
```

### Build Docker Image
```bash
docker build -t ontap-key-manager-mcp:latest .
```

## 📦 What's Different from the Original

This is a **simplified version** of the full ONTAP-MCP server:

- **Reduced from 64 tools to 13 tools** (only key manager commands)
- **FastMCP framework** instead of custom MCP SDK implementation
- **Environment-based configuration** (no complex registry system)
- **Single index.ts file** for all server logic
- **Removed ~50+ unused files** (volume, CIFS, export policy, QoS, snapshot tools)
- **Docker-first approach** with docker-compose.yml

## 🔒 Security Notes

- Never commit `.env` files with real credentials to version control
- Use SSL verification (`verify_ssl: true`) for production clusters
- Store backup data from OKM operations securely
- Restrict network access to the MCP server in production

## 📝 License

ISC

## 🤝 Contributing

This is a simplified implementation. For the full feature set, see the original ONTAP-MCP repository.
