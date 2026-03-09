import { Card } from "@heroui/react";

interface Endpoint {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  description: string;
  body?: string;
  response?: string;
}

const METHOD_COLORS: Record<string, string> = {
  GET: "text-green-600 bg-green-50",
  POST: "text-blue-600 bg-blue-50",
  PUT: "text-amber-600 bg-amber-50",
  DELETE: "text-red-600 bg-red-50",
};

function MethodBadge({ method }: { method: string }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-bold font-mono ${METHOD_COLORS[method] || ""}`}
    >
      {method}
    </span>
  );
}

function EndpointRow({ endpoint }: { endpoint: Endpoint }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-default-100 last:border-0">
      <MethodBadge method={endpoint.method} />
      <div className="flex-1 min-w-0">
        <code className="text-sm font-mono font-medium">{endpoint.path}</code>
        <p className="text-xs text-default-500 mt-0.5">
          {endpoint.description}
        </p>
        {endpoint.body && (
          <pre className="text-xs bg-default-50 rounded p-2 mt-1 overflow-x-auto">
            {endpoint.body}
          </pre>
        )}
        {endpoint.response && (
          <pre className="text-xs bg-default-50 rounded p-2 mt-1 overflow-x-auto">
            {endpoint.response}
          </pre>
        )}
      </div>
    </div>
  );
}

function EndpointSection({
  title,
  endpoints,
}: {
  title: string;
  endpoints: Endpoint[];
}) {
  return (
    <Card>
      <Card.Header>
        <Card.Title>{title}</Card.Title>
      </Card.Header>
      <Card.Content>
        <div className="divide-y divide-default-100">
          {endpoints.map((ep, i) => (
            <EndpointRow key={`${ep.method}-${ep.path}-${i}`} endpoint={ep} />
          ))}
        </div>
      </Card.Content>
    </Card>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-default-50 rounded-lg p-3 text-sm font-mono overflow-x-auto whitespace-pre">
      {children}
    </pre>
  );
}

const AUTH_ENDPOINTS: Endpoint[] = [
  {
    method: "POST",
    path: "/auth/register",
    description: "Register a new account (first user becomes admin)",
    body: '{ "name": "...", "email": "...", "password": "..." }',
  },
  {
    method: "POST",
    path: "/auth/login",
    description: "Authenticate and receive a JWT token",
    body: '{ "email": "...", "password": "..." }',
    response: '{ "token": "eyJ...", "user": { ... } }',
  },
  {
    method: "GET",
    path: "/auth/profile",
    description: "Get the authenticated user's profile",
  },
  {
    method: "PUT",
    path: "/auth/password",
    description: "Update password",
    body: '{ "currentPassword": "...", "newPassword": "..." }',
  },
  {
    method: "POST",
    path: "/auth/invite",
    description: "Invite a new user (admin only)",
    body: '{ "email": "...", "role": "user" }',
    response: '{ "inviteToken": "..." }',
  },
];

const SEAT_ENDPOINTS: Endpoint[] = [
  {
    method: "POST",
    path: "/v1/seats",
    description: "Create a new bank seat",
    body: '{ "bank": "anz|commbank|nab|westpac", "username": "...", "password": "..." }',
  },
  {
    method: "GET",
    path: "/v1/seats",
    description: "List all configured seats",
  },
  {
    method: "GET",
    path: "/v1/seats/:id",
    description: "Get a specific seat's details",
  },
  {
    method: "PUT",
    path: "/v1/seats/:id",
    description: "Update seat credentials or configuration",
  },
  {
    method: "DELETE",
    path: "/v1/seats/:id",
    description: "Remove a seat",
  },
  {
    method: "PUT",
    path: "/v1/seats/:id/2fa",
    description: "Configure 2FA handling for a seat",
    body: '{ "method": "sms|app", "smsProvider": "twilio|plivo", "apiKey": "...", "phoneNumber": "...", "forwardTo": "..." }',
  },
  {
    method: "PUT",
    path: "/v1/seats/:id/scopes",
    description: "Set which accounts to observe",
    body: '{ "accounts": ["account_name_or_number", ...] }',
  },
];

const ACCOUNT_ENDPOINTS: Endpoint[] = [
  {
    method: "GET",
    path: "/v1/seats/:seatId/accounts",
    description: "List all accounts discovered for a seat",
  },
  {
    method: "GET",
    path: "/v1/accounts/:id/balances",
    description: "Get account balance history",
    response: '{ "current": 1234.56, "available": 1200.00, "history": [...] }',
  },
  {
    method: "GET",
    path: "/v1/accounts/:id/transactions",
    description: "Get recent transactions for an account",
    response: '{ "transactions": [{ "date": "...", "description": "...", "amount": -50.00, ... }] }',
  },
  {
    method: "POST",
    path: "/v1/accounts/:id/refresh",
    description: "Trigger a live refresh of account data from the observer",
  },
];

const TOKEN_ENDPOINTS: Endpoint[] = [
  {
    method: "POST",
    path: "/v1/tokens",
    description: "Generate a new API token",
    body: '{ "name": "...", "scopes": ["read:accounts", ...], "expiryDays": 90 }',
  },
  {
    method: "GET",
    path: "/v1/tokens",
    description: "List all API tokens",
  },
  {
    method: "DELETE",
    path: "/v1/tokens/:id",
    description: "Revoke an API token",
  },
];

const WEBHOOK_ENDPOINTS: Endpoint[] = [
  {
    method: "POST",
    path: "/v1/webhooks",
    description: "Register a new webhook endpoint",
    body: '{ "url": "https://...", "events": ["balance_updated", ...] }',
  },
  {
    method: "GET",
    path: "/v1/webhooks",
    description: "List all webhooks",
  },
  {
    method: "PUT",
    path: "/v1/webhooks/:id",
    description: "Update a webhook's URL, events, or active status",
  },
  {
    method: "DELETE",
    path: "/v1/webhooks/:id",
    description: "Delete a webhook",
  },
];

const TRANSACTION_ENDPOINTS: Endpoint[] = [
  {
    method: "GET",
    path: "/v1/transactions/recent",
    description:
      "Get recent transactions across all observed accounts, sorted by date",
    response:
      '{ "transactions": [{ "accountId": "...", "date": "...", "description": "...", "amount": -25.00 }] }',
  },
];

export default function ApiDocsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">API Documentation</h1>
        <p className="text-sm text-default-500 mt-1">
          Reference for the Bank API endpoints
        </p>
      </div>

      <Card>
        <Card.Header>
          <Card.Title>Authentication</Card.Title>
          <Card.Description>
            All API requests require authentication via one of two methods
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-1">Bearer JWT</h3>
              <p className="text-xs text-default-500 mb-2">
                Obtained via <code className="text-xs">/auth/login</code>. Best
                for frontend/session-based use.
              </p>
              <CodeBlock>
                {`curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \\
  https://your-api.com/v1/seats`}
              </CodeBlock>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-1">API Key</h3>
              <p className="text-xs text-default-500 mb-2">
                Generated from the Tokens page. Best for server-to-server
                integrations. Scoped permissions available.
              </p>
              <CodeBlock>
                {`curl -H "Authorization: ApiKey bapi_abc123def456..." \\
  https://your-api.com/v1/accounts/123/balances`}
              </CodeBlock>
            </div>
          </div>
        </Card.Content>
      </Card>

      <EndpointSection title="Auth" endpoints={AUTH_ENDPOINTS} />
      <EndpointSection title="Seats" endpoints={SEAT_ENDPOINTS} />
      <EndpointSection title="Accounts" endpoints={ACCOUNT_ENDPOINTS} />
      <EndpointSection title="Tokens" endpoints={TOKEN_ENDPOINTS} />
      <EndpointSection title="Webhooks" endpoints={WEBHOOK_ENDPOINTS} />
      <EndpointSection title="Transactions" endpoints={TRANSACTION_ENDPOINTS} />

      <Card>
        <Card.Header>
          <Card.Title>Example: Fetch Account Balances</Card.Title>
        </Card.Header>
        <Card.Content>
          <CodeBlock>
            {`# List your seats
curl -H "Authorization: ApiKey bapi_abc123..." \\
  https://your-api.com/v1/seats

# Get accounts for a seat
curl -H "Authorization: ApiKey bapi_abc123..." \\
  https://your-api.com/v1/seats/seat_xyz/accounts

# Get balance for an account
curl -H "Authorization: ApiKey bapi_abc123..." \\
  https://your-api.com/v1/accounts/acc_456/balances

# Trigger a live refresh
curl -X POST -H "Authorization: ApiKey bapi_abc123..." \\
  https://your-api.com/v1/accounts/acc_456/refresh`}
          </CodeBlock>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>Webhook Payloads</Card.Title>
          <Card.Description>
            Webhooks are sent as POST requests with a JSON body and a signature
            header
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-1">Headers</h3>
              <CodeBlock>
                {`X-Webhook-Signature: sha256=abc123...
X-Webhook-Event: balance_updated
Content-Type: application/json`}
              </CodeBlock>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-1">Payload Format</h3>
              <CodeBlock>
                {`{
  "event": "balance_updated",
  "timestamp": "2026-03-07T12:00:00Z",
  "data": {
    "seatId": "seat_xyz",
    "accountId": "acc_456",
    "accountName": "Everyday Account",
    "current": 1234.56,
    "available": 1200.00,
    "previousBalance": 1284.56
  }
}`}
              </CodeBlock>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-1">
                Signature Verification
              </h3>
              <p className="text-xs text-default-500 mb-2">
                Compute an HMAC-SHA256 of the raw request body using your
                webhook secret and compare it with the{" "}
                <code className="text-xs">X-Webhook-Signature</code> header.
              </p>
              <CodeBlock>
                {`import crypto from "crypto";

function verifySignature(body: string, secret: string, signature: string) {
  const expected = "sha256=" + crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}`}
              </CodeBlock>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-1">Event Types</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="bg-default-50 rounded p-2">
                  <code className="font-semibold">balance_updated</code>
                  <p className="text-default-500 mt-0.5">
                    Account balance has changed
                  </p>
                </div>
                <div className="bg-default-50 rounded p-2">
                  <code className="font-semibold">transactions_updated</code>
                  <p className="text-default-500 mt-0.5">
                    New transactions detected
                  </p>
                </div>
                <div className="bg-default-50 rounded p-2">
                  <code className="font-semibold">session_updated</code>
                  <p className="text-default-500 mt-0.5">
                    Observer session status changed (login, expiry, error)
                  </p>
                </div>
                <div className="bg-default-50 rounded p-2">
                  <code className="font-semibold">accounts_discovered</code>
                  <p className="text-default-500 mt-0.5">
                    New accounts found for a seat
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}
