// Import key manager tools
import {
  createClusterListKeyManagersToolDefinition,
  handleClusterListKeyManagers,
  createClusterGetKeyManagerToolDefinition,
  handleClusterGetKeyManager,
  createClusterCreateExternalKeyManagerToolDefinition,
  handleClusterCreateExternalKeyManager,
  createClusterCreateOnboardKeyManagerToolDefinition,
  handleClusterCreateOnboardKeyManager,
  createClusterUpdateKeyManagerPassphraseToolDefinition,
  handleClusterUpdateKeyManagerPassphrase,
  createClusterSyncKeyManagerToolDefinition,
  handleClusterSyncKeyManager,
  createClusterDeleteKeyManagerToolDefinition,
  handleClusterDeleteKeyManager,
  createClusterListKeyServersToolDefinition,
  handleClusterListKeyServers,
  createClusterAddKeyServerToolDefinition,
  handleClusterAddKeyServer,
  createClusterDeleteKeyServerToolDefinition,
  handleClusterDeleteKeyServer,
  createClusterListKeysToolDefinition,
  handleClusterListKeys,
  createClusterCreateAuthKeyToolDefinition,
  handleClusterCreateAuthKey,
  createClusterRestoreKeysToolDefinition,
  handleClusterRestoreKeys
} from "../tools/key-manager-tools.js";

// In registerAllTools() function, add:

  // Key Manager Tools
  registerTool({
    name: "cluster_list_key_managers",
    category: ToolCategory.KEY_MANAGEMENT,
    definition: createClusterListKeyManagersToolDefinition,
    handler: handleClusterListKeyManagers
  });

  registerTool({
    name: "cluster_get_key_manager",
    category: ToolCategory.KEY_MANAGEMENT,
    definition: createClusterGetKeyManagerToolDefinition,
    handler: handleClusterGetKeyManager
  });

  registerTool({
    name: "cluster_create_external_key_manager",
    category: ToolCategory.KEY_MANAGEMENT,
    definition: createClusterCreateExternalKeyManagerToolDefinition,
    handler: handleClusterCreateExternalKeyManager
  });

  registerTool({
    name: "cluster_create_onboard_key_manager",
    category: ToolCategory.KEY_MANAGEMENT,
    definition: createClusterCreateOnboardKeyManagerToolDefinition,
    handler: handleClusterCreateOnboardKeyManager
  });

  registerTool({
    name: "cluster_update_key_manager_passphrase",
    category: ToolCategory.KEY_MANAGEMENT,
    definition: createClusterUpdateKeyManagerPassphraseToolDefinition,
    handler: handleClusterUpdateKeyManagerPassphrase
  });

  registerTool({
    name: "cluster_sync_key_manager",
    category: ToolCategory.KEY_MANAGEMENT,
    definition: createClusterSyncKeyManagerToolDefinition,
    handler: handleClusterSyncKeyManager
  });

  registerTool({
    name: "cluster_delete_key_manager",
    category: ToolCategory.KEY_MANAGEMENT,
    definition: createClusterDeleteKeyManagerToolDefinition,
    handler: handleClusterDeleteKeyManager
  });

  registerTool({
    name: "cluster_list_key_servers",
    category: ToolCategory.KEY_MANAGEMENT,
    definition: createClusterListKeyServersToolDefinition,
    handler: handleClusterListKeyServers
  });

  registerTool({
    name: "cluster_add_key_server",
    category: ToolCategory.KEY_MANAGEMENT,
    definition: createClusterAddKeyServerToolDefinition,
    handler: handleClusterAddKeyServer
  });

  registerTool({
    name: "cluster_delete_key_server",
    category: ToolCategory.KEY_MANAGEMENT,
    definition: createClusterDeleteKeyServerToolDefinition,
    handler: handleClusterDeleteKeyServer
  });

  registerTool({
    name: "cluster_list_keys",
    category: ToolCategory.KEY_MANAGEMENT,
    definition: createClusterListKeysToolDefinition,
    handler: handleClusterListKeys
  });

  registerTool({
    name: "cluster_create_auth_key",
    category: ToolCategory.KEY_MANAGEMENT,
    definition: createClusterCreateAuthKeyToolDefinition,
    handler: handleClusterCreateAuthKey
  });

  registerTool({
    name: "cluster_restore_keys",
    category: ToolCategory.KEY_MANAGEMENT,
    definition: createClusterRestoreKeysToolDefinition,
    handler: handleClusterRestoreKeys
  });