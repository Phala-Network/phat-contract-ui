interface ClusterInfo {
  id: string
  owner: AccountId,
  // @fixme
  permission: "Public" | string
  systemContract?: string
  workers: string[]
  gasPrice: number
  depositPerByte: number
  depositPerItem: number
}

interface ContractInfo {
  cluster: string
  codeIndex: {
    wasmCode: string
  }
  deployer: AccountId
  pubkey: string
}

interface EndpointInfo {
  V1: string[]
}