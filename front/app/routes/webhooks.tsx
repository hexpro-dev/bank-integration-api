import { useState, useEffect, useCallback } from "react";
import {
  Button,
  Card,
  Table,
  Modal,
  Chip,
  TextField,
  Input,
  Label,
  Checkbox,
  CheckboxGroup,
  Switch,
} from "@heroui/react";
import type { banking } from "~/lib/client";
import { client } from "~/lib/api";

const AVAILABLE_EVENTS = [
  { value: "balance_updated", label: "Balance Updated" },
  { value: "transactions_updated", label: "Transactions Updated" },
  { value: "session_updated", label: "Session Updated" },
  { value: "accounts_discovered", label: "Accounts Discovered" },
];

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<banking.WebhookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [editEvents, setEditEvents] = useState<string[]>([]);
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchWebhooks = useCallback(async () => {
    try {
      const res = await client.banking.listWebhooks();
      setWebhooks(res.webhooks);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  async function handleCreate() {
    if (!url.trim() || events.length === 0) return;
    setCreating(true);
    setError("");
    try {
      const res = await client.banking.createWebhook({
        url: url.trim(),
        events,
      });
      setNewSecret(res.secret);
      setUrl("");
      setEvents([]);
      setIsModalOpen(false);
      fetchWebhooks();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  function startEdit(webhook: banking.WebhookItem) {
    setEditingId(webhook.id);
    setEditUrl(webhook.url);
    setEditEvents(webhook.events);
    setEditActive(webhook.isActive);
  }

  async function handleUpdate() {
    if (!editingId || !editUrl.trim() || editEvents.length === 0) return;
    setSaving(true);
    setError("");
    try {
      const res = await client.banking.updateWebhook(editingId, {
        url: editUrl.trim(),
        events: editEvents,
        isActive: editActive,
      });
      setWebhooks((prev) =>
        prev.map((w) => (w.id === editingId ? res.webhook : w))
      );
      setEditingId(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await client.banking.deleteWebhook(id);
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeleting(null);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Webhooks</h1>
          <p className="text-sm text-default-500 mt-1">
            Receive real-time notifications when data changes
          </p>
        </div>
        <Modal isOpen={isModalOpen} onOpenChange={setIsModalOpen}>
          <Button>Add Webhook</Button>
          <Modal.Backdrop>
            <Modal.Container>
              <Modal.Dialog className="sm:max-w-[480px]">
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading>Add Webhook</Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <div className="space-y-4">
                    <TextField name="webhook-url" onChange={setUrl}>
                      <Label>Endpoint URL</Label>
                      <Input
                        placeholder="https://example.com/webhook"
                        value={url}
                        type="url"
                      />
                    </TextField>

                    <CheckboxGroup value={events} onChange={setEvents}>
                      <Label>Events</Label>
                      {AVAILABLE_EVENTS.map((event) => (
                        <Checkbox key={event.value} value={event.value}>
                          <Checkbox.Control>
                            <Checkbox.Indicator />
                          </Checkbox.Control>
                          <Checkbox.Content>
                            <Label>{event.label}</Label>
                          </Checkbox.Content>
                        </Checkbox>
                      ))}
                    </CheckboxGroup>
                  </div>
                </Modal.Body>
                <Modal.Footer className="flex gap-2 justify-end">
                  <Button variant="ghost" slot="close">
                    Cancel
                  </Button>
                  <Button
                    isDisabled={!url.trim() || events.length === 0 || creating}
                    onPress={handleCreate}
                  >
                    {creating ? "Creating..." : "Create"}
                  </Button>
                </Modal.Footer>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      </div>

      {error && (
        <Card variant="secondary" className="border-danger">
          <Card.Content>
            <p className="text-danger text-sm">{error}</p>
          </Card.Content>
        </Card>
      )}

      {newSecret && (
        <Card variant="secondary" className="border-warning">
          <Card.Header>
            <Card.Title className="text-warning">Webhook Secret</Card.Title>
            <Card.Description>
              Copy this secret now. It will not be shown again. Use it to verify
              webhook signatures.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-default-100 px-3 py-2 rounded-lg text-sm font-mono break-all">
                {newSecret}
              </code>
              <Button
                size="sm"
                variant="secondary"
                onPress={() => copyToClipboard(newSecret)}
              >
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
          </Card.Content>
          <Card.Footer>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => setNewSecret(null)}
            >
              Dismiss
            </Button>
          </Card.Footer>
        </Card>
      )}

      {loading ? (
        <p className="text-default-500 text-sm">Loading webhooks...</p>
      ) : webhooks.length === 0 ? (
        <Card>
          <Card.Content>
            <p className="text-default-500 text-sm text-center py-4">
              No webhooks configured. Add one to receive event notifications.
            </p>
          </Card.Content>
        </Card>
      ) : (
        <div className="space-y-3">
          {webhooks.map((webhook) => (
            <Card key={webhook.id}>
              {editingId === webhook.id ? (
                <>
                  <Card.Content>
                    <div className="space-y-4">
                      <TextField
                        name="edit-webhook-url"
                        onChange={setEditUrl}
                      >
                        <Label>Endpoint URL</Label>
                        <Input value={editUrl} type="url" />
                      </TextField>

                      <CheckboxGroup
                        value={editEvents}
                        onChange={setEditEvents}
                      >
                        <Label>Events</Label>
                        {AVAILABLE_EVENTS.map((event) => (
                          <Checkbox key={event.value} value={event.value}>
                            <Checkbox.Control>
                              <Checkbox.Indicator />
                            </Checkbox.Control>
                            <Checkbox.Content>
                              <Label>{event.label}</Label>
                            </Checkbox.Content>
                          </Checkbox>
                        ))}
                      </CheckboxGroup>

                      <Switch
                        isSelected={editActive}
                        onChange={setEditActive}
                      >
                        <Switch.Control>
                          <Switch.Thumb />
                        </Switch.Control>
                        <Switch.Content>
                          <Label className="text-sm">Active</Label>
                        </Switch.Content>
                      </Switch>
                    </div>
                  </Card.Content>
                  <Card.Footer className="flex gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onPress={() => setEditingId(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      isDisabled={saving}
                      onPress={handleUpdate}
                    >
                      {saving ? "Saving..." : "Save"}
                    </Button>
                  </Card.Footer>
                </>
              ) : (
                <>
                  <Card.Header>
                    <div className="flex items-center gap-2 w-full">
                      <Card.Title className="flex-1 font-mono text-sm break-all">
                        {webhook.url}
                      </Card.Title>
                      <Chip
                        size="sm"
                        color={webhook.isActive ? "success" : "danger"}
                        variant="soft"
                      >
                        {webhook.isActive ? "Active" : "Inactive"}
                      </Chip>
                    </div>
                  </Card.Header>
                  <Card.Content>
                    <div className="flex flex-wrap gap-1">
                      {webhook.events.map((event) => (
                        <Chip key={event} size="sm" variant="secondary">
                          {event}
                        </Chip>
                      ))}
                    </div>
                  </Card.Content>
                  <Card.Footer className="flex gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onPress={() => startEdit(webhook)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      isDisabled={deleting === webhook.id}
                      onPress={() => handleDelete(webhook.id)}
                    >
                      {deleting === webhook.id ? "Deleting..." : "Delete"}
                    </Button>
                  </Card.Footer>
                </>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
