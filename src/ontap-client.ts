import * as https from 'https';

// Type definitions for ONTAP API responses
export interface ClusterInfo {
  name: string;
  version: {
    generation: number;
    major: number;
    minor: number;
    micro: number;
    full: string;
  };
  uuid: string;
  state: string;
  nodes?: Array<{
    uuid: string;
    name: string;
    state: string;
  }>;
  management_interface?: {
    ip: {
      address: string;
      netmask: string;
    };
  };
}

export interface ClusterConfig {
  name: string;
  cluster_ip: string;
  username: string;
  password: string;
  description?: string;
  verify_ssl?: boolean;
}

export interface ClusterRegistry {
  [clusterName: string]: ClusterConfig;
}

/**
 * NetApp ONTAP Cluster Manager
 * Manages multiple ONTAP clusters and provides unified access
 */
export class OntapClusterManager {
  private clusters: ClusterRegistry = {};

  /**
   * Add a cluster to the registry
   */
  addCluster(config: ClusterConfig): void {
    this.clusters[config.name] = config;
  }

  /**
   * Get a cluster configuration by name
   */
  getCluster(name: string): ClusterConfig {
    const cluster = this.clusters[name];
    if (!cluster) {
      throw new Error(`Cluster '${name}' not found in registry. Available clusters: ${Object.keys(this.clusters).join(', ')}`);
    }
    return cluster;
  }

  /**
   * Get ONTAP API client for a specific cluster
   */
  getClient(clusterName: string): OntapApiClient {
    const config = this.getCluster(clusterName);
    return new OntapApiClient(
      config.cluster_ip,
      config.username,
      config.password,
      config.verify_ssl
    );
  }

  /**
   * List all registered clusters
   */
  listClusters(): ClusterConfig[] {
    return Object.values(this.clusters);
  }

  /**
   * Check if a cluster exists in the registry
   */
  hasCluster(name: string): boolean {
    return name in this.clusters;
  }

  /**
   * Remove a cluster from the registry
   */
  removeCluster(name: string): boolean {
    if (this.hasCluster(name)) {
      delete this.clusters[name];
      return true;
    }
    return false;
  }
}

/**
 * NetApp ONTAP API Client
 * Handles REST API communication with a single ONTAP cluster
 */
export class OntapApiClient {
  private baseUrl: string;
  private auth: string;
  private agent: https.Agent;

  constructor(
    clusterIp: string,
    username: string,
    password: string,
    verifySsl: boolean = true
  ) {
    this.baseUrl = `https://${clusterIp}/api`;
    this.auth = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
    this.agent = new https.Agent({
      rejectUnauthorized: verifySsl
    });
  }

