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