/**
 * Key Manager Types for NetApp ONTAP MCP Server
 */

// Key Manager scope
export type KeyManagerScope = 'cluster' | 'svm';
export type KeyStoreType = 'onboard' | 'external';
export type KeyStoreProviderType = 'okm' | 'kmip' | 'akv' | 'gcp' | 'aws' | 'ikp' | 'barbican';

// Key Server
export interface KeyServer {
  server: string;
  port?: number;
  timeout?: number;
  username?: string;
  secondary_key_servers?: string[];
  create_remove_timeout?: number;
  connectivity?: KeyServerConnectivity;
}

export interface KeyServerConnectivity {
  cluster_availability: boolean;
  node_states: KeyServerNodeState[];
}

export interface KeyServerNodeState {
  node: { name: string; uuid: string };
  state: 'available' | 'not_responding' | 'unknown';
}

// External Key Manager Config
export interface ExternalKeyManagerConfig {
  client_certificate: { uuid: string; name?: string };
  server_ca_certificates: { uuid: string; name?: string }[];
  servers: KeyServer[];
}

// Onboard Key Manager Config
export interface OnboardKeyManagerConfig {
  enabled: boolean;
  passphrase?: string;
  existing_passphrase?: string;
  synchronize?: boolean;
  key_backup?: string;
}

// Main Key Manager Object
export interface KeyManager {
  uuid: string;
  scope: KeyManagerScope;
  svm?: { uuid: string; name: string };
  configuration?: { uuid: string; name: string };
  enabled: boolean;
  policy?: string;
  external?: ExternalKeyManagerConfig;
  onboard?: OnboardKeyManagerConfig;
  status?: { message: string; code: number };
  volume_encryption?: {
    supported: boolean;
    message?: string;
    code?: number;
  };
}

// API Response Types
export interface KeyManagerListResult {
  summary: string;
  data: KeyManagerListInfo[];
}

export interface KeyManagerListInfo {
  uuid: string;
  scope: KeyManagerScope;
  svm_name?: string;
  enabled: boolean;
  type: KeyStoreType;
  status_message?: string;
  status_code?: number;
}

export interface KeyManagerResult {
  summary: string;
  data: KeyManager;
}

// Key types
export type KeyType = 'nse_ak' | 'aek' | 'vek' | 'nek' | 'svm_kek' | 'mroot_ak';

export interface KeyInfo {
  key_id: string;
  key_type: KeyType;
  key_tag?: string;
  key_server?: string;
  restored: boolean;
  key_store: KeyStoreType;
  key_user?: string;
  encryption_algorithm?: string;
}

export interface KeyListResult {
  summary: string;
  data: KeyInfo[];
}