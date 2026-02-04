# NetApp ONTAP Key Manager MCP Server

A simplified FastMCP-based HTTP SSE server for managing NetApp ONTAP encryption key infrastructure. This server provides 13 key manager tools via the Model Context Protocol (MCP).

## 📚 Documentation

- **[Quick Start Guide](QUICKSTART.md)** - Get running in 5 minutes
- **[Usage Examples](EXAMPLES.md)** - Detailed examples and API calls
- **[Transformation Details](TRANSFORMATION.md)** - Technical architecture changes

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose (recommended)
- OR Node.js 20+ (for local development)
- NetApp ONTAP cluster with management IP accessible

### Option 1: Docker (Recommended)

1. **Create environment file:**
   ```bash
   cp .env.example .env
   # Edit .env with your ONTAP cluster details
   ```

2. **Start the server:**
   ```bash
   docker-compose up -d
   ```

3. **Verify it's running:**
   ```bash
   curl http://localhost:3000/health
   docker-compose logs -f
   ```

### Option 2: Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set environment variables:**
   ```bash
   export ONTAP_CLUSTER_IP="10.1.1.1"
   export ONTAP_USERNAME="admin"
   export ONTAP_PASSWORD="your-password"
   export PORT=3000
   ```

3. **Build and start:**
   ```bash
   npm run build
   npm start
   ```

## 🔧 Configuration

Configure the server using environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ONTAP_CLUSTER_IP` | ✅ Yes | - | ONTAP cluster management IP address |
| `ONTAP_USERNAME` | No | `admin` | ONTAP admin username |
| `ONTAP_PASSWORD` | ✅ Yes | - | ONTAP admin password |
| `PORT` | No | `3000` | HTTP server port |
| `NODE_ENV` | No | `production` | Node environment |

## 📡 API Endpoints

- **MCP Endpoint:** `http://localhost:3000/mcp` (HTTP streaming)
- **SSE Endpoint:** `http://localhost:3000/sse` (Server-Sent Events)
- **Health Check:** `http://localhost:3000/health`

The server uses FastMCP's HTTP Stream transport with SSE compatibility.

## 🔐 Available Key Manager Tools (13)

### Key Manager Management (7 tools)

1. **`list_key_managers`** - List all key managers (onboard and external)
2. **`get_key_manager`** - Get detailed information about a specific key manager
3. **`create_external_key_manager`** - Configure external key management (KMIP)
4. **`create_onboard_key_manager`** - Enable Onboard Key Manager with passphrase
5. **`update_key_manager_passphrase`** - Update OKM passphrase
6. **`sync_key_manager`** - Synchronize keys across cluster nodes
7. **`delete_key_manager`** - Delete a key manager configuration

### Key Server Management (3 tools)

8. **`list_key_servers`** - List key servers for an external key manager
9. **`add_key_server`** - Add a primary key server
10. **`delete_key_server`** - Remove a key server

### Key Operations (3 tools)

11. **`list_keys`** - List encryption keys in a key manager
12. **`create_auth_key`** - Create authentication key for NSE drives
13. **`restore_keys`** - Restore missing keys from key manager

## 📋 Usage Examples

### Using with MCP Clients

The server implements the Model Context Protocol and can be used with any MCP-compatible client. Here's a quick test using curl:

```bash
# Test health endpoint
curl http://localhost:3000/health

# Test SSE endpoint (will stream events)
curl http://localhost:3000/sse
```

For programmatic access, use an MCP client library or FastMCP client.

### Tool Call Examples

### List Key Managers

```json
{
  "name": "list_key_managers",
  "arguments": {
    "scope": "cluster"
  }
}
```

### Create Onboard Key Manager

```json
{
  "name": "create_onboard_key_manager",
  "arguments": {
    "passphrase": "ThisIsAVerySecurePassphraseThatIs32CharsOrMore",
    "synchronize": true
  }
}
```

### Add External Key Server

```json
{
  "name": "add_key_server",
  "arguments": {
    "key_manager_uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "server": "kmip-server.example.com:5696",
    "timeout": 30
  }
}
```

## 🐳 Docker Commands

```bash
# Build image
npm run docker:build

# Start service
npm run docker:run

# View logs
npm run docker:logs

# Stop service
npm run docker:stop
```

## 🔒 Security Notes

- **Self-Signed Certificates:** The server accepts self-signed ONTAP certificates by default
- **Credentials:** Never commit `.env` files with real credentials
- **Backup Data:** When creating/updating onboard key managers, always save the backup data securely
- **Network:** Ensure ONTAP management IP is accessible from the container/host

## 🛠️ Development

### Project Structure

```
.
├── src/
│   └── server.ts          # Main FastMCP server with all 13 tools
├── Dockerfile             # Multi-stage Docker build
├── docker-compose.yml     # Docker Compose configuration
├── package.json           # Dependencies (fastmcp, zod)
├── tsconfig.json          # TypeScript configuration
└── README.md              # This file
```

### Building from Source

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run build

# Run (requires environment variables)
npm start
```

## 📚 API Reference

This server uses NetApp ONTAP REST API v1 endpoints:

- `/api/security/key-managers` - Key manager CRUD operations
- `/api/security/key-managers/{uuid}/key-servers` - Key server management
- `/api/security/key-managers/{uuid}/keys` - Key operations
- `/api/security/key-managers/{uuid}/auth-keys` - Authentication keys
- `/api/security/key-managers/{uuid}/restore` - Key restoration

## ❓ Troubleshooting

### Container won't start

Check logs for missing environment variables:
```bash
docker-compose logs ontap-keymanager
```

### Connection refused to ONTAP

Verify:
- ONTAP cluster IP is accessible: `ping $ONTAP_CLUSTER_IP`
- Management LIF is up: Check ONTAP `network interface show`
- Firewall allows HTTPS (443): `telnet $ONTAP_CLUSTER_IP 443`

### Authentication failed

Verify credentials:
```bash
curl -k -u admin:password https://$ONTAP_CLUSTER_IP/api/cluster
```

## 📄 License

ISC

## 🤝 Contributing

This is a specialized key manager-only version. For the full ONTAP MCP server with volume, CIFS, snapshot, and other tools, see the original project.

## 🔗 Related

- [FastMCP Framework](https://github.com/punkpeye/fastmcp)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [NetApp ONTAP REST API](https://docs.netapp.com/us-en/ontap-automation/)
