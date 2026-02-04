/**
 * MCP Tools for NetApp ONTAP Key Manager Operations
 * These tools provide key management operations for registered ONTAP clusters
 */

import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { OntapClusterManager } from '../ontap-client.js';
import type { 
  KeyManager,
  KeyManagerListResult,
  KeyManagerResult,
  KeyListResult,
  KeyServer,
  KeyServerNodeState
} from '../types/key-manager-types.js';

// ================================
// Zod Schemas for Input Validation
// ================================

const ClusterListKeyManagersSchema = z.object({
  cluster_name: z.string().describe("Name of the registered cluster"),
  scope: z.enum(['cluster', 'svm']).describe("Filter by scope").optional(),
  svm_name: z.string().describe("Filter by SVM name").optional()
});

const ClusterGetKeyManagerSchema = z.object({
  cluster_name: z.string().describe("Name of the registered cluster"),
  uuid: z.string().uuid().describe("UUID of the key manager")
});

const ClusterCreateExternalKeyManagerSchema = z.object({
  cluster_name: z.string().describe("Name of the registered cluster"),
  client_certificate_uuid: z.string().uuid().describe("UUID of the client certificate"),
  server_ca_certificate_uuids: z.array(z.string().uuid())
    .min(1)
    .describe("UUIDs of server CA certificates"),
  key_servers: z.array(z.object({
    server: z.string().describe("Key server address (host:port)"),
    timeout: z.number().min(1).max(60).default(25).optional()
  })).min(1).max(4).describe("Primary key servers (max 4)"),
  svm_uuid: z.string().uuid().describe("SVM UUID (for SVM-scoped key manager)").optional(),
  policy: z.string().describe("Security policy name").optional()
});

const ClusterCreateOnboardKeyManagerSchema = z.object({
  cluster_name: z.string().describe("Name of the registered cluster"),
  passphrase: z.string()
    .min(32)
    .max(256)
    .describe("Cluster-wide passphrase (32-256 characters)"),
  synchronize: z.boolean()
    .describe("Sync with MetroCluster partner")
    .optional()
});

const ClusterUpdatePassphraseSchema = z.object({
  cluster_name: z.string().describe("Name of the registered cluster"),
  uuid: z.string().uuid().describe("UUID of the onboard key manager"),
  existing_passphrase: z.string().describe("Current passphrase"),
  new_passphrase: z.string().min(32).max(256).describe("New passphrase")
});

const ClusterSyncKeyManagerSchema = z.object({
  cluster_name: z.string().describe("Name of the registered cluster"),
  uuid: z.string().uuid().describe("UUID of the onboard key manager"),
  passphrase: z.string().describe("Current passphrase")
});

const ClusterDeleteKeyManagerSchema = z.object({
  cluster_name: z.string().describe("Name of the registered cluster"),
  uuid: z.string().uuid().describe("UUID of the key manager to delete")
});

const ClusterAddKeyServerSchema = z.object({
  cluster_name: z.string().describe("Name of the registered cluster"),
  key_manager_uuid: z.string().uuid().describe("UUID of the external key manager"),
  server: z.string().describe("Key server address (host:port)"),
  timeout: z.number().min(1).max(60).default(25).optional(),
  username: z.string().optional(),
  password: z.string().optional()
});

const ClusterListKeyServersSchema = z.object({
  cluster_name: z.string().describe("Name of the registered cluster"),
  key_manager_uuid: z.string().uuid().describe("UUID of the key manager")
});

const ClusterDeleteKeyServerSchema = z.object({
  cluster_name: z.string().describe("Name of the registered cluster"),
  key_manager_uuid: z.string().uuid().describe("UUID of the key manager"),
  server: z.string().describe("Key server address to remove")
});

const ClusterListKeysSchema = z.object({
  cluster_name: z.string().describe("Name of the registered cluster"),
  key_manager_uuid: z.string().uuid().describe("UUID of the key manager"),
  key_type: z.enum(['nse_ak', 'aek', 'vek', 'nek', 'svm_kek', 'mroot_ak']).optional(),
  restored: z.boolean().optional()
});

const ClusterCreateAuthKeySchema = z.object({
  cluster_name: z.string().describe("Name of the registered cluster"),
  key_manager_uuid: z.string().uuid().describe("UUID of the key manager"),
  key_tag: z.string().max(32).optional(),
  passphrase: z.string().min(20).max(32).optional()
});

