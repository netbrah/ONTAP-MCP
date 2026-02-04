#!/usr/bin/env node

/**
 * NetApp ONTAP Key Manager MCP Server
 * 
 * Simplified FastMCP-based server for keymanager operations only
 * Uses HTTP SSE transport with environment-based configuration
 */

import { FastMCP } from "fastmcp";
import { z } from "zod";
import https from 'https';

// Environment configuration
const ONTAP_CLUSTER_IP = process.env.ONTAP_CLUSTER_IP || '';
const ONTAP_USERNAME = process.env.ONTAP_USERNAME || 'admin';
const ONTAP_PASSWORD = process.env.ONTAP_PASSWORD || '';
const PORT = parseInt(process.env.PORT || '3000', 10);

if (!ONTAP_CLUSTER_IP) {
  console.error('ERROR: ONTAP_CLUSTER_IP environment variable is required');
  process.exit(1);
}

// Simple ONTAP REST API client
class OntapClient {
  private baseUrl: string;
  private auth: string;
  private agent: https.Agent;

  constructor(clusterIp: string, username: string, password: string) {
    this.baseUrl = `https://${clusterIp}`;
    this.auth = Buffer.from(`${username}:${password}`).toString('base64');
    // Allow self-signed certificates
    this.agent = new https.Agent({ rejectUnauthorized: false });
  }

  async request(method: string, path: string, body?: any): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    const options = {
      method,
      headers: {
        'Authorization': `Basic ${this.auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      agent: this.agent
    };

    return new Promise((resolve, reject) => {
      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const parsed = data ? JSON.parse(data) : {};
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${parsed.error?.message || data}`));
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  async get(path: string): Promise<any> {
    return this.request('GET', path);
  }

  async post(path: string, body: any): Promise<any> {
    return this.request('POST', path, body);
  }

  async patch(path: string, body: any): Promise<any> {
    return this.request('PATCH', path, body);
  }

  async delete(path: string): Promise<any> {
    return this.request('DELETE', path);
  }
}

// Initialize ONTAP client
const ontapClient = new OntapClient(ONTAP_CLUSTER_IP, ONTAP_USERNAME, ONTAP_PASSWORD);

// Initialize FastMCP server
const server = new FastMCP({
  name: "NetApp ONTAP Key Manager",
  version: "2.0.0"
});

// ============================================================================
// Key Manager Management Tools
// ============================================================================

server.addTool({
  name: "list_key_managers",
  description: "List all key managers (onboard and external) configured on the cluster",
  parameters: z.object({
    scope: z.enum(['cluster', 'svm']).optional().describe("Filter by scope"),
    svm_name: z.string().optional().describe("Filter by SVM name")
  }),
  execute: async (args) => {
    let path = '/api/security/key-managers?fields=*';
    if (args.scope) {
      path += `&scope=${args.scope}`;
    }
    if (args.svm_name) {
      path += `&svm.name=${args.svm_name}`;
    }
    
    const result = await ontapClient.get(path);
    
    if (!result.records || result.records.length === 0) {
      return '🔐 No key managers configured on cluster';
    }

    let summary = `🔐 Key Managers (${result.records.length} found)\n\n`;
    for (const km of result.records) {
      const type = km.external ? 'External (KMIP)' : 'Onboard';
      const scope = km.scope || 'cluster';
      summary += `📋 ${type} - ${scope}-scoped`;
      if (km.svm) {
        summary += ` (SVM: ${km.svm.name})`;
      }
      summary += `\n   UUID: ${km.uuid}\n`;
      
      if (km.external && km.external.servers) {
        summary += `   Servers: ${km.external.servers.map((s: any) => s.server).join(', ')}\n`;
      }
      summary += '\n';
    }

    return summary;
  }
});

