import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Card, Button, TextField, Label, Input, Description, Spinner } from "@heroui/react";
import { useAuth } from "~/lib/auth";
import { isAuthenticated } from "~/lib/api";

export default function LoginPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [isFirstUser, setIsFirstUser] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      navigate("/");
    }
  }, []);

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      await auth.login(email, password);
      navigate("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setError("");
    setLoading(true);
    try {
      await auth.register({
        email,
        password,
        name,
        inviteToken: inviteToken || undefined,
      });
      navigate("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-default-50">
      <Card className="w-full max-w-md">
        <Card.Header className="flex flex-col items-center pt-6 pb-2">
          <Card.Title className="text-2xl">Self-hosted Bank Integration API</Card.Title>
          <Card.Description>
            {isRegister ? "Create your account" : "Sign in to your dashboard"}
          </Card.Description>
        </Card.Header>
        <Card.Content className="space-y-4 px-6">
          {error && (
            <div className="bg-danger-50 text-danger border border-danger-200 rounded-lg px-3 py-2 text-sm">
              {error}
            </div>
          )}
          {isRegister && (
            <TextField isRequired name="name" onChange={setName}>
              <Label>Name</Label>
              <Input value={name} placeholder="Your name" />
            </TextField>
          )}
          <TextField isRequired name="email" type="email" onChange={setEmail}>
            <Label>Email</Label>
            <Input value={email} placeholder="email@example.com" />
          </TextField>
          <TextField isRequired name="password" type="password" onChange={setPassword}>
            <Label>Password</Label>
            <Input value={password} placeholder="••••••••" />
          </TextField>
          {isRegister && !isFirstUser && (
            <TextField name="inviteToken" onChange={setInviteToken}>
              <Label>Invite Token</Label>
              <Input value={inviteToken} placeholder="Enter invite token" />
              <Description>Required unless you're the first user</Description>
            </TextField>
          )}
        </Card.Content>
        <Card.Footer className="flex flex-col gap-3 px-6 pb-6">
          <Button
            fullWidth
            isPending={loading}
            onPress={isRegister ? handleRegister : handleLogin}
          >
            {({ isPending }) => (
              <>
                {isPending && <Spinner color="current" size="sm" />}
                {isRegister ? "Create Account" : "Sign In"}
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            fullWidth
            onPress={() => {
              setIsRegister(!isRegister);
              setError("");
            }}
          >
            {isRegister
              ? "Already have an account? Sign in"
              : "Need an account? Register"}
          </Button>
        </Card.Footer>
      </Card>
    </div>
  );
}