const ClusterRestoreKeysSchema = z.object({
  cluster_name: z.string().describe("Name of the registered cluster"),
  key_manager_uuid: z.string().uuid().describe("UUID of the key manager")
});

// ================================
// Tool Definition Functions
// ================================

export function createClusterListKeyManagersToolDefinition(): Tool {
  return {
    name: "cluster_list_key_managers",
    description: "List all key managers (onboard and external) configured on a cluster",
    inputSchema: {
      type: "object",
      properties: {
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        scope: { type: "string", enum: ["cluster", "svm"], description: "Filter by scope" },
        svm_name: { type: "string", description: "Filter by SVM name" }
      },
      required: ["cluster_name"],
      additionalProperties: false
    }
  };
}

export function createClusterGetKeyManagerToolDefinition(): Tool {
  return {
    name: "cluster_get_key_manager",
    description: "Get detailed information about a specific key manager including status and backup data",
    inputSchema: {
      type: "object",
      properties: {
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        uuid: { type: "string", description: "UUID of the key manager" }
      },
      required: ["cluster_name", "uuid"],
      additionalProperties: false
    }
  };
}

export function createClusterCreateExternalKeyManagerToolDefinition(): Tool {
  return {
    name: "cluster_create_external_key_manager",
    description: "Configure external key management (KMIP) with certificates and key servers",
    inputSchema: {
      type: "object",
      properties: {
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        client_certificate_uuid: { type: "string", description: "UUID of the client certificate" },
        server_ca_certificate_uuids: { 
          type: "array", 
          items: { type: "string" },
          description: "UUIDs of server CA certificates" 
        },
        key_servers: {
          type: "array",
          items: {
            type: "object",
            properties: {
              server: { type: "string", description: "Key server address (host:port)" },
              timeout: { type: "integer", default: 25, description: "Timeout in seconds" }
            },
            required: ["server"]
          },
          maxItems: 4,
          description: "Primary key servers (max 4)"
        },
        svm_uuid: { type: "string", description: "SVM UUID for SVM-scoped key manager" },
        policy: { type: "string", description: "Security policy name" }
      },
      required: ["cluster_name", "client_certificate_uuid", "server_ca_certificate_uuids", "key_servers"],
      additionalProperties: false
    }
  };
}

export function createClusterCreateOnboardKeyManagerToolDefinition(): Tool {
  return {
    name: "cluster_create_onboard_key_manager",
    description: "Enable the Onboard Key Manager (OKM) with a cluster-wide passphrase",
    inputSchema: {
      type: "object",
      properties: {
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        passphrase: { type: "string", minLength: 32, maxLength: 256, description: "Cluster-wide passphrase (32-256 characters)" },
        synchronize: { type: "boolean", description: "Synchronize with MetroCluster partner" }
      },
      required: ["cluster_name", "passphrase"],
      additionalProperties: false
    }
  };
}

export function createClusterUpdateKeyManagerPassphraseToolDefinition(): Tool {
  return {
    name: "cluster_update_key_manager_passphrase",
    description: "Update the Onboard Key Manager passphrase",
    inputSchema: {
      type: "object",
      properties: {
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        uuid: { type: "string", description: "UUID of the onboard key manager" },
        existing_passphrase: { type: "string", description: "Current passphrase" },
        new_passphrase: { type: "string", minLength: 32, maxLength: 256, description: "New passphrase" }
      },
      required: ["cluster_name", "uuid", "existing_passphrase", "new_passphrase"],
      additionalProperties: false
    }
  };
}

export function createClusterSyncKeyManagerToolDefinition(): Tool {
  return {
    name: "cluster_sync_key_manager",
    description: "Synchronize onboard keys across all nodes in the cluster",
    inputSchema: {
      type: "object",
      properties: {
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        uuid: { type: "string", description: "UUID of the onboard key manager" },
        passphrase: { type: "string", description: "Current passphrase" }
      },
      required: ["cluster_name", "uuid", "passphrase"],
      additionalProperties: false
    }
  };
}

export function createClusterDeleteKeyManagerToolDefinition(): Tool {
  return {
    name: "cluster_delete_key_manager",
    description: "Delete a key manager configuration. WARNING: Ensure no volumes are using encryption keys from this manager.",
    inputSchema: {
      type: "object",
      properties: {
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        uuid: { type: "string", description: "UUID of the key manager to delete" }
      },
      required: ["cluster_name", "uuid"],
      additionalProperties: false
    }
  };
}

