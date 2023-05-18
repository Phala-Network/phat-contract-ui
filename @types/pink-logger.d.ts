interface PinkLoggerEvent {
  blockNumber: number
  contract: string
  sequence: number
  payload: string
  topics: string[]
  type: "Event"
}

interface PinkLoggerMessageOutput {
  blockNumber: number
  contract: string
  sequence: number
  nonce: string
  origin: string
  output: string
  type: "MessageOutput"
  decoded?: string
}

interface PinkLoggerLogRecord {
  blockNumber: number
  contract: string
  sequence: number
  type: "Log"
  entry: string
  execMode: string
  timestamp: number
  message: string
}

type PinkLoggerRecord = PinkLoggerEvent | PinkLoggerMessageOutput | PinkLoggerLogRecord


interface PinkLoggerResposne {
  next: number
  records: PinkLoggerRecord[]
}

