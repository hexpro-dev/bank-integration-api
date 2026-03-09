import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router";
import { Button, Card, Chip, Input, Label, ListBox, Modal, Select, TextField } from "@heroui/react";
import type { banking } from "~/lib/client";
import { client } from "~/lib/api";
import TwoFaConfigForm, { EMPTY_2FA, type TwoFaFormState } from "~/components/TwoFaConfigForm";

const BANKS = [
  { id: "anz", label: "ANZ" },
  { id: "commbank", label: "CommBank" },
  { id: "nab", label: "NAB" },
  { id: "westpac", label: "Westpac" },
];

const BANK_LABELS: Record<string, string> = Object.fromEntries(
  BANKS.map((b) => [b.id, b.label]),
);

const EMPTY_FORM = { bank: "", username: "", password: "", label: "" };

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function SeatsPage() {
  const [seats, setSeats] = useState<banking.SeatSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [showTwoFa, setShowTwoFa] = useState(false);
  const [twoFa, setTwoFa] = useState<TwoFaFormState>(EMPTY_2FA);
  const [editWebhookUrl, setEditWebhookUrl] = useState<string | null>(null);

  const [showScopes, setShowScopes] = useState(false);
  const [scopes, setScopes] = useState<banking.ScopeItem[]>([]);
  const [newScopeId, setNewScopeId] = useState("");
  const [newScopeType, setNewScopeType] = useState<"name" | "number">("name");

  const [deleteTarget, setDeleteTarget] = useState<banking.SeatSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchSeats = useCallback(async () => {
    try {
      setLoading(true);
      const data = await client.banking.listSeats();
      setSeats(data.seats);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load seats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSeats();
  }, [fetchSeats]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setTwoFa(EMPTY_2FA);
    setEditWebhookUrl(null);
    setScopes([]);
    setShowTwoFa(false);
    setShowScopes(false);
    setModalOpen(true);
  };

  const openEdit = async (seat: banking.SeatSummary) => {
    setEditingId(seat.id);
    setForm({ bank: seat.bank, username: seat.username, password: "", label: seat.label || "" });
    setShowTwoFa(false);
    setShowScopes(false);
    try {
      const full = await client.banking.getSeat(seat.id);
      setForm({ bank: full.bank, username: full.username, password: "", label: full.label || "" });
      const cfg = full.twoFaConfig;
      setTwoFa(cfg ? {
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
      } : EMPTY_2FA);
      setEditWebhookUrl(cfg?.webhookUrl ?? null);
      if (cfg) setShowTwoFa(true);
      setScopes((full.scopes || []).map((s) => ({
        identifier: s.identifier,
        type: s.type as "name" | "number",
      })));
      if (full.scopes && full.scopes.length > 0) setShowScopes(true);
    } catch {
      setTwoFa(EMPTY_2FA);
      setScopes([]);
    }
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.bank || !form.username || (!editingId && !form.password)) return;
    setSaving(true);
    setError(null);
    try {
      let seatId = editingId;
      if (editingId) {
        const body: banking.UpdateSeatRequest = {
          bank: form.bank,
          username: form.username,
          label: form.label,
        };
        if (form.password) body.password = form.password;
        await client.banking.updateSeat(editingId, body);
      } else {
        const created = await client.banking.createSeat({
          bank: form.bank as banking.CreateSeatRequest["bank"],
          username: form.username,
          password: form.password,
          label: form.label || undefined,
        });
        seatId = created.seat.id;
      }
      if (showTwoFa && seatId) {
        await client.banking.update2fa(seatId, {
          method: twoFa.method as "sms" | "app",
          smsProvider: (twoFa.smsProvider as "twilio" | "plivo") || undefined,
          apiKey: twoFa.apiKey || undefined,
          apiSecret: twoFa.apiSecret || undefined,
          phoneNumber: twoFa.phoneNumber || undefined,
          forwardTo: twoFa.forwardTo?.length ? twoFa.forwardTo : undefined,
          notificationEmail: twoFa.notificationEmail || undefined,
        });
      }
      if (showScopes && seatId) {
        await client.banking.updateScopes(seatId, { scopes });
      }
      setModalOpen(false);
      await fetchSeats();
    } catch (err: any) {
      setError(err.message || "Failed to save seat");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await client.banking.deleteSeat(deleteTarget.id);
      setDeleteTarget(null);
      await fetchSeats();
    } catch (err: any) {
      setError(err.message || "Failed to delete seat");
    } finally {
      setDeleting(false);
    }
  };

  const addScope = () => {
    if (!newScopeId.trim()) return;
    setScopes((prev) => [...prev, { identifier: newScopeId.trim(), type: newScopeType }]);
    setNewScopeId("");
  };

  const removeScope = (idx: number) => {
    setScopes((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateForm = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const updateTwoFa = (field: string, value: string | string[]) =>
    setTwoFa((f) => ({ ...f, [field]: value }));

  const buildSelect = (
    labelText: string,
    value: string,
    onChange: (key: string) => void,
    items: { id: string; label: string }[],
  ) => (
    <Select
      placeholder={`Select ${labelText.toLowerCase()}`}
      selectedKey={value}
      onSelectionChange={(key) => onChange(key as string)}
    >
      <Label>{labelText}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {items.map((item) => (
            <ListBox.Item key={item.id} id={item.id} textValue={item.label}>
              {item.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Bank Seats</h2>
        <Button variant="secondary" size="sm" onPress={openCreate}>
          Add Seat
        </Button>
      </div>

      {error && (
        <div className="bg-danger-50 text-danger border border-danger-200 rounded-lg px-3 py-2 mb-3 text-sm flex items-center justify-between">
          <span>{error}</span>
          <Button size="sm" variant="ghost" onPress={() => setError(null)}>
            ✕
          </Button>
        </div>
      )}

      {loading ? (
        <p className="text-default-400 text-sm py-8 text-center">Loading seats…</p>
      ) : seats.length === 0 ? (
        <Card>
          <Card.Content>
            <div className="text-center py-6 text-default-500">
              <p className="mb-2">No seats configured yet.</p>
              <Button variant="secondary" size="sm" onPress={openCreate}>
                Add Your First Seat
              </Button>
            </div>
          </Card.Content>
        </Card>

      ) : (
        <div className="border border-default-200 rounded-lg divide-y divide-default-100 overflow-hidden">
          {seats.map((seat) => (
            <div
              key={seat.id}
              className="flex items-center justify-between px-4 py-2.5 gap-3 flex-wrap hover:bg-default-50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Chip size="sm" variant="soft" color="accent">
                  {BANK_LABELS[seat.bank] || seat.bank}
                </Chip>
                <div className="min-w-0">
                  <Link
                    to={`/seats/${seat.id}`}
                    className="text-sm font-medium hover:underline truncate block"
                  >
                    {seat.label || seat.username}
                  </Link>
                  {seat.label && (
                    <p className="text-xs text-default-400 truncate">{seat.username}</p>
                  )}
                </div>
                <Chip
                  size="sm"
                  variant="soft"
                  color={seat.isActive ? "success" : "default"}
                >
                  {seat.isActive ? "Active" : "Inactive"}
                </Chip>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-default-400 hidden sm:inline">
                  {formatDate(seat.createdAt)}
                </span>
                <Button size="sm" variant="ghost" onPress={() => openEdit(seat)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onPress={() => setDeleteTarget(seat)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal>
        <Modal.Backdrop isOpen={modalOpen} onOpenChange={setModalOpen}>
          <Modal.Container size="md" scroll="inside">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{editingId ? "Edit Seat" : "Add Seat"}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <div className="space-y-4">
                  {buildSelect("Bank", form.bank, (key) => updateForm("bank", key), BANKS)}

                  <TextField fullWidth onChange={(v) => updateForm("label", v)}>
                    <Label>Label <span className="text-default-400 font-normal">(optional)</span></Label>
                    <Input value={form.label} placeholder="e.g. My ANZ Everyday" />
                  </TextField>

                  <TextField fullWidth onChange={(v) => updateForm("username", v)}>
                    <Label>Username</Label>
                    <Input value={form.username} placeholder="Bank login username" />
                  </TextField>

                  <TextField fullWidth type="password" onChange={(v) => updateForm("password", v)}>
                    <Label>Password</Label>
                    <Input value={form.password} placeholder={editingId ? "Leave blank to keep current" : "Bank login password"} />
                  </TextField>

                  {/* 2FA Section */}
                  <div className="border-t border-default-200 pt-3">
                    <button
                      type="button"
                      className="flex items-center gap-2 text-sm font-medium text-default-700 hover:text-default-900 w-full text-left"
                      onClick={() => setShowTwoFa(!showTwoFa)}
                    >
                      <span
                        className={`text-xs transition-transform ${showTwoFa ? "rotate-90" : ""}`}
                      >
                        ▶
                      </span>
                      2FA Configuration
                    </button>
                    {showTwoFa && (
                      <div className="mt-3 pl-5">
                        <TwoFaConfigForm
                          value={twoFa}
                          onChange={updateTwoFa}
                          webhookUrl={editWebhookUrl}
                        />
                      </div>
                    )}
                  </div>

                  {/* Scopes Section */}
                  <div className="border-t border-default-200 pt-3">
                    <button
                      type="button"
                      className="flex items-center gap-2 text-sm font-medium text-default-700 hover:text-default-900 w-full text-left"
                      onClick={() => setShowScopes(!showScopes)}
                    >
                      <span
                        className={`text-xs transition-transform ${showScopes ? "rotate-90" : ""}`}
                      >
                        ▶
                      </span>
                      Account Scopes
                      {scopes.length > 0 && (
                        <Chip size="sm" variant="soft">
                          {scopes.length}
                        </Chip>
                      )}
                    </button>
                    {showScopes && (
                      <div className="mt-3">
                        {scopes.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {scopes.map((scope, idx) => (
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
                        <div className="flex gap-2 items-end">
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
                        {scopes.length === 0 && (
                          <p className="text-xs text-default-400 mt-2">
                            No scopes — all accounts will be observed.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="tertiary" onPress={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onPress={handleSave}
                  isPending={saving}
                >
                  {({ isPending }) => (
                    isPending ? "Saving…" : (editingId ? "Save Changes" : "Create Seat")
                  )}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Delete Confirmation */}
      <Modal>
        <Modal.Backdrop isOpen={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Delete Seat</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-sm">
                  Are you sure you want to delete the{" "}
                  <strong>
                    {BANK_LABELS[deleteTarget?.bank || ""] || deleteTarget?.bank}
                  </strong>{" "}
                  seat for <strong>{deleteTarget?.username}</strong>? This cannot be
                  undone.
                </p>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="tertiary" onPress={() => setDeleteTarget(null)}>
                  Cancel
                </Button>
                <Button variant="danger" onPress={handleDelete} isPending={deleting}>
                  {({ isPending }) => (isPending ? "Deleting…" : "Delete")}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
