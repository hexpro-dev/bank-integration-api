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
  NumberField,
} from "@heroui/react";
import type { banking } from "~/lib/client";
import { client } from "~/lib/api";

const AVAILABLE_SCOPES = [
  { value: "read:accounts", label: "Read Accounts" },
  { value: "read:transactions", label: "Read Transactions" },
  { value: "read:balances", label: "Read Balances" },
  { value: "write:seats", label: "Write Seats" },
];

function formatDate(date: string | null): string {
  if (!date) return "Never";
  return new Date(date).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function TokensPage() {
  const [tokens, setTokens] = useState<banking.TokenSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>([]);
  const [expiresInDays, setExpiresInDays] = useState<number | undefined>(undefined);
  const [creating, setCreating] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const fetchTokens = useCallback(async () => {
    try {
      const res = await client.banking.listTokens();
      setTokens(res.tokens);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await client.banking.createToken({
        name: name.trim(),
        scopes: scopes.length > 0 ? scopes : undefined,
        expiresInDays: expiresInDays || undefined,
      });
      setNewToken(res.token);
      setName("");
      setScopes([]);
      setExpiresInDays(undefined);
      setIsModalOpen(false);
      fetchTokens();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    setRevoking(id);
    try {
      await client.banking.deleteToken(id);
      setTokens((prev) => prev.filter((t) => t.id !== id));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRevoking(null);
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
          <h1 className="text-2xl font-bold">API Tokens</h1>
          <p className="text-sm text-default-500 mt-1">
            Manage API tokens for programmatic access
          </p>
        </div>
        <Modal isOpen={isModalOpen} onOpenChange={setIsModalOpen}>
          <Button>Generate Token</Button>
          <Modal.Backdrop>
            <Modal.Container>
              <Modal.Dialog className="sm:max-w-[480px]">
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading>Generate API Token</Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <div className="space-y-4">
                    <TextField name="token-name" onChange={setName}>
                      <Label>Token Name</Label>
                      <Input placeholder="e.g. Production API" value={name} />
                    </TextField>

                    <CheckboxGroup
                      value={scopes}
                      onChange={setScopes}
                    >
                      <Label>Scopes (optional)</Label>
                      {AVAILABLE_SCOPES.map((scope) => (
                        <Checkbox key={scope.value} value={scope.value}>
                          <Checkbox.Control>
                            <Checkbox.Indicator />
                          </Checkbox.Control>
                          <Checkbox.Content>
                            <Label>{scope.label}</Label>
                          </Checkbox.Content>
                        </Checkbox>
                      ))}
                    </CheckboxGroup>

                    <NumberField
                      minValue={1}
                      maxValue={365}
                      value={expiresInDays}
                      onChange={(v) => setExpiresInDays(v)}
                    >
                      <Label>Expiry (days, optional)</Label>
                      <NumberField.Group>
                        <NumberField.DecrementButton />
                        <NumberField.Input placeholder="No expiry" />
                        <NumberField.IncrementButton />
                      </NumberField.Group>
                    </NumberField>
                  </div>
                </Modal.Body>
                <Modal.Footer className="flex gap-2 justify-end">
                  <Button variant="ghost" slot="close">
                    Cancel
                  </Button>
                  <Button
                    isDisabled={!name.trim() || creating}
                    onPress={handleCreate}
                  >
                    {creating ? "Generating..." : "Generate"}
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

      {newToken && (
        <Card variant="secondary" className="border-warning">
          <Card.Header>
            <Card.Title className="text-warning">Token Created</Card.Title>
            <Card.Description>
              Copy this token now. It will not be shown again.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-default-100 px-3 py-2 rounded-lg text-sm font-mono break-all">
                {newToken}
              </code>
              <Button
                size="sm"
                variant="secondary"
                onPress={() => copyToClipboard(newToken)}
              >
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
          </Card.Content>
          <Card.Footer>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => setNewToken(null)}
            >
              Dismiss
            </Button>
          </Card.Footer>
        </Card>
      )}

      {loading ? (
        <p className="text-default-500 text-sm">Loading tokens...</p>
      ) : tokens.length === 0 ? (
        <Card>
          <Card.Content>
            <p className="text-default-500 text-sm text-center py-4">
              No API tokens yet. Generate one to get started.
            </p>
          </Card.Content>
        </Card>
      ) : (
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="API tokens">
              <Table.Header>
                <Table.Column isRowHeader>Name</Table.Column>
                <Table.Column>Scopes</Table.Column>
                <Table.Column>Last Used</Table.Column>
                <Table.Column>Expires</Table.Column>
                <Table.Column>Status</Table.Column>
                <Table.Column>Actions</Table.Column>
              </Table.Header>
              <Table.Body>
                {tokens.map((token) => (
                  <Table.Row key={token.id}>
                    <Table.Cell>
                      <span className="font-medium">{token.name}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-wrap gap-1">
                        {token.scopes.length > 0 ? (
                          token.scopes.map((s) => (
                            <Chip key={s} size="sm">
                              {s}
                            </Chip>
                          ))
                        ) : (
                          <span className="text-default-400 text-xs">All</span>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm text-default-500">
                        {formatDate(token.lastUsedAt)}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm text-default-500">
                        {token.expiresAt ? formatDate(token.expiresAt) : "Never"}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <Chip
                        size="sm"
                        color={token.isActive ? "success" : "danger"}
                        variant="soft"
                      >
                        {token.isActive ? "Active" : "Revoked"}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell>
                      {token.isActive && (
                        <Button
                          size="sm"
                          variant="danger"
                          isDisabled={revoking === token.id}
                          onPress={() => handleRevoke(token.id)}
                        >
                          {revoking === token.id ? "Revoking..." : "Revoke"}
                        </Button>
                      )}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      )}
    </div>
  );
}