  /**
   * Make an HTTP request to the ONTAP REST API
   */
  private async makeRequest<T = any>(
    endpoint: string,
    method: string = 'GET',
    body?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    return new Promise((resolve, reject) => {
      const options: https.RequestOptions = {
        method,
        headers: {
          'Authorization': this.auth,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        agent: this.agent
      };

      const req = https.request(url, options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = data ? JSON.parse(data) : {};
              resolve(parsed);
            } catch (e) {
              reject(new Error(`Failed to parse JSON response: ${e}`));
            }
          } else {
            let errorMessage = `HTTP ${res.statusCode}: ${res.statusMessage}`;
            try {
              const errorData = JSON.parse(data);
              errorMessage = `HTTP ${res.statusCode}: ${JSON.stringify(errorData)}`;
            } catch (e) {
              // Use default error message
            }
            reject(new Error(errorMessage));
          }
        });
      });

      req.on('error', (e) => {
        reject(new Error(`Request failed: ${e.message}`));
      });

      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }

  // ================================
  // Key Manager API Methods
  // ================================

  /**
   * List key managers (onboard and external)
   */
  async listKeyManagers(params?: {
    scope?: 'cluster' | 'svm';
    svmName?: string;
  }): Promise<any[]> {
    let url = '/security/key-managers?fields=*';
    if (params?.scope) url += `&scope=${params.scope}`;
    if (params?.svmName) url += `&svm.name=${params.svmName}`;
    
    const response = await this.makeRequest<{ records: any[] }>(url);
    return response.records || [];
  }

  /**
   * Get detailed information about a specific key manager
   */
  async getKeyManager(uuid: string): Promise<any> {
    const response = await this.makeRequest(`/security/key-managers/${uuid}?fields=*`);
    return response;
  }

  /**
   * Create external key manager configuration
   */
  async createExternalKeyManager(params: {
    clientCertificateUuid: string;
    serverCaCertificateUuids: string[];
    keyServers: Array<{ server: string; timeout?: number }>;
    svmUuid?: string;
    policy?: string;
  }): Promise<any> {
    const body: any = {
      external: {
        client_certificate: { uuid: params.clientCertificateUuid },
        server_ca_certificates: params.serverCaCertificateUuids.map(uuid => ({ uuid })),
        servers: params.keyServers.map(ks => ({
          server: ks.server,
          timeout: ks.timeout || 25
        }))
      }
    };

    if (params.svmUuid) {
      body.svm = { uuid: params.svmUuid };
    }
    if (params.policy) {
      body.policy = params.policy;
    }

    const response = await this.makeRequest<{ records: any[] }>('/security/key-managers?return_records=true', 'POST', body);
    return response.records?.[0];
  }

  /**
   * Create onboard key manager with passphrase
   */
  async createOnboardKeyManager(params: {
    passphrase: string;
    synchronize?: boolean;
  }): Promise<any> {
    const body: any = {
      onboard: {
        enabled: true,
        passphrase: params.passphrase
      }
    };
    if (params.synchronize !== undefined) {
      body.onboard.synchronize = params.synchronize;
    }
    const response = await this.makeRequest<{ records: any[] }>('/security/key-managers?return_records=true', 'POST', body);
    return response.records?.[0];
  }

  /**
   * Update onboard key manager passphrase
   */
  async updateKeyManagerPassphrase(uuid: string, params: {
    existingPassphrase: string;
    newPassphrase: string;
  }): Promise<any> {
    await this.makeRequest(`/security/key-managers/${uuid}`, 'PATCH', {
      onboard: {
        existing_passphrase: params.existingPassphrase,
        passphrase: params.newPassphrase
      }
    });
    // Return updated key manager
    return this.getKeyManager(uuid);
  }

  /**
   * Synchronize onboard key manager
   */
  async syncOnboardKeyManager(uuid: string, passphrase: string): Promise<void> {
    await this.makeRequest(`/security/key-managers/${uuid}`, 'PATCH', {
      onboard: {
        passphrase,
        synchronize: true
      }
    });
  }

  /**
   * Delete a key manager configuration
   */
  async deleteKeyManager(uuid: string): Promise<void> {
    await this.makeRequest(`/security/key-managers/${uuid}`, 'DELETE');
  }

  /**
   * List key servers for an external key manager
   */
  async listKeyServers(keyManagerUuid: string): Promise<any[]> {
    const response = await this.makeRequest<{ records: any[] }>(
      `/security/key-managers/${keyManagerUuid}/key-servers?fields=*`);
    return response.records || [];
  }

  /**
   * Add a key server to an external key manager
   */
  async addKeyServer(keyManagerUuid: string, params: {
    server: string;
    timeout?: number;
    username?: string;
    password?: string;
  }): Promise<any> {
    const response = await this.makeRequest<{ records: any[] }>(
      `/security/key-managers/${keyManagerUuid}/key-servers`, 'POST', params);
    return response.records?.[0];
  }

  /**
   * Remove a key server from an external key manager
   */
  async deleteKeyServer(keyManagerUuid: string, server: string): Promise<void> {
    const encodedServer = encodeURIComponent(server);
    await this.makeRequest(
      `/security/key-managers/${keyManagerUuid}/key-servers/${encodedServer}`, 'DELETE');
  }

  /**
   * List encryption keys in a key manager
   */
  async listKeys(keyManagerUuid: string, params?: {
    keyType?: string;
    restored?: boolean;
  }): Promise<any[]> {
    let url = `/security/key-managers/${keyManagerUuid}/keys?fields=*`;
    if (params?.keyType) url += `&key_type=${params.keyType}`;
    if (params?.restored !== undefined) url += `&restored=${params.restored}`;
    
    const response = await this.makeRequest<{ records: any[] }>(url);
    return response.records || [];
  }

  /**
   * Create an authentication key for NSE drives
   */
  async createAuthKey(keyManagerUuid: string, params?: {
    keyTag?: string;
    passphrase?: string;
  }): Promise<any> {
    const response = await this.makeRequest<{ records: any[] }>(
      `/security/key-managers/${keyManagerUuid}/auth-keys?return_records=true`, 'POST', params || {});
    return response.records?.[0];
  }

  /**
   * Restore encryption keys from key manager to nodes
   */
  async restoreKeys(keyManagerUuid: string): Promise<void> {
    await this.makeRequest(`/security/key-managers/${keyManagerUuid}/restore`, 'POST', {});
  }

  /**
   * Get cluster information
   */
  async getClusterInfo(): Promise<ClusterInfo> {
    const response = await this.makeRequest<ClusterInfo>('/cluster?fields=*');
    return response;
  }
}