server.addTool({
  name: "get_key_manager",
  description: "Get detailed information about a specific key manager",
  parameters: z.object({
    uuid: z.string().uuid().describe("UUID of the key manager")
  }),
  execute: async (args) => {
    const result = await ontapClient.get(`/api/security/key-managers/${args.uuid}?fields=*`);
    
    let summary = '🔐 Key Manager Details\n\n';
    summary += `UUID: ${result.uuid}\n`;
    summary += `Scope: ${result.scope || 'cluster'}\n`;
    
    if (result.svm) {
      summary += `SVM: ${result.svm.name}\n`;
    }
    
    if (result.external) {
      summary += `\nType: External (KMIP)\n`;
      summary += `Client Certificate: ${result.external.client_certificate?.uuid || 'N/A'}\n`;
      
      if (result.external.servers) {
        summary += `\nKey Servers:\n`;
        for (const server of result.external.servers) {
          summary += `  - ${server.server}\n`;
          if (server.connectivity) {
            summary += `    Status: ${server.connectivity.state || 'unknown'}\n`;
          }
        }
      }
    } else if (result.onboard) {
      summary += `\nType: Onboard Key Manager\n`;
      summary += `Enabled: ${result.onboard.enabled || false}\n`;
      
      if (result.onboard.key_backup) {
        summary += `\n⚠️  IMPORTANT: Save this backup data securely!\n`;
        summary += `Backup Data:\n${result.onboard.key_backup}\n`;
      }
    }
    
    return summary;
  }
});

server.addTool({
  name: "create_external_key_manager",
  description: "Configure external key management (KMIP) with certificates and key servers",
  parameters: z.object({
    client_certificate_uuid: z.string().uuid().describe("UUID of the client certificate"),
    server_ca_certificate_uuids: z.array(z.string().uuid())
      .min(1)
      .describe("UUIDs of server CA certificates"),
    key_servers: z.array(z.object({
      server: z.string().describe("Key server address (host:port)"),
      timeout: z.number().min(1).max(60).default(25).optional()
    })).min(1).max(4).describe("Primary key servers (max 4)"),
    svm_uuid: z.string().uuid().optional().describe("SVM UUID (for SVM-scoped key manager)"),
    policy: z.string().optional().describe("Security policy name")
  }),
  execute: async (args) => {
    const body: any = {
      external: {
        client_certificate: { uuid: args.client_certificate_uuid },
        server_ca_certificates: args.server_ca_certificate_uuids.map(uuid => ({ uuid })),
        servers: args.key_servers
      }
    };
    
    if (args.svm_uuid) {
      body.svm = { uuid: args.svm_uuid };
    }
    if (args.policy) {
      body.external.policy = args.policy;
    }
    
    const result = await ontapClient.post('/api/security/key-managers?return_records=true', body);
    
    if (result.records && result.records.length > 0) {
      const km = result.records[0];
      return `✅ External key manager created successfully\nUUID: ${km.uuid}`;
    }
    
    return '✅ External key manager creation initiated';
  }
});

server.addTool({
  name: "create_onboard_key_manager",
  description: "Enable the Onboard Key Manager (OKM) with a cluster-wide passphrase",
  parameters: z.object({
    passphrase: z.string()
      .min(32)
      .max(256)
      .describe("Cluster-wide passphrase (32-256 characters)"),
    synchronize: z.boolean()
      .optional()
      .describe("Sync with MetroCluster partner")
  }),
  execute: async (args) => {
    const body: any = {
      onboard: {
        enabled: true,
        passphrase: args.passphrase
      }
    };
    
    if (args.synchronize !== undefined) {
      body.onboard.synchronize = args.synchronize;
    }
    
    const result = await ontapClient.post('/api/security/key-managers?return_records=true', body);
    
    let summary = '✅ Onboard Key Manager enabled successfully\n\n';
    
    if (result.records && result.records.length > 0) {
      const km = result.records[0];
      summary += `UUID: ${km.uuid}\n`;
      
      if (km.onboard?.key_backup) {
        summary += `\n⚠️  CRITICAL: Save this backup data in a secure location!\n`;
        summary += `This is required for disaster recovery.\n\n`;
        summary += `Backup Data:\n${km.onboard.key_backup}\n`;
      }
    }
    
    return summary;
  }
});

