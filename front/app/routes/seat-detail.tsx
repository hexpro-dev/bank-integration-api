import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router";
import { Button, Card, Chip, Input, Label, TextField } from "@heroui/react";
import type { banking } from "~/lib/client";
import { client } from "~/lib/api";
import TwoFaConfigForm, { EMPTY_2FA, type TwoFaFormState } from "~/components/TwoFaConfigForm";
import TwoFaReadView from "~/components/TwoFaReadView";

const BANK_LABELS: Record<string, string> = {
  anz: "ANZ",
  commbank: "CommBank",
  nab: "NAB",
  westpac: "Westpac",
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(date: string) {
  return new Date(date).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(amount: string | number) {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(num);
}

export default function SeatDetailPage() {
  const { id } = useParams();

  const [seat, setSeat] = useState<banking.SeatDetailResponse | null>(null);
  const [accounts, setAccounts] = useState<banking.AccountItem[]>([]);
  const [balances, setBalances] = useState<Record<string, banking.BalanceItem[]>>({});
  const [transactions, setTransactions] = useState<Record<string, banking.TransactionItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  const [editingTwoFa, setEditingTwoFa] = useState(false);
  const [twoFaForm, setTwoFaForm] = useState<TwoFaFormState>(EMPTY_2FA);
  const [savingTwoFa, setSavingTwoFa] = useState(false);

  const [editingScopes, setEditingScopes] = useState(false);
  const [scopesForm, setScopesForm] = useState<banking.ScopeItem[]>([]);
  const [newScopeId, setNewScopeId] = useState("");
  const [newScopeType, setNewScopeType] = useState<"name" | "number">("name");
  const [savingScopes, setSavingScopes] = useState(false);

  const fetchSeat = useCallback(async () => {
    if (!id) return;
    const data = await client.banking.getSeat(id);
    setSeat(data);
    const cfg = data.twoFaConfig;
    setTwoFaForm(cfg ? { ...EMPTY_2FA, ...cfg, apiKey: "", apiSecret: "" } : EMPTY_2FA);
    setScopesForm(data.scopes || []);
  }, [id]);

  const fetchAccounts = useCallback(async () => {
    if (!id) return;
    const data = await client.banking.listAccounts(id);
    setAccounts(data.accounts);
    const balanceEntries = await Promise.all(
      data.accounts.map(async (acc) => {
        try {
          const b = await client.banking.getBalances(acc.id, { limit: 5 });
          return [acc.id, b.balances] as const;
        } catch {
          return [acc.id, []] as const;
        }
      }),
    );
    setBalances(Object.fromEntries(balanceEntries));
  }, [id]);

  const fetchTransactions = useCallback(async (accountId: string) => {
    try {
      const data = await client.banking.getTransactions(accountId, { limit: 20 });
      setTransactions((prev) => ({ ...prev, [accountId]: data.transactions }));
    } catch {
      setTransactions((prev) => ({ ...prev, [accountId]: [] }));
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([fetchSeat(), fetchAccounts()])
      .catch((err: any) => setError(err.message || "Failed to load seat"))
      .finally(() => setLoading(false));
  }, [id, fetchSeat, fetchAccounts]);

  useEffect(() => {
    if (expandedAccount && !transactions[expandedAccount]) {
      fetchTransactions(expandedAccount);
    }
  }, [expandedAccount, transactions, fetchTransactions]);

  const handleRefresh = async (accountId: string) => {
    setRefreshing(accountId);
    try {
      await client.banking.refreshAccount(accountId);
      await new Promise((r) => setTimeout(r, 1500));
      await fetchAccounts();
      if (transactions[accountId]) {
        await fetchTransactions(accountId);
      }
    } catch (err: any) {
      setError(err.message || "Refresh failed");
    } finally {
      setRefreshing(null);
    }
  };

  const saveTwoFa = async () => {
    if (!id) return;
    setSavingTwoFa(true);
    setError(null);
    try {
      await client.banking.update2fa(id, {
        method: twoFaForm.method as "sms" | "app",
        smsProvider: (twoFaForm.smsProvider as "twilio" | "plivo") || undefined,
        apiKey: twoFaForm.apiKey || undefined,
        apiSecret: twoFaForm.apiSecret || undefined,
        phoneNumber: twoFaForm.phoneNumber || undefined,
        forwardTo: twoFaForm.forwardTo || undefined,
        notificationEmail: twoFaForm.notificationEmail || undefined,
      });
      await fetchSeat();
      setEditingTwoFa(false);
    } catch (err: any) {
      setError(err.message || "Failed to save 2FA config");
    } finally {
      setSavingTwoFa(false);
    }
  };

  const saveScopes = async () => {
    if (!id) return;
    setSavingScopes(true);
    setError(null);
    try {
      await client.banking.updateScopes(id, { scopes: scopesForm });
      await fetchSeat();
      setEditingScopes(false);
    } catch (err: any) {
      setError(err.message || "Failed to save scopes");
    } finally {
      setSavingScopes(false);
    }
  };

  const addScope = () => {
    if (!newScopeId.trim()) return;
    setScopesForm((prev) => [
      ...prev,
      { identifier: newScopeId.trim(), type: newScopeType },
    ]);
    setNewScopeId("");
  };

  const removeScope = (idx: number) => {
    setScopesForm((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateTwoFa = (field: string, value: string) =>
    setTwoFaForm((f) => ({ ...f, [field]: value }));

  if (loading) {
    return <p className="text-default-400 text-sm py-8 text-center">Loading…</p>;
  }

  if (!seat) {
    return (
      <div className="text-center py-8">
        <p className="text-default-500 mb-2">Seat not found.</p>
        <Link to="/seats" className="text-sm text-accent hover:underline">
          ← Back to Seats
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link to="/seats" className="text-sm text-default-600 hover:text-default-900">
          ← Seats
        </Link>
        <Chip size="sm" variant="soft" color="accent">
          {BANK_LABELS[seat.bank] || seat.bank}
        </Chip>
        <h2 className="text-xl font-semibold">{seat.label || seat.username}</h2>
        <Chip
          size="sm"
          variant="soft"
          color={seat.isActive ? "success" : "default"}
        >
          {seat.isActive ? "Active" : "Inactive"}
        </Chip>
      </div>

      {error && (
        <div className="bg-danger-50 text-danger border border-danger-200 rounded-lg px-3 py-2 mb-3 text-sm flex items-center justify-between">
          <span>{error}</span>
          <Button size="sm" variant="ghost" onPress={() => setError(null)}>
            ✕
          </Button>
        </div>
      )}

      <div className="grid gap-4">
        {/* Info */}
        <Card>
          <Card.Header>
            <h3 className="text-sm font-semibold">Details</h3>
          </Card.Header>
          <Card.Content>
            <div className="flex items-center gap-3">
              <span className="text-sm text-default-500">{seat.username}</span>
              <span className="text-xs text-default-400">
                Created {formatDate(seat.createdAt)}
              </span>
            </div>
          </Card.Content>
        </Card>

        {/* Accounts & Balances */}
        <Card>
          <Card.Header>
            <div className="flex items-center justify-between w-full">
              <h3 className="text-sm font-semibold">Accounts</h3>
              <span className="text-xs text-default-400">
                {accounts.length} account{accounts.length !== 1 && "s"}
              </span>
            </div>
          </Card.Header>
          <Card.Content>
            {accounts.length === 0 ? (
              <p className="text-sm text-default-400 py-2">
                No accounts linked yet. The observer will discover accounts
                after connecting.
              </p>
            ) : (
              <div className="divide-y divide-default-100 -mx-1">
                {accounts.map((acc) => {
                  const accBalances = balances[acc.id] || [];
                  const latest = accBalances[0];
                  const isExpanded = expandedAccount === acc.id;
                  const accTxns = transactions[acc.id];

                  return (
                    <div key={acc.id} className="px-1">
                      <div className="flex items-center justify-between py-2.5 gap-3">
                        <button
                          type="button"
                          className="flex items-center gap-3 min-w-0 text-left"
                          onClick={() =>
                            setExpandedAccount(isExpanded ? null : acc.id)
                          }
                        >
                          <span
                            className={`text-xs transition-transform ${isExpanded ? "rotate-90" : ""}`}
                          >
                            ▶
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {acc.accountName}
                            </p>
                            <p className="text-xs text-default-400">
                              {acc.accountNumber}{" "}
                              {acc.accountType && (
                                <>
                                  <span className="text-default-300">·</span>{" "}
                                  {acc.accountType}
                                </>
                              )}
                            </p>
                          </div>
                        </button>
                        <div className="flex items-center gap-3 shrink-0">
                          {latest && (
                            <div className="text-right">
                              <span className="text-sm font-semibold tabular-nums">
                                {formatCurrency(latest.available)}
                              </span>
                              {latest.current !== latest.available && (
                                <p className="text-xs text-default-400 tabular-nums">
                                  Current: {formatCurrency(latest.current)}
                                </p>
                              )}
                            </div>
                          )}
                          <Button
                            size="sm"
                            variant="secondary"
                            isPending={refreshing === acc.id}
                            onPress={() => handleRefresh(acc.id)}
                          >
                            {({ isPending }) => isPending ? "Refreshing…" : "Refresh"}
                          </Button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="pb-3 pl-7">
                          {accBalances.length > 1 && (
                            <div className="mb-3">
                              <p className="text-xs font-medium text-default-500 mb-1">
                                Recent Balances
                              </p>
                              <div className="flex gap-3 overflow-x-auto text-xs">
                                {accBalances.map((b) => (
                                  <div
                                    key={b.id}
                                    className="shrink-0 bg-default-50 rounded px-2 py-1"
                                  >
                                    <span className="font-medium tabular-nums">
                                      {formatCurrency(b.available)}
                                    </span>
                                    <span className="text-default-400 ml-1.5">
                                      {formatDateTime(b.recordedAt)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <p className="text-xs font-medium text-default-500 mb-1">
                            Recent Transactions
                          </p>
                          {!accTxns ? (
                            <p className="text-xs text-default-400">
                              Loading…
                            </p>
                          ) : accTxns.length === 0 ? (
                            <p className="text-xs text-default-400">
                              No transactions found.
                            </p>
                          ) : (
                            <div className="border border-default-200 rounded-lg overflow-hidden text-xs">
                              <div className="grid grid-cols-[90px_1fr_100px_100px] gap-2 px-3 py-1.5 bg-default-50 text-default-500 font-medium">
                                <span>Date</span>
                                <span>Description</span>
                                <span className="text-right">Amount</span>
                                <span className="text-right">Balance</span>
                              </div>
                              {accTxns.map((txn) => (
                                <div
                                  key={txn.id}
                                  className="grid grid-cols-[90px_1fr_100px_100px] gap-2 px-3 py-1.5 border-t border-default-100"
                                >
                                  <span className="text-default-500 tabular-nums">
                                    {formatDate(txn.transactionDate)}
                                  </span>
                                  <span className="truncate">
                                    {txn.description}
                                  </span>
                                  <span
                                    className={`text-right font-medium tabular-nums ${
                                      txn.transactionType === "credit"
                                        ? "text-success"
                                        : "text-danger"
                                    }`}
                                  >
                                    {txn.transactionType === "credit" ? "+" : "−"}
                                    {formatCurrency(Math.abs(parseFloat(txn.amount)))}
                                  </span>
                                  <span className="text-right text-default-500 tabular-nums">
                                    {txn.balance != null
                                      ? formatCurrency(txn.balance)
                                      : "—"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card.Content>
        </Card>

        {/* 2FA Configuration */}
        <Card>
          <Card.Header>
            <div className="flex items-center justify-between w-full">
              <h3 className="text-sm font-semibold">2FA Configuration</h3>
              {!editingTwoFa && (
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={() => {
                    const cfg = seat.twoFaConfig;
                    setTwoFaForm(cfg ? { ...EMPTY_2FA, ...cfg, apiKey: "", apiSecret: "" } : EMPTY_2FA);
                    setEditingTwoFa(true);
                  }}
                >
                  Edit
                </Button>
              )}
            </div>
          </Card.Header>
          <Card.Content>
            {editingTwoFa ? (
              <div className="space-y-3">
                <TwoFaConfigForm
                  value={twoFaForm}
                  onChange={updateTwoFa}
                  webhookUrl={seat.twoFaConfig?.webhookUrl}
                />
                <div className="flex gap-2 justify-end pt-1">
                  <Button
                    size="sm"
                    variant="tertiary"
                    onPress={() => setEditingTwoFa(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onPress={saveTwoFa}
                    isPending={savingTwoFa}
                  >
                    {({ isPending }) => isPending ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            ) : (
              <TwoFaReadView config={seat.twoFaConfig} />
            )}
          </Card.Content>
        </Card>

        {/* Account Scopes */}
        <Card>
          <Card.Header>
            <div className="flex items-center justify-between w-full">
              <h3 className="text-sm font-semibold">Account Scopes</h3>
              {!editingScopes && (
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={() => {
                    setScopesForm(seat.scopes || []);
                    setEditingScopes(true);
                  }}
                >
                  Edit
                </Button>
              )}
            </div>
          </Card.Header>
          <Card.Content>
            {editingScopes ? (
              <div>
                {scopesForm.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {scopesForm.map((scope, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <Chip size="sm" variant="soft">
                          {scope.identifier} ({scope.type})
                        </Chip>
                        <button
                          type="button"
                          className="text-default-400 hover:text-default-700 text-xs leading-none"
                          onClick={() => removeScope(idx)}
                          aria-label="Remove scope"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 items-end mb-3">
                  <TextField onChange={setNewScopeId} className="flex-1">
                    <Label>Identifier</Label>
                    <Input value={newScopeId} />
                  </TextField>
                  <div className="flex rounded-lg overflow-hidden border border-default-200 shrink-0">
                    <button
                      type="button"
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                        newScopeType === "name"
                          ? "bg-primary text-primary-foreground"
                          : "bg-default-50 text-default-600 hover:bg-default-100"
                      }`}
                      onClick={() => setNewScopeType("name")}
                    >
                      Name
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                        newScopeType === "number"
                          ? "bg-primary text-primary-foreground"
                          : "bg-default-50 text-default-600 hover:bg-default-100"
                      }`}
                      onClick={() => setNewScopeType("number")}
                    >
                      Number
                    </button>
                  </div>
                  <Button size="sm" variant="secondary" onPress={addScope}>
                    Add
                  </Button>
                </div>
                {scopesForm.length === 0 && (
                  <p className="text-xs text-default-400 mb-3">
                    No scopes — all accounts will be observed.
                  </p>
                )}
                <div className="flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="tertiary"
                    onPress={() => setEditingScopes(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onPress={saveScopes}
                    isPending={savingScopes}
                  >
                    {({ isPending }) => isPending ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            ) : (
              <ScopesReadView scopes={seat.scopes} />
            )}
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}

function ScopesReadView({ scopes }: { scopes?: banking.AccountScopeResponse[] }) {
  if (!scopes || scopes.length === 0) {
    return (
      <p className="text-sm text-default-400">
        All accounts — no scope restrictions.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {scopes.map((scope, idx) => (
        <Chip key={idx} size="sm" variant="soft">
          {scope.identifier} ({scope.type})
        </Chip>
      ))}
    </div>
  );
}
