// Ledger module — the financial foundation of PlayStake.
// Every money movement in the system flows through this module.

export {
  getOrCreatePlayerAccount,
  getOrCreateDeveloperAccount,
  createEscrowAccount,
  getSystemAccount,
  getAccountBalance,
  getEscrowAccountForBet,
  type SystemAccountType,
} from "./accounts.js";

export {
  transfer,
  InsufficientFundsError,
  FrozenAccountError,
  type TransferInput,
  type TransferResult,
} from "./transfer.js";

export {
  holdEscrow,
  releaseEscrow,
  refundEscrow,
  collectFee,
  distributeDevShare,
  EscrowError,
  type HoldEscrowInput,
  type ReleaseEscrowInput,
  type RefundEscrowInput,
  type CollectFeeInput,
  type DistributeDevShareInput,
} from "./escrow.js";

export {
  verifyAccountBalance,
  verifyTransactionBalance,
  verifySystemConservation,
  runFullAudit,
  type AccountDiscrepancy,
  type TransactionImbalance,
  type AuditReport,
} from "./audit.js";