server.addTool({
  name: "update_key_manager_passphrase",
  description: "Update the Onboard Key Manager passphrase",
  parameters: z.object({
    uuid: z.string().uuid().describe("UUID of the onboard key manager"),
    existing_passphrase: z.string().describe("Current passphrase"),
    new_passphrase: z.string().min(32).max(256).describe("New passphrase")
  }),
  execute: async (args) => {
    const body = {
      onboard: {
        existing_passphrase: args.existing_passphrase,
        passphrase: args.new_passphrase
      }
    };
    
    await ontapClient.patch(`/api/security/key-managers/${args.uuid}?return_records=true`, body);
    
    // Get updated backup data
    const result = await ontapClient.get(`/api/security/key-managers/${args.uuid}?fields=onboard.key_backup`);
    
    let summary = '✅ Passphrase updated successfully\n\n';
    
    if (result.onboard?.key_backup) {
      summary += `⚠️  CRITICAL: Save the new backup data securely!\n\n`;
      summary += `New Backup Data:\n${result.onboard.key_backup}\n`;
    }
    
    return summary;
  }
});

server.addTool({
  name: "sync_key_manager",
  description: "Synchronize onboard keys across all nodes in the cluster",
  parameters: z.object({
    uuid: z.string().uuid().describe("UUID of the onboard key manager"),
    passphrase: z.string().describe("Current passphrase")
  }),
  execute: async (args) => {
    const body = {
      passphrase: args.passphrase
    };
    
    await ontapClient.post(`/api/security/key-managers/${args.uuid}/sync`, body);
    
    return '✅ Key manager synchronized successfully across all cluster nodes';
  }
});

server.addTool({
  name: "delete_key_manager",
  description: "Delete a key manager configuration. WARNING: Ensure no volumes are using encryption keys before deletion",
  parameters: z.object({
    uuid: z.string().uuid().describe("UUID of the key manager to delete")
  }),
  execute: async (args) => {
    await ontapClient.delete(`/api/security/key-managers/${args.uuid}`);
    
    return '✅ Key manager deleted successfully';
  }
});

// ============================================================================
// Key Server Management Tools
// ============================================================================

server.addTool({
  name: "list_key_servers",
  description: "List all key servers configured for an external key manager",
  parameters: z.object({
    key_manager_uuid: z.string().uuid().describe("UUID of the key manager")
  }),
  execute: async (args) => {
    const result = await ontapClient.get(
      `/api/security/key-managers/${args.key_manager_uuid}?fields=external.servers.*`
    );
    
    if (!result.external?.servers || result.external.servers.length === 0) {
      return '🔑 No key servers configured';
    }

    let summary = `🔑 Key Servers (${result.external.servers.length} found)\n\n`;
    
    for (const server of result.external.servers) {
      summary += `📍 ${server.server}\n`;
      summary += `   Timeout: ${server.timeout || 25}s\n`;
      
      if (server.connectivity) {
        summary += `   Status: ${server.connectivity.state || 'unknown'}\n`;
        if (server.connectivity.node_states) {
          summary += `   Node Status:\n`;
          for (const nodeState of server.connectivity.node_states) {
            summary += `     - ${nodeState.node?.name || 'unknown'}: ${nodeState.state || 'unknown'}\n`;
          }
        }
      }
      summary += '\n';
    }

    return summary;
  }
});

server.addTool({
  name: "add_key_server",
  description: "Add a primary key server to an external key manager",
  parameters: z.object({
    key_manager_uuid: z.string().uuid().describe("UUID of the external key manager"),
    server: z.string().describe("Key server address (host:port)"),
    timeout: z.number().min(1).max(60).default(25).optional(),
    username: z.string().optional(),
    password: z.string().optional()
  }),
  execute: async (args) => {
    const body: any = {
      server: args.server
    };
    
    if (args.timeout) body.timeout = args.timeout;
    if (args.username) body.username = args.username;
    if (args.password) body.password = args.password;
    
    await ontapClient.post(
      `/api/security/key-managers/${args.key_manager_uuid}/key-servers`,
      body
    );
    
    return `✅ Key server ${args.server} added successfully`;
  }
});

