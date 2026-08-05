export const ETB = (n: number | string | null | undefined) => {
  const v = Number(n ?? 0);
  return `${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;
};

export const odds = (n: number | string) => Number(n).toFixed(2);

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Addis_Ababa",
  });

export const BET_STATUS_LABEL: Record<string, string> = {
  open: "Open",
  won: "Won",
  lost: "Lost",
  void: "Void",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export const FIGHT_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  upcoming: "Upcoming",
  open: "Betting open",
  suspended: "Suspended",
  live: "Live",
  result_pending: "Result pending",
  settled: "Settled",
  cancelled: "Cancelled",
  postponed: "Postponed",
};

export const TXN_LABEL: Record<string, string> = {
  deposit_pending: "Deposit submitted",
  deposit_approved: "Deposit approved",
  deposit_rejected: "Deposit rejected",
  bet_stake_held: "Stake held",
  bet_stake_returned: "Stake returned",
  bet_winnings_paid: "Winnings paid",
  withdrawal_requested: "Withdrawal requested",
  withdrawal_approved: "Withdrawal approved",
  withdrawal_rejected: "Withdrawal rejected",
  withdrawal_paid: "Withdrawal paid",
  admin_adjustment: "Admin adjustment",
};
