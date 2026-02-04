# Example: Using the Key Manager MCP Server

This directory contains examples of how to use the NetApp ONTAP Key Manager MCP Server.

## Prerequisites

1. Start the server:
   ```bash
   export ONTAP_CLUSTER_IP="your-cluster-ip"
   export ONTAP_USERNAME="admin"
   export ONTAP_PASSWORD="your-password"
   npm run build
   npm start
   ```

2. Server will be available at:
   - MCP Endpoint: `http://localhost:3000/mcp`
   - SSE Endpoint: `http://localhost:3000/sse`
   - Health: `http://localhost:3000/health`

## Quick Test with curl

### Health Check
```bash
curl http://localhost:3000/health
```

### SSE Stream (will continuously stream events)
```bash
curl http://localhost:3000/sse
```

## Using with MCP Client Libraries

The server implements the Model Context Protocol and can be used with any MCP-compatible client.

### Python Example (using FastMCP client)
```python
from mcp import Client
from mcp.client.sse import sse_client

async def test_key_manager():
    async with sse_client("http://localhost:3000/sse") as client:
        # List available tools
        tools = await client.list_tools()
        print(f"Available tools: {len(tools.tools)}")
        
        # Call list_key_managers tool
        result = await client.call_tool("list_key_managers", {
            "scope": "cluster"
        })
        print(result)

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_key_manager())
```

### Node.js Example (using MCP SDK)
```javascript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

async function testKeyManager() {
  const transport = new SSEClientTransport(
    new URL("http://localhost:3000/sse")
  );
  
  const client = new Client({
    name: "test-client",
    version: "1.0.0"
  }, {
    capabilities: {}
  });

  await client.connect(transport);
  
  // List available tools
  const tools = await client.listTools();
  console.log(`Available tools: ${tools.tools.length}`);
  
  // Call list_key_managers tool
  const result = await client.callTool({
    name: "list_key_managers",
    arguments: {
      scope: "cluster"
    }
  });
  
  console.log(result);
  
  await client.close();
}

testKeyManager().catch(console.error);
```

## Available Tools (13)

### Key Manager Management
1. **list_key_managers** - List all key managers
   ```json
   { "scope": "cluster" }
   ```

2. **get_key_manager** - Get key manager details
   ```json
   { "uuid": "key-manager-uuid" }
   ```

3. **create_external_key_manager** - Configure external KMIP
   ```json
   {
     "client_certificate_uuid": "cert-uuid",
     "server_ca_certificate_uuids": ["ca-uuid"],
     "key_servers": [
       { "server": "kmip.example.com:5696", "timeout": 30 }
     ]
   }
   ```

4. **create_onboard_key_manager** - Enable onboard key manager
   ```json
   {
     "passphrase": "YourVerySecurePassphraseThatIs32CharsOrMore",
     "synchronize": true
   }
   ```

5. **update_key_manager_passphrase** - Update OKM passphrase
   ```json
   {
     "uuid": "key-manager-uuid",
     "existing_passphrase": "old-passphrase",
     "new_passphrase": "new-passphrase"
   }
   ```

6. **sync_key_manager** - Sync keys across nodes
   ```json
   {
     "uuid": "key-manager-uuid",
     "passphrase": "current-passphrase"
   }
   ```

7. **delete_key_manager** - Delete key manager
   ```json
   { "uuid": "key-manager-uuid" }
   ```

### Key Server Management
8. **list_key_servers** - List key servers
   ```json
   { "key_manager_uuid": "key-manager-uuid" }
   ```

9. **add_key_server** - Add a key server
   ```json
   {
     "key_manager_uuid": "key-manager-uuid",
     "server": "kmip2.example.com:5696",
     "timeout": 30
   }
   ```

10. **delete_key_server** - Remove a key server
    ```json
    {
      "key_manager_uuid": "key-manager-uuid",
      "server": "kmip2.example.com:5696"
    }
    ```

### Key Operations
11. **list_keys** - List encryption keys
    ```json
    {
      "key_manager_uuid": "key-manager-uuid",
      "key_type": "vek"
    }
    ```

12. **create_auth_key** - Create authentication key
    ```json
    {
      "key_manager_uuid": "key-manager-uuid",
      "key_tag": "my-nse-key"
    }
    ```

13. **restore_keys** - Restore keys from key manager
    ```json
    { "key_manager_uuid": "key-manager-uuid" }
    ```

## Testing Workflow

### 1. List Key Managers
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

### 2. Create Onboard Key Manager
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "create_onboard_key_manager",
      "arguments": {
        "passphrase": "ThisIsAVerySecurePassphraseThatIs32CharsOrMoreInLength"
      }
    }
  }'
```

### 3. Get Key Manager Details
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "get_key_manager",
      "arguments": {
        "uuid": "your-key-manager-uuid"
      }
    }
  }'
```

## Error Handling

The server returns standard MCP error responses:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32603,
    "message": "HTTP 401: Unauthorized"
  }
}
```

Common errors:
- **401 Unauthorized**: Invalid ONTAP credentials
- **404 Not Found**: Key manager UUID not found
- **400 Bad Request**: Invalid parameters
- **500 Internal Server Error**: ONTAP API error

## Tips

1. **Save Backup Data**: When creating/updating onboard key managers, always save the backup data returned
2. **Use UUIDs**: Key manager operations require UUIDs, not names
3. **Test Connectivity**: Use `list_key_managers` first to verify connection
4. **Passphrase Requirements**: OKM passphrases must be 32-256 characters
5. **External Key Manager**: Requires certificates to be installed first

## Troubleshooting

### Cannot connect to server
```bash
# Check server is running
curl http://localhost:3000/health

# Check server logs
docker-compose logs -f
```

### Authentication failed
```bash
# Verify credentials work with ONTAP REST API directly
curl -k -u admin:password https://$ONTAP_CLUSTER_IP/api/cluster
```

### Tool not found
```bash
# List available tools
curl http://localhost:3000/mcp -X POST -d '{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}'
```

## Additional Resources

- [FastMCP Documentation](https://github.com/punkpeye/fastmcp)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [NetApp ONTAP REST API](https://docs.netapp.com/us-en/ontap-automation/)
- [Key Manager Documentation](https://docs.netapp.com/us-en/ontap/encryption-at-rest/)
