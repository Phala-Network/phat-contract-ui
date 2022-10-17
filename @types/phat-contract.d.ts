interface ClusterInfo {
  owner: AccountId,
  // @fixme
  permission: "Public" | string
  systemContract?: string
  workers: string[]
}

interface ContractInfo {
  clusterId: string
  codeIndex: {
    wasmCode: string
  }
  deployer: AccountId
  instantiateData: string
  salt: string
}

interface EndpointInfo {
  V1: string[]
}