export function createClusterListKeyServersToolDefinition(): Tool {
  return {
    name: "cluster_list_key_servers",
    description: "List all key servers configured for an external key manager",
    inputSchema: {
      type: "object",
      properties: {
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        key_manager_uuid: { type: "string", description: "UUID of the key manager" }
      },
      required: ["cluster_name", "key_manager_uuid"],
      additionalProperties: false
    }
  };
}

export function createClusterAddKeyServerToolDefinition(): Tool {
  return {
    name: "cluster_add_key_server",
    description: "Add a primary key server to an external key manager",
    inputSchema: {
      type: "object",
      properties: {
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        key_manager_uuid: { type: "string", description: "UUID of the external key manager" },
        server: { type: "string", description: "Key server address (host:port)" },
        timeout: { type: "integer", default: 25, description: "Timeout in seconds (1-60)" },
        username: { type: "string", description: "KMIP username" },
        password: { type: "string", description: "KMIP password" }
      },
      required: ["cluster_name", "key_manager_uuid", "server"],
      additionalProperties: false
    }
  };
}

export function createClusterDeleteKeyServerToolDefinition(): Tool {
  return {
    name: "cluster_delete_key_server",
    description: "Remove a key server from an external key manager",
    inputSchema: {
      type: "object",
      properties: {
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        key_manager_uuid: { type: "string", description: "UUID of the key manager" },
        server: { type: "string", description: "Key server address to remove" }
      },
      required: ["cluster_name", "key_manager_uuid", "server"],
      additionalProperties: false
    }
  };
}

export function createClusterListKeysToolDefinition(): Tool {
  return {
    name: "cluster_list_keys",
    description: "List encryption keys stored in a key manager",
    inputSchema: {
      type: "object",
      properties: {
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        key_manager_uuid: { type: "string", description: "UUID of the key manager" },
        key_type: { 
          type: "string", 
          enum: ["nse_ak", "aek", "vek", "nek", "svm_kek", "mroot_ak"],
          description: "Filter by key type" 
        },
        restored: { type: "boolean", description: "Filter by restore status" }
      },
      required: ["cluster_name", "key_manager_uuid"],
      additionalProperties: false
    }
  };
}

export function createClusterCreateAuthKeyToolDefinition(): Tool {
  return {
    name: "cluster_create_auth_key",
    description: "Create a new authentication key for NSE drives",
    inputSchema: {
      type: "object",
      properties: {
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        key_manager_uuid: { type: "string", description: "UUID of the key manager" },
        key_tag: { type: "string", maxLength: 32, description: "Key tag for identification" },
        passphrase: { type: "string", minLength: 20, maxLength: 32, description: "Authentication passphrase" }
      },
      required: ["cluster_name", "key_manager_uuid"],
      additionalProperties: false
    }
  };
}

export function createClusterRestoreKeysToolDefinition(): Tool {
  return {
    name: "cluster_restore_keys",
    description: "Restore missing encryption keys from the key manager to nodes",
    inputSchema: {
      type: "object",
      properties: {
        cluster_name: { type: "string", description: "Name of the registered cluster" },
        key_manager_uuid: { type: "string", description: "UUID of the key manager" }
      },
      required: ["cluster_name", "key_manager_uuid"],
      additionalProperties: false
    }
  };
}

// ================================
// Tool Handler Functions
// ================================

export async function handleClusterListKeyManagers(
  args: any, 
  clusterManager: OntapClusterManager
): Promise<KeyManagerListResult> {
  const validated = ClusterListKeyManagersSchema.parse(args);
  const client = clusterManager.getClient(validated.cluster_name);

  const keyManagers = await client.listKeyManagers({
    scope: validated.scope,
    svmName: validated.svm_name
  });

  const data = keyManagers.map(km => ({
    uuid: km.uuid,
    scope: km.scope,
    svm_name: km.svm?.name,
    enabled: km.enabled,
    type: km.onboard?.enabled ? 'onboard' as const : 'external' as const,
    status_message: km.status?.message,
    status_code: km.status?.code
  }));

  let summary = `🔐 **Key Managers on ${validated.cluster_name}** (${keyManagers.length} configured):\n\n`;
  
  if (keyManagers.length === 0) {
    summary = `No key managers configured on cluster ${validated.cluster_name}.`;
  } else {
    keyManagers.forEach(km => {
      const type = km.onboard?.enabled ? 'Onboard (OKM)' : 'External (KMIP)';
      summary += `🔑 **${km.uuid}**\n`;
      summary += `   • Type: ${type}\n`;
      summary += `   • Scope: ${km.scope}\n`;
      if (km.svm) summary += `   • SVM: ${km.svm.name}\n`;
      summary += `   • Enabled: ${km.enabled ? 'Yes' : 'No'}\n`;
      if (km.status?.message) summary += `   • Status: ${km.status.message}\n`;
      summary += '\n';
    });
  }

  return { summary, data };
}

