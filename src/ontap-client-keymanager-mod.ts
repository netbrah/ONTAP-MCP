// Add to OntapClient class

// Key Manager Methods
async listKeyManagers(params?: {
  scope?: 'cluster' | 'svm';
  svmName?: string;
}): Promise<KeyManager[]> {
  let url = `/api/security/key-managers?fields=*`;
  if (params?.scope) url += `&scope=${params.scope}`;
  if (params?.svmName) url += `&svm.name=${params.svmName}`;
  
  const response = await this.makeRequest('GET', url);
  return response.records || [];
}

async getKeyManager(uuid: string): Promise<KeyManager> {
  const response = await this.makeRequest('GET', `/api/security/key-managers/${uuid}?fields=*`);
  return response;
}

async createExternalKeyManager(params: {
  svmUuid?: string;
  clientCertificateUuid: string;
  serverCaCertificateUuids: string[];
  servers: { server: string; timeout?: number }[];
  policy?: string;
}): Promise<{ uuid: string }> {
  const body: any = {
    external: {
      client_certificate: { uuid: params.clientCertificateUuid },
      server_ca_certificates: params.serverCaCertificateUuids.map(uuid => ({ uuid })),
      servers: params.servers
    }
  };
  
  if (params.svmUuid) {
    body.svm = { uuid: params.svmUuid };
  }
  if (params.policy) {
    body.policy = params.policy;
  }
  
  const response = await this.makeRequest('POST', '/api/security/key-managers?return_records=true', body);
  return { uuid: response.records[0].uuid };
}

async createOnboardKeyManager(params: {
  passphrase: string;
  synchronize?: boolean;
}): Promise<{ uuid: string }> {
  const body = {
    onboard: {
      passphrase: params.passphrase,
      synchronize: params.synchronize
    }
  };
  
  const response = await this.makeRequest('POST', '/api/security/key-managers?return_records=true', body);
  return { uuid: response.records[0].uuid };
}

async updateKeyManagerPassphrase(uuid: string, params: {
  existingPassphrase: string;
  newPassphrase: string;
}): Promise<void> {
  await this.makeRequest('PATCH', `/api/security/key-managers/${uuid}`, {
    onboard: {
      existing_passphrase: params.existingPassphrase,
      passphrase: params.newPassphrase
    }
  });
}

async syncOnboardKeyManager(uuid: string, passphrase: string): Promise<void> {
  await this.makeRequest('PATCH', `/api/security/key-managers/${uuid}`, {
    onboard: {
      existing_passphrase: passphrase,
      synchronize: true
    }
  });
}

async deleteKeyManager(uuid: string): Promise<void> {
  await this.makeRequest('DELETE', `/api/security/key-managers/${uuid}`);
}

// Key Server Methods
async listKeyServers(keyManagerUuid: string): Promise<KeyServer[]> {
  const response = await this.makeRequest('GET', 
    `/api/security/key-managers/${keyManagerUuid}/key-servers?fields=*`);
  return response.records || [];
}

async addKeyServer(keyManagerUuid: string, params: {
  server: string;
  timeout?: number;
  username?: string;
  password?: string;
}): Promise<void> {
  await this.makeRequest('POST', 
    `/api/security/key-managers/${keyManagerUuid}/key-servers`, params);
}

async deleteKeyServer(keyManagerUuid: string, server: string): Promise<void> {
  const encodedServer = encodeURIComponent(server);
  await this.makeRequest('DELETE', 
    `/api/security/key-managers/${keyManagerUuid}/key-servers/${encodedServer}`);
}

// Key Query Methods
async listKeys(keyManagerUuid: string, params?: {
  keyType?: KeyType;
  restored?: boolean;
}): Promise<KeyInfo[]> {
  let url = `/api/security/key-managers/${keyManagerUuid}/keys?fields=*`;
  if (params?.keyType) url += `&key_type=${params.keyType}`;
  if (params?.restored !== undefined) url += `&restored=${params.restored}`;
  
  const response = await this.makeRequest('GET', url);
  return response.records || [];
}

async createAuthKey(keyManagerUuid: string, params: {
  keyTag?: string;
  passphrase?: string;
}): Promise<{ keyId: string }> {
  const response = await this.makeRequest('POST', 
    `/api/security/key-managers/${keyManagerUuid}/auth-keys?return_records=true`, params);
  return { keyId: response.records[0].key_id };
}

async restoreKeys(keyManagerUuid: string): Promise<void> {
  await this.makeRequest('POST', `/api/security/key-managers/${keyManagerUuid}/restore`);
}