server.addTool({
  name: "delete_key_server",
  description: "Remove a key server from an external key manager",
  parameters: z.object({
    key_manager_uuid: z.string().uuid().describe("UUID of the key manager"),
    server: z.string().describe("Key server address to remove")
  }),
  execute: async (args) => {
    // URL encode the server parameter
    const encodedServer = encodeURIComponent(args.server);
    await ontapClient.delete(
      `/api/security/key-managers/${args.key_manager_uuid}/key-servers/${encodedServer}`
    );
    
    return `✅ Key server ${args.server} removed successfully`;
  }
});

// ============================================================================
// Key Operations Tools
// ============================================================================

server.addTool({
  name: "list_keys",
  description: "List encryption keys stored in a key manager",
  parameters: z.object({
    key_manager_uuid: z.string().uuid().describe("UUID of the key manager"),
    key_type: z.enum(['nse_ak', 'aek', 'vek', 'nek', 'svm_kek', 'mroot_ak']).optional(),
    restored: z.boolean().optional()
  }),
  execute: async (args) => {
    let path = `/api/security/key-managers/${args.key_manager_uuid}/keys?fields=*`;
    
    if (args.key_type) {
      path += `&type=${args.key_type}`;
    }
    if (args.restored !== undefined) {
      path += `&restored=${args.restored}`;
    }
    
    const result = await ontapClient.get(path);
    
    if (!result.records || result.records.length === 0) {
      return '🔑 No keys found';
    }

    let summary = `🔑 Encryption Keys (${result.records.length} found)\n\n`;
    
    for (const key of result.records) {
      summary += `🗝️  Key ID: ${key.key_id || 'N/A'}\n`;
      summary += `   Type: ${key.type || 'N/A'}\n`;
      summary += `   Node: ${key.node?.name || 'N/A'}\n`;
      if (key.restored !== undefined) {
        summary += `   Restored: ${key.restored}\n`;
      }
      summary += '\n';
    }

    return summary;
  }
});

server.addTool({
  name: "create_auth_key",
  description: "Create a new authentication key for NSE drives",
  parameters: z.object({
    key_manager_uuid: z.string().uuid().describe("UUID of the key manager"),
    key_tag: z.string().optional().describe("Tag for the key"),
    passphrase: z.string().optional().describe("Passphrase (for onboard key manager)")
  }),
  execute: async (args) => {
    const body: any = {};
    
    if (args.key_tag) body.key_tag = args.key_tag;
    if (args.passphrase) body.passphrase = args.passphrase;
    
    await ontapClient.post(
      `/api/security/key-managers/${args.key_manager_uuid}/auth-keys`,
      body
    );
    
    return '✅ Authentication key created successfully';
  }
});

server.addTool({
  name: "restore_keys",
  description: "Restore missing encryption keys from the key manager to nodes",
  parameters: z.object({
    key_manager_uuid: z.string().uuid().describe("UUID of the key manager")
  }),
  execute: async (args) => {
    await ontapClient.post(
      `/api/security/key-managers/${args.key_manager_uuid}/restore`,
      {}
    );
    
    return '✅ Key restoration initiated. Keys are being restored from the key manager to all nodes.';
  }
});

// ============================================================================
// Start Server
// ============================================================================

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║   NetApp ONTAP Key Manager MCP Server                        ║
║   FastMCP-based HTTP SSE Server                               ║
╚═══════════════════════════════════════════════════════════════╝

Configuration:
  ONTAP Cluster IP: ${ONTAP_CLUSTER_IP}
  ONTAP Username:   ${ONTAP_USERNAME}
  HTTP Port:        ${PORT}

Key Manager Tools: 13
  - list_key_managers
  - get_key_manager
  - create_external_key_manager
  - create_onboard_key_manager
  - update_key_manager_passphrase
  - sync_key_manager
  - delete_key_manager
  - list_key_servers
  - add_key_server
  - delete_key_server
  - list_keys
  - create_auth_key
  - restore_keys

Starting server...
`);

server.start({
  transportType: "httpStream",
  httpStream: {
    port: PORT,
    endpoint: "/mcp"
  }
});

console.log(`✅ Server started on port ${PORT}`);
console.log(`📡 MCP endpoint: http://localhost:${PORT}/mcp`);
console.log(`📡 SSE endpoint: http://localhost:${PORT}/sse`);