// ... Add similar handler implementations for all other tools

export async function handleClusterGetKeyManager(
  args: any, 
  clusterManager: OntapClusterManager
): Promise<KeyManagerResult> {
  const validated = ClusterGetKeyManagerSchema.parse(args);
  const client = clusterManager.getClient(validated.cluster_name);

  const keyManager = await client.getKeyManager(validated.uuid);

  let summary = `🔐 **Key Manager Details**\n\n`;
  summary += `UUID: ${keyManager.uuid}\n`;
  summary += `Scope: ${keyManager.scope}\n`;
  if (keyManager.svm) summary += `SVM: ${keyManager.svm.name}\n`;
  summary += `Enabled: ${keyManager.enabled ? 'Yes' : 'No'}\n\n`;

  if (keyManager.onboard) {
    summary += `📋 **Onboard Key Manager**\n`;
    if (keyManager.onboard.key_backup) {
      summary += `⚠️  **IMPORTANT**: Save the backup data below in a secure location!\n`;
      summary += `\`\`\`\n${keyManager.onboard.key_backup}\n\`\`\`\n`;
    }
  }

  if (keyManager.external) {
    summary += `🌐 **External Key Manager**\n`;
    summary += `   Client Certificate: ${keyManager.external.client_certificate.uuid}\n`;
    summary += `   Key Servers:\n`;
    keyManager.external.servers?.forEach((server: KeyServer) => {
      summary += `     - ${server.server} (timeout: ${server.timeout}s)\n`;
    });
  }

  if (keyManager.volume_encryption) {
    summary += `\n💾 **Volume Encryption Support**: ${keyManager.volume_encryption.supported ? 'Yes' : 'No'}\n`;
    if (keyManager.volume_encryption.message) {
      summary += `   Message: ${keyManager.volume_encryption.message}\n`;
    }
  }

  return { summary, data: keyManager };
}

export async function handleClusterCreateExternalKeyManager(
  args: any,
  clusterManager: OntapClusterManager
): Promise<KeyManagerResult> {
  const validated = ClusterCreateExternalKeyManagerSchema.parse(args);
  const client = clusterManager.getClient(validated.cluster_name);

  const result = await client.createExternalKeyManager({
    svmUuid: validated.svm_uuid,
    clientCertificateUuid: validated.client_certificate_uuid,
    serverCaCertificateUuids: validated.server_ca_certificate_uuids,
    keyServers: validated.key_servers,
    policy: validated.policy
  });

  const keyManager = await client.getKeyManager(result.uuid);

  const summary = `🔐 **External Key Manager Created Successfully**\n\n` +
    `UUID: ${result.uuid}\n` +
    `Cluster: ${validated.cluster_name}\n` +
    `Scope: ${keyManager.scope}\n` +
    `Key Servers: ${validated.key_servers.length}\n\n` +
    `✅ External KMIP key management is now enabled.`;

  return { summary, data: keyManager };
}

export async function handleClusterCreateOnboardKeyManager(
  args: any,
  clusterManager: OntapClusterManager
): Promise<KeyManagerResult> {
  const validated = ClusterCreateOnboardKeyManagerSchema.parse(args);
  const client = clusterManager.getClient(validated.cluster_name);

  const result = await client.createOnboardKeyManager({
    passphrase: validated.passphrase,
    synchronize: validated.synchronize
  });

  const keyManager = await client.getKeyManager(result.uuid);

  let summary = `🔐 **Onboard Key Manager Created Successfully**\n\n` +
    `UUID: ${result.uuid}\n` +
    `Cluster: ${validated.cluster_name}\n` +
    `Scope: ${keyManager.scope}\n\n`;

  if (keyManager.onboard?.key_backup) {
    summary += `⚠️  **CRITICAL: Save the backup data below immediately!**\n`;
    summary += `Store it in a secure location for disaster recovery.\n\n`;
    summary += `\`\`\`\n${keyManager.onboard.key_backup}\n\`\`\`\n\n`;
  }

  summary += `✅ Onboard Key Manager is now enabled.`;

  return { summary, data: keyManager };
}

