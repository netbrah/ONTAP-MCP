#!/usr/bin/env node

/**
 * NetApp ONTAP Key Manager MCP Server - Simplified FastMCP Implementation
 * 
 * This server provides ONLY key manager operations for NetApp ONTAP clusters.
 * Uses FastMCP for simple HTTP SSE transport with environment-based configuration.
 */

import { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { OntapClusterManager } from './ontap-client.js';
import {
  // Handlers
  handleClusterListKeyManagers,
  handleClusterGetKeyManager,
  handleClusterCreateExternalKeyManager,
  handleClusterCreateOnboardKeyManager,
  handleClusterUpdateKeyManagerPassphrase,
  handleClusterSyncKeyManager,
  handleClusterDeleteKeyManager,
  handleClusterListKeyServers,
  handleClusterAddKeyServer,
  handleClusterDeleteKeyServer,
  handleClusterListKeys,
  handleClusterCreateAuthKey,
  handleClusterRestoreKeys
} from './tools/key-manager-tools.js';

// Initialize cluster manager
const clusterManager = new OntapClusterManager();

// Load clusters from environment variable
const loadClustersFromEnv = () => {
  const clustersEnv = process.env.ONTAP_CLUSTERS;
  if (!clustersEnv) {
    console.warn('⚠️  Warning: ONTAP_CLUSTERS environment variable not set');
    console.warn('   No clusters will be available until configured via environment');
    return;
  }

  try {
    const clusters = JSON.parse(clustersEnv);
    if (!Array.isArray(clusters)) {
      throw new Error('ONTAP_CLUSTERS must be a JSON array');
    }

    clusters.forEach((cluster: any) => {
      if (!cluster.name || !cluster.cluster_ip || !cluster.username || !cluster.password) {
        console.error('❌ Invalid cluster config:', cluster);
        return;
      }
      clusterManager.addCluster({
        name: cluster.name,
        cluster_ip: cluster.cluster_ip,
        username: cluster.username,
        password: cluster.password,
        description: cluster.description,
        verify_ssl: cluster.verify_ssl !== false // Default to true
      });
      console.log(`✅ Loaded cluster: ${cluster.name} (${cluster.cluster_ip})`);
    });
  } catch (error) {
    console.error('❌ Error parsing ONTAP_CLUSTERS:', error);
    throw error;
  }
};

// Load clusters on startup
loadClustersFromEnv();

// Create FastMCP server
const server = new FastMCP({
  name: 'ontap-key-manager-mcp',
  version: '2.0.0'
});

// ================================
// Register Key Manager Tools
// ================================

// 1. List Key Managers
server.addTool({
  name: 'cluster_list_key_managers',
  description: 'List all key managers (onboard and external) configured on a cluster',
  parameters: z.object({
    cluster_name: z.string().describe('Name of the registered cluster'),
    scope: z.enum(['cluster', 'svm']).describe('Filter by scope').optional(),
    svm_name: z.string().describe('Filter by SVM name').optional()
  }),
  execute: async (args) => {
    const result = await handleClusterListKeyManagers(args, clusterManager);
    return result.summary;
  }
});

// 2. Get Key Manager Details
server.addTool({
  name: 'cluster_get_key_manager',
  description: 'Get detailed information about a specific key manager including status and backup data',
  parameters: z.object({
    cluster_name: z.string().describe('Name of the registered cluster'),
    uuid: z.string().uuid().describe('UUID of the key manager')
  }),
  execute: async (args) => {
    const result = await handleClusterGetKeyManager(args, clusterManager);
    return result.summary;
  }
});

// 3. Create External Key Manager
server.addTool({
  name: 'cluster_create_external_key_manager',
  description: 'Configure external key management (KMIP) with certificates and key servers',
  parameters: z.object({
    cluster_name: z.string().describe('Name of the registered cluster'),
    client_certificate_uuid: z.string().uuid().describe('UUID of the client certificate'),
    server_ca_certificate_uuids: z.array(z.string().uuid())
      .min(1)
      .describe('UUIDs of server CA certificates'),
    key_servers: z.array(z.object({
      server: z.string().describe('Key server address (host:port)'),
      timeout: z.number().min(1).max(60).default(25).optional()
    })).min(1).max(4).describe('Primary key servers (max 4)'),
    svm_uuid: z.string().uuid().describe('SVM UUID (for SVM-scoped key manager)').optional(),
    policy: z.string().describe('Security policy name').optional()
  }),
  execute: async (args) => {
    const result = await handleClusterCreateExternalKeyManager(args, clusterManager);
    return result.summary;
  }
});

// 4. Create Onboard Key Manager
server.addTool({
  name: 'cluster_create_onboard_key_manager',
  description: 'Enable the Onboard Key Manager (OKM) with a cluster-wide passphrase',
  parameters: z.object({
    cluster_name: z.string().describe('Name of the registered cluster'),
    passphrase: z.string()
      .min(32)
      .max(256)
      .describe('Cluster-wide passphrase (32-256 characters)'),
    synchronize: z.boolean()
      .describe('Synchronize with MetroCluster partner')
      .optional()
  }),
  execute: async (args) => {
    const result = await handleClusterCreateOnboardKeyManager(args, clusterManager);
    return result.summary;
  }
});

// 5. Update Key Manager Passphrase
server.addTool({
  name: 'cluster_update_key_manager_passphrase',
  description: 'Update the Onboard Key Manager passphrase',
  parameters: z.object({
    cluster_name: z.string().describe('Name of the registered cluster'),
    uuid: z.string().uuid().describe('UUID of the onboard key manager'),
    existing_passphrase: z.string().describe('Current passphrase'),
    new_passphrase: z.string().min(32).max(256).describe('New passphrase')
  }),
  execute: async (args) => {
    const result = await handleClusterUpdateKeyManagerPassphrase(args, clusterManager);
    return result.summary;
  }
});

// 6. Sync Key Manager
server.addTool({
  name: 'cluster_sync_key_manager',
  description: 'Synchronize onboard keys across all nodes in the cluster',
  parameters: z.object({
    cluster_name: z.string().describe('Name of the registered cluster'),
    uuid: z.string().uuid().describe('UUID of the onboard key manager'),
    passphrase: z.string().describe('Current passphrase')
  }),
  execute: async (args) => {
    const result = await handleClusterSyncKeyManager(args, clusterManager);
    return result.summary;
  }
});

// 7. Delete Key Manager
server.addTool({
  name: 'cluster_delete_key_manager',
  description: 'Delete a key manager configuration. WARNING: Ensure no volumes are using encryption keys from this manager.',
  parameters: z.object({
    cluster_name: z.string().describe('Name of the registered cluster'),
    uuid: z.string().uuid().describe('UUID of the key manager to delete')
  }),
  execute: async (args) => {
    const result = await handleClusterDeleteKeyManager(args, clusterManager);
    return result.summary;
  }
});

// 8. List Key Servers
server.addTool({
  name: 'cluster_list_key_servers',
  description: 'List all key servers configured for an external key manager',
  parameters: z.object({
    cluster_name: z.string().describe('Name of the registered cluster'),
    key_manager_uuid: z.string().uuid().describe('UUID of the key manager')
  }),
  execute: async (args) => {
    const result = await handleClusterListKeyServers(args, clusterManager);
    return result.summary;
  }
});

// 9. Add Key Server
server.addTool({
  name: 'cluster_add_key_server',
  description: 'Add a primary key server to an external key manager',
  parameters: z.object({
    cluster_name: z.string().describe('Name of the registered cluster'),
    key_manager_uuid: z.string().uuid().describe('UUID of the external key manager'),
    server: z.string().describe('Key server address (host:port)'),
    timeout: z.number().min(1).max(60).default(25).optional(),
    username: z.string().optional(),
    password: z.string().optional()
  }),
  execute: async (args) => {
    const result = await handleClusterAddKeyServer(args, clusterManager);
    return result.summary;
  }
});

// 10. Delete Key Server
server.addTool({
  name: 'cluster_delete_key_server',
  description: 'Remove a key server from an external key manager',
  parameters: z.object({
    cluster_name: z.string().describe('Name of the registered cluster'),
    key_manager_uuid: z.string().uuid().describe('UUID of the key manager'),
    server: z.string().describe('Key server address to remove')
  }),
  execute: async (args) => {
    const result = await handleClusterDeleteKeyServer(args, clusterManager);
    return result.summary;
  }
});

// 11. List Keys
server.addTool({
  name: 'cluster_list_keys',
  description: 'List encryption keys stored in a key manager',
  parameters: z.object({
    cluster_name: z.string().describe('Name of the registered cluster'),
    key_manager_uuid: z.string().uuid().describe('UUID of the key manager'),
    key_type: z.enum(['nse_ak', 'aek', 'vek', 'nek', 'svm_kek', 'mroot_ak']).optional(),
    restored: z.boolean().optional()
  }),
  execute: async (args) => {
    const result = await handleClusterListKeys(args, clusterManager);
    return result.summary;
  }
});

// 12. Create Auth Key
server.addTool({
  name: 'cluster_create_auth_key',
  description: 'Create a new authentication key for NSE drives',
  parameters: z.object({
    cluster_name: z.string().describe('Name of the registered cluster'),
    key_manager_uuid: z.string().uuid().describe('UUID of the key manager'),
    key_tag: z.string().max(32).optional(),
    passphrase: z.string().min(20).max(32).optional()
  }),
  execute: async (args) => {
    const result = await handleClusterCreateAuthKey(args, clusterManager);
    return result.summary;
  }
});

// 13. Restore Keys
server.addTool({
  name: 'cluster_restore_keys',
  description: 'Restore missing encryption keys from the key manager to nodes',
  parameters: z.object({
    cluster_name: z.string().describe('Name of the registered cluster'),
    key_manager_uuid: z.string().uuid().describe('UUID of the key manager')
  }),
  execute: async (args) => {
    const result = await handleClusterRestoreKeys(args, clusterManager);
    return result.summary;
  }
});

// ================================
// Start Server
// ================================

const port = parseInt(process.env.PORT || '3000', 10);

console.log('🚀 Starting NetApp ONTAP Key Manager MCP Server...');
console.log(`   Server Name: ontap-key-manager-mcp`);
console.log(`   Version: 2.0.0`);
console.log(`   Transport: HTTP SSE`);
console.log(`   Port: ${port}`);
console.log(`   Clusters loaded: ${clusterManager.listClusters().length}`);

server.start({
  transportType: 'httpStream',
  httpStream: {
    port: port
  }
});

console.log(`✅ Server running on http://localhost:${port}`);
console.log(`   SSE endpoint: http://localhost:${port}/sse`);
