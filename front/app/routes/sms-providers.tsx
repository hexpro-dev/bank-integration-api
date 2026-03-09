import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router";
import { Button, Card, Chip, ListBox, Select, Label } from "@heroui/react";
import type { banking } from "~/lib/client";
import { client } from "~/lib/api";
import TwoFaConfigForm, { EMPTY_2FA, type TwoFaFormState } from "~/components/TwoFaConfigForm";

const BANK_LABELS: Record<string, string> = {
  anz: "ANZ",
  commbank: "CommBank",
  nab: "NAB",
  westpac: "Westpac",
};

const PAGE_SIZE = 50;

function formatDateTime(date: string) {
  return new Date(date).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function SmsProvidersPage() {
  const [seats, setSeats] = useState<banking.SeatSummary[]>([]);
  const [smsSeats, setSmsSeats] = useState<banking.SeatSummary[]>([]);
  const [loadingSeats, setLoadingSeats] = useState(true);

  const [logs, setLogs] = useState<banking.SmsLogItem[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsOffset, setLogsOffset] = useState(0);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [logFilter, setLogFilter] = useState<string>("");

  const [editingSeatId, setEditingSeatId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TwoFaFormState>(EMPTY_2FA);
  const [editWebhookUrl, setEditWebhookUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const fetchSeats = useCallback(async () => {
    try {
      setLoadingSeats(true);
      const data = await client.banking.listSeats();
      setSeats(data.seats);
      setSmsSeats(
        data.seats.filter(
          (s) => s.twoFaSummary && s.twoFaSummary.method === "sms",
        ),
      );
    } catch (err: any) {
      setError(err.message || "Failed to load seats");
    } finally {
      setLoadingSeats(false);
    }
  }, []);

  const fetchLogs = useCallback(
    async (offset = 0) => {
      try {
        setLoadingLogs(true);
        const data = await client.banking.listSmsLogs({
          seatId: logFilter || undefined,
          limit: PAGE_SIZE,
          offset,
        });
        setLogs(data.logs);
        setLogsTotal(data.total);
        setLogsOffset(offset);
      } catch (err: any) {
        setError(err.message || "Failed to load SMS logs");
      } finally {
        setLoadingLogs(false);
      }
    },
    [logFilter],
  );

  useEffect(() => {
    fetchSeats();
  }, [fetchSeats]);

  useEffect(() => {
    fetchLogs(0);
  }, [fetchLogs]);

  async function startEdit(seat: banking.SeatSummary) {
    setEditingSeatId(seat.id);
    setError(null);
    try {
      const full = await client.banking.getSeat(seat.id);
      const cfg = full.twoFaConfig;
      setEditForm(
        cfg
          ? {
              ...EMPTY_2FA,
              method: cfg.method,
              smsProvider: cfg.smsProvider || "",
              phoneNumber: cfg.phoneNumber || "",
              forwardTo: cfg.forwardTo || [],
              notificationEmail: cfg.notificationEmail || "",
              hasApiKey: cfg.hasApiKey,
              hasApiSecret: cfg.hasApiSecret,
              apiKey: "",
              apiSecret: "",
            }
          : EMPTY_2FA,
      );
      setEditWebhookUrl(cfg?.webhookUrl ?? null);
    } catch {
      setEditForm(EMPTY_2FA);
      setEditWebhookUrl(null);
    }
  }

  async function saveEdit() {
    if (!editingSeatId) return;
    setSaving(true);
    setError(null);
    try {
      await client.banking.update2fa(editingSeatId, {
        method: editForm.method as "sms" | "app",
        smsProvider:
          (editForm.smsProvider as "twilio" | "plivo") || undefined,
        apiKey: editForm.apiKey || undefined,
        apiSecret: editForm.apiSecret || undefined,
        phoneNumber: editForm.phoneNumber || undefined,
        forwardTo: editForm.forwardTo?.length ? editForm.forwardTo : undefined,
        notificationEmail: editForm.notificationEmail || undefined,
      });
      setEditingSeatId(null);
      await fetchSeats();
    } catch (err: any) {
      setError(err.message || "Failed to save 2FA config");
    } finally {
      setSaving(false);
    }
  }

  function updateEditForm(field: string, value: string | string[]) {
    setEditForm((f) => ({ ...f, [field]: value }));
  }

  const totalPages = Math.ceil(logsTotal / PAGE_SIZE);
  const currentPage = Math.floor(logsOffset / PAGE_SIZE) + 1;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">SMS Providers</h1>
        <p className="text-sm text-default-500 mt-1">
          Manage SMS 2FA provider configurations and view webhook activity
        </p>
      </div>

      {error && (
        <div className="bg-danger-50 text-danger border border-danger-200 rounded-lg px-3 py-2 text-sm flex items-center justify-between">
          <span>{error}</span>
          <Button size="sm" variant="ghost" onPress={() => setError(null)}>
            ✕
          </Button>
        </div>
      )}

      {/* SMS Configurations */}
      <section>
        <h2 className="text-lg font-semibold mb-3">SMS Configurations</h2>

        {loadingSeats ? (
          <p className="text-default-400 text-sm">Loading...</p>
        ) : seats.length === 0 ? (
          <Card>
            <Card.Content>
              <p className="text-sm text-default-500 text-center py-4">
                No bank seats configured.{" "}
                <Link
                  to="/seats"
                  className="text-accent hover:underline"
                >
                  Create a seat
                </Link>{" "}
                to get started.
              </p>
            </Card.Content>
          </Card>
        ) : smsSeats.length === 0 ? (
          <Card>
            <Card.Content>
              <p className="text-sm text-default-500 text-center py-4">
                None of your bank seats have SMS 2FA configured.{" "}
                <Link
                  to="/seats"
                  className="text-accent hover:underline"
                >
                  Configure SMS 2FA on a seat
                </Link>{" "}
                to see it here.
              </p>
            </Card.Content>
          </Card>
        ) : (
          <div className="space-y-3">
            {smsSeats.map((seat) => {
              const isEditing = editingSeatId === seat.id;
              const summary = seat.twoFaSummary!;

              return (
                <Card key={seat.id}>
                  <Card.Header>
                    <div className="flex items-center gap-2 w-full">
                      <Chip size="sm" variant="soft" color="accent">
                        {BANK_LABELS[seat.bank] || seat.bank}
                      </Chip>
                      <span className="text-sm font-medium flex-1 truncate">
                        {seat.label || seat.username}
                      </span>
                      <Chip size="sm" variant="soft" color="default">
                        {(summary.smsProvider || "").charAt(0).toUpperCase() +
                          (summary.smsProvider || "").slice(1)}
                      </Chip>
                      {!isEditing && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onPress={() => startEdit(seat)}
                        >
                          Edit
                        </Button>
                      )}
                    </div>
                  </Card.Header>
                  <Card.Content>
                    {isEditing ? (
                      <div className="space-y-3">
                        <TwoFaConfigForm
                          value={editForm}
                          onChange={updateEditForm}
                          webhookUrl={editWebhookUrl}
                        />
                        <div className="flex gap-2 justify-end pt-1">
                          <Button
                            size="sm"
                            variant="tertiary"
                            onPress={() => setEditingSeatId(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onPress={saveEdit}
                            isPending={saving}
                          >
                            {({ isPending }) =>
                              isPending ? "Saving..." : "Save"
                            }
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-[100px_1fr] gap-x-4 gap-y-1 text-sm">
                          {summary.phoneNumber && (
                            <>
                              <span className="text-default-500">Phone</span>
                              <span>{summary.phoneNumber}</span>
                            </>
                          )}
                        </div>

                        {summary.webhookUrl && (
                          <WebhookUrlDisplay url={summary.webhookUrl} />
                        )}
                      </div>
                    )}
                  </Card.Content>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Webhook Log */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Webhook Log</h2>
          {smsSeats.length > 1 && (
            <div className="w-48">
              <Select
                selectedKey={logFilter}
                onSelectionChange={(key) => setLogFilter(key as string)}
                placeholder="All seats"
              >
                <Label className="sr-only">Filter by seat</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item id="" textValue="All seats">
                      All seats
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    {smsSeats.map((s) => (
                      <ListBox.Item
                        key={s.id}
                        id={s.id}
                        textValue={
                          s.label ||
                          `${BANK_LABELS[s.bank] || s.bank} - ${s.username}`
                        }
                      >
                        {s.label ||
                          `${BANK_LABELS[s.bank] || s.bank} - ${s.username}`}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>
          )}
        </div>

        {loadingLogs ? (
          <p className="text-default-400 text-sm">Loading logs...</p>
        ) : smsSeats.length === 0 ? (
          <Card>
            <Card.Content>
              <p className="text-sm text-default-500 text-center py-4">
                Configure SMS 2FA on a bank seat to start receiving webhooks.
              </p>
            </Card.Content>
          </Card>
        ) : logs.length === 0 ? (
          <Card>
            <Card.Content>
              <p className="text-sm text-default-500 text-center py-4">
                No webhooks received yet. Once your SMS provider is configured
                to send to the webhook URLs above, incoming messages will appear
                here.
              </p>
            </Card.Content>
          </Card>
        ) : (
          <>
            <div className="border border-default-200 rounded-lg overflow-hidden">
              <div className="grid grid-cols-[160px_1fr_1fr_80px] gap-2 px-4 py-2 bg-default-50 text-xs font-medium text-default-500">
                <span>Date/Time</span>
                <span>Seat</span>
                <span>From / Message</span>
                <span className="text-center">Code</span>
              </div>
              {logs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                return (
                  <div key={log.id}>
                    <button
                      type="button"
                      className="grid grid-cols-[160px_1fr_1fr_80px] gap-2 px-4 py-2 border-t border-default-100 text-sm w-full text-left hover:bg-default-50 transition-colors"
                      onClick={() =>
                        setExpandedLogId(isExpanded ? null : log.id)
                      }
                    >
                      <span className="text-default-500 tabular-nums text-xs">
                        {formatDateTime(log.receivedAt)}
                      </span>
                      <span className="truncate">
                        <span className="font-medium">
                          {BANK_LABELS[log.seatBank || ""] || log.seatBank}
                        </span>
                        {log.seatLabel && (
                          <span className="text-default-400 ml-1">
                            {log.seatLabel}
                          </span>
                        )}
                      </span>
                      <span className="truncate">
                        {log.fromNumber && (
                          <span className="text-default-500 mr-1.5">
                            {log.fromNumber}
                          </span>
                        )}
                        <span className="text-default-700">
                          {log.messageBody || "(empty)"}
                        </span>
                      </span>
                      <span className="text-center">
                        {log.extractedCode ? (
                          <Chip size="sm" variant="soft" color="success">
                            {log.extractedCode}
                          </Chip>
                        ) : (
                          <Chip size="sm" variant="soft" color="default">
                            —
                          </Chip>
                        )}
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="px-4 py-3 border-t border-default-100 bg-default-50">
                        <p className="text-xs font-medium text-default-500 mb-1">
                          Raw Webhook Body
                        </p>
                        <pre className="text-xs font-mono bg-default-100 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all max-h-48">
                          {log.rawBody}
                        </pre>
                        {log.contentType && (
                          <p className="text-xs text-default-400 mt-1.5">
                            Content-Type: {log.contentType}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-default-400">
                  Showing {logsOffset + 1}–
                  {Math.min(logsOffset + PAGE_SIZE, logsTotal)} of {logsTotal}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    isDisabled={logsOffset === 0}
                    onPress={() => fetchLogs(logsOffset - PAGE_SIZE)}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    isDisabled={logsOffset + PAGE_SIZE >= logsTotal}
                    onPress={() => fetchLogs(logsOffset + PAGE_SIZE)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function WebhookUrlDisplay({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <p className="text-xs font-medium text-default-500 mb-1">Webhook URL</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 bg-default-100 px-3 py-1.5 rounded-lg text-xs font-mono break-all select-all">
          {url}
        </code>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-default-100 hover:bg-default-200 transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}