export async function handleClusterUpdateKeyManagerPassphrase(
  args: any,
  clusterManager: OntapClusterManager
): Promise<KeyManagerResult> {
  const validated = ClusterUpdatePassphraseSchema.parse(args);
  const client = clusterManager.getClient(validated.cluster_name);

  await client.updateKeyManagerPassphrase(validated.uuid, {
    existingPassphrase: validated.existing_passphrase,
    newPassphrase: validated.new_passphrase
  });

  const keyManager = await client.getKeyManager(validated.uuid);

  let summary = `🔐 **Passphrase Updated Successfully**\n\n` +
    `UUID: ${validated.uuid}\n` +
    `Cluster: ${validated.cluster_name}\n\n`;

  if (keyManager.onboard?.key_backup) {
    summary += `⚠️  **CRITICAL: New backup data generated!**\n`;
    summary += `Store this new backup in a secure location.\n\n`;
    summary += `\`\`\`\n${keyManager.onboard.key_backup}\n\`\`\`\n\n`;
  }

  summary += `✅ Onboard Key Manager passphrase has been updated.`;

  return { summary, data: keyManager };
}

export async function handleClusterSyncKeyManager(
  args: any,
  clusterManager: OntapClusterManager
): Promise<KeyManagerResult> {
  const validated = ClusterSyncKeyManagerSchema.parse(args);
  const client = clusterManager.getClient(validated.cluster_name);

  await client.syncOnboardKeyManager(validated.uuid, validated.passphrase);

  const keyManager = await client.getKeyManager(validated.uuid);

  const summary = `🔐 **Key Manager Synchronized**\n\n` +
    `UUID: ${validated.uuid}\n` +
    `Cluster: ${validated.cluster_name}\n\n` +
    `✅ Onboard keys have been synchronized across all cluster nodes.`;

  return { summary, data: keyManager };
}

export async function handleClusterDeleteKeyManager(
  args: any,
  clusterManager: OntapClusterManager
): Promise<{ summary: string; data: { uuid: string; deleted: boolean } }> {
  const validated = ClusterDeleteKeyManagerSchema.parse(args);
  const client = clusterManager.getClient(validated.cluster_name);

  await client.deleteKeyManager(validated.uuid);

  const summary = `🔐 **Key Manager Deleted**\n\n` +
    `UUID: ${validated.uuid}\n` +
    `Cluster: ${validated.cluster_name}\n\n` +
    `✅ Key manager configuration has been removed.`;

  return { summary, data: { uuid: validated.uuid, deleted: true } };
}

export async function handleClusterListKeyServers(
  args: any,
  clusterManager: OntapClusterManager
): Promise<{ summary: string; data: any[] }> {
  const validated = ClusterListKeyServersSchema.parse(args);
  const client = clusterManager.getClient(validated.cluster_name);

  const keyServers = await client.listKeyServers(validated.key_manager_uuid);

  let summary = `🔐 **Key Servers** (${keyServers.length} configured):\n\n`;
  
  if (keyServers.length === 0) {
    summary = `No key servers configured for key manager ${validated.key_manager_uuid}.`;
  } else {
    keyServers.forEach(server => {
      summary += `🌐 **${server.server}**\n`;
      if (server.timeout) summary += `   • Timeout: ${server.timeout}s\n`;
      if (server.username) summary += `   • Username: ${server.username}\n`;
      if (server.connectivity) {
        summary += `   • Cluster Available: ${server.connectivity.cluster_availability ? 'Yes' : 'No'}\n`;
        if (server.connectivity.node_states) {
          summary += `   • Node States:\n`;
          server.connectivity.node_states.forEach((node: KeyServerNodeState) => {
            summary += `     - ${node.node.name}: ${node.state}\n`;
          });
        }
      }
      summary += '\n';
    });
  }

  return { summary, data: keyServers };
}

