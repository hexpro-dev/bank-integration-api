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
} from "@heroui/react";
import { useAuth } from "~/lib/auth";
import type { users } from "~/lib/client";
import { client } from "~/lib/api";

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function UsersPage() {
  const { isAdmin } = useAuth();
  const [userList, setUserList] = useState<users.UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await client.users.listUsers();
      setUserList(res.users);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchUsers();
    else setLoading(false);
  }, [isAdmin, fetchUsers]);

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setError("");
    try {
      const res = await client.users.invite({
        email: inviteEmail.trim(),
      });
      setInviteToken(res.inviteToken);
      setInviteEmail("");
      setIsModalOpen(false);
      fetchUsers();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setInviting(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!isAdmin) {
    return (
      <div className="max-w-3xl">
        <Card variant="secondary" className="border-warning">
          <Card.Header>
            <Card.Title className="text-warning">Access Restricted</Card.Title>
            <Card.Description>
              User management is only available to administrators.
            </Card.Description>
          </Card.Header>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm text-default-500 mt-1">
            Manage user accounts and invite new users
          </p>
        </div>
        <Modal isOpen={isModalOpen} onOpenChange={setIsModalOpen}>
          <Button>Invite User</Button>
          <Modal.Backdrop>
            <Modal.Container>
              <Modal.Dialog className="sm:max-w-[420px]">
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading>Invite User</Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <TextField name="invite-email" onChange={setInviteEmail}>
                    <Label>Email Address</Label>
                    <Input
                      placeholder="user@example.com"
                      value={inviteEmail}
                      type="email"
                    />
                  </TextField>
                </Modal.Body>
                <Modal.Footer className="flex gap-2 justify-end">
                  <Button variant="ghost" slot="close">
                    Cancel
                  </Button>
                  <Button
                    isDisabled={!inviteEmail.trim() || inviting}
                    onPress={handleInvite}
                  >
                    {inviting ? "Inviting..." : "Send Invite"}
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

      {inviteToken && (
        <Card variant="secondary" className="border-warning">
          <Card.Header>
            <Card.Title className="text-warning">Invite Created</Card.Title>
            <Card.Description>
              Share this invite token with the user. They will use it to
              register their account.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-default-100 px-3 py-2 rounded-lg text-sm font-mono break-all">
                {inviteToken}
              </code>
              <Button
                size="sm"
                variant="secondary"
                onPress={() => copyToClipboard(inviteToken)}
              >
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
          </Card.Content>
          <Card.Footer>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => setInviteToken(null)}
            >
              Dismiss
            </Button>
          </Card.Footer>
        </Card>
      )}

      {loading ? (
        <p className="text-default-500 text-sm">Loading users...</p>
      ) : userList.length === 0 ? (
        <Card>
          <Card.Content>
            <p className="text-default-500 text-sm text-center py-4">
              No users found.
            </p>
          </Card.Content>
        </Card>
      ) : (
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Users">
              <Table.Header>
                <Table.Column isRowHeader>Name</Table.Column>
                <Table.Column>Email</Table.Column>
                <Table.Column>Role</Table.Column>
                <Table.Column>Joined</Table.Column>
              </Table.Header>
              <Table.Body>
                {userList.map((u) => (
                  <Table.Row key={u.id}>
                    <Table.Cell>
                      <span className="font-medium">{u.name}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm text-default-600">
                        {u.email}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <Chip
                        size="sm"
                        color={u.role === "admin" ? "accent" : "default"}
                        variant="soft"
                      >
                        {u.role}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm text-default-500">
                        {formatDate(u.createdAt)}
                      </span>
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