export async function handleClusterAddKeyServer(
  args: any,
  clusterManager: OntapClusterManager
): Promise<{ summary: string; data: any }> {
  const validated = ClusterAddKeyServerSchema.parse(args);
  const client = clusterManager.getClient(validated.cluster_name);

  await client.addKeyServer(validated.key_manager_uuid, {
    server: validated.server,
    timeout: validated.timeout,
    username: validated.username,
    password: validated.password
  });

  const summary = `🔐 **Key Server Added**\n\n` +
    `Server: ${validated.server}\n` +
    `Key Manager UUID: ${validated.key_manager_uuid}\n` +
    `Cluster: ${validated.cluster_name}\n\n` +
    `✅ Key server has been added successfully.`;

  return { 
    summary, 
    data: {
      key_manager_uuid: validated.key_manager_uuid,
      server: validated.server,
      timeout: validated.timeout || 25
    }
  };
}

export async function handleClusterDeleteKeyServer(
  args: any,
  clusterManager: OntapClusterManager
): Promise<{ summary: string; data: { server: string; deleted: boolean } }> {
  const validated = ClusterDeleteKeyServerSchema.parse(args);
  const client = clusterManager.getClient(validated.cluster_name);

  await client.deleteKeyServer(validated.key_manager_uuid, validated.server);

  const summary = `🔐 **Key Server Removed**\n\n` +
    `Server: ${validated.server}\n` +
    `Key Manager UUID: ${validated.key_manager_uuid}\n` +
    `Cluster: ${validated.cluster_name}\n\n` +
    `✅ Key server has been removed successfully.`;

  return { summary, data: { server: validated.server, deleted: true } };
}

export async function handleClusterListKeys(
  args: any,
  clusterManager: OntapClusterManager
): Promise<KeyListResult> {
  const validated = ClusterListKeysSchema.parse(args);
  const client = clusterManager.getClient(validated.cluster_name);

  const keys = await client.listKeys(validated.key_manager_uuid, {
    keyType: validated.key_type,
    restored: validated.restored
  });

  const data = keys.map(key => ({
    key_id: key.key_id,
    key_type: key.key_type,
    key_tag: key.key_tag,
    key_server: key.key_server,
    restored: key.restored,
    key_store: key.key_store,
    key_user: key.key_user,
    encryption_algorithm: key.encryption_algorithm
  }));

  let summary = `🔑 **Encryption Keys** (${keys.length} keys):\n\n`;
  
  if (keys.length === 0) {
    summary = `No encryption keys found in key manager ${validated.key_manager_uuid}.`;
  } else {
    keys.forEach(key => {
      summary += `🔑 **${key.key_id}**\n`;
      summary += `   • Type: ${key.key_type}\n`;
      if (key.key_tag) summary += `   • Tag: ${key.key_tag}\n`;
      summary += `   • Restored: ${key.restored ? 'Yes' : 'No'}\n`;
      summary += `   • Store: ${key.key_store}\n`;
      if (key.key_server) summary += `   • Server: ${key.key_server}\n`;
      summary += '\n';
    });
  }

  return { summary, data };
}

export async function handleClusterCreateAuthKey(
  args: any,
  clusterManager: OntapClusterManager
): Promise<{ summary: string; data: { key_id: string } }> {
  const validated = ClusterCreateAuthKeySchema.parse(args);
  const client = clusterManager.getClient(validated.cluster_name);

  const result = await client.createAuthKey(validated.key_manager_uuid, {
    keyTag: validated.key_tag,
    passphrase: validated.passphrase
  });

  const summary = `🔑 **Authentication Key Created**\n\n` +
    `Key ID: ${result.keyId}\n` +
    `Key Manager UUID: ${validated.key_manager_uuid}\n` +
    `Cluster: ${validated.cluster_name}\n` +
    (validated.key_tag ? `Tag: ${validated.key_tag}\n` : '') +
    `\n✅ Authentication key for NSE drives has been created.`;

  return { summary, data: { key_id: result.keyId } };
}

export async function handleClusterRestoreKeys(
  args: any,
  clusterManager: OntapClusterManager
): Promise<{ summary: string; data: { key_manager_uuid: string; restored: boolean } }> {
  const validated = ClusterRestoreKeysSchema.parse(args);
  const client = clusterManager.getClient(validated.cluster_name);

  await client.restoreKeys(validated.key_manager_uuid);

  const summary = `🔑 **Keys Restored**\n\n` +
    `Key Manager UUID: ${validated.key_manager_uuid}\n` +
    `Cluster: ${validated.cluster_name}\n\n` +
    `✅ Missing encryption keys have been restored to nodes.`;

  return { 
    summary, 
    data: { 
      key_manager_uuid: validated.key_manager_uuid, 
      restored: true 
    } 
  };
}