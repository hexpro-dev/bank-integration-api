import { useState, useEffect } from "react";
import { Card, Chip } from "@heroui/react";
import type { banking } from "~/lib/client";
import { client } from "~/lib/api";
import { useAuth } from "~/lib/auth";

export default function DashboardPage() {
  const { user } = useAuth();
  const [seats, setSeats] = useState<banking.SeatSummary[]>([]);
  const [recentTx, setRecentTx] = useState<banking.TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      client.banking.listSeats().catch(() => ({ seats: [] })),
      client.banking.recentTransactions().catch(() => ({ transactions: [] })),
    ])
      .then(([seatsRes, txRes]) => {
        setSeats(seatsRes.seats || []);
        setRecentTx(txRes.transactions || []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-default-500">
        Loading dashboard...
      </div>
    );
  }

  const bankColors: Record<string, string> = {
    anz: "bg-blue-100 text-blue-800",
    commbank: "bg-yellow-100 text-yellow-800",
    nab: "bg-red-100 text-red-800",
    westpac: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-default-500">Welcome back, {user?.name}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <Card.Content className="p-4">
            <p className="text-sm text-default-500">Active Seats</p>
            <p className="text-3xl font-bold">
              {seats.filter((s) => s.isActive).length}
            </p>
          </Card.Content>
        </Card>
        <Card>
          <Card.Content className="p-4">
            <p className="text-sm text-default-500">Total Seats</p>
            <p className="text-3xl font-bold">{seats.length}</p>
          </Card.Content>
        </Card>
        <Card>
          <Card.Content className="p-4">
            <p className="text-sm text-default-500">Recent Transactions</p>
            <p className="text-3xl font-bold">{recentTx.length}</p>
          </Card.Content>
        </Card>
        <Card>
          <Card.Content className="p-4">
            <p className="text-sm text-default-500">Status</p>
            <Chip color="success" size="sm">
              Online
            </Chip>
          </Card.Content>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <Card.Header>
            <Card.Title>Bank Seats</Card.Title>
          </Card.Header>
          <Card.Content>
            {seats.length === 0 ? (
              <p className="text-default-500 text-sm">
                No seats configured. Add one from the Bank Seats page.
              </p>
            ) : (
              <div className="space-y-2">
                {seats.map((seat) => (
                  <div
                    key={seat.id}
                    className="flex items-center justify-between py-2 border-b border-default-100 last:border-0"
                  >
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${bankColors[seat.bank] || ""}`}
                    >
                      {seat.bank.toUpperCase()}
                    </span>
                    <Chip
                      size="sm"
                      color={seat.isActive ? "success" : "default"}
                    >
                      {seat.isActive ? "Active" : "Inactive"}
                    </Chip>
                  </div>
                ))}
              </div>
            )}
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>Recent Transactions</Card.Title>
          </Card.Header>
          <Card.Content>
            {recentTx.length === 0 ? (
              <p className="text-default-500 text-sm">No transactions yet.</p>
            ) : (
              <div className="space-y-1">
                {recentTx.slice(0, 10).map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between py-1.5 text-sm border-b border-default-100 last:border-0"
                  >
                    <div>
                      <p className="font-medium truncate max-w-[200px]">
                        {tx.description}
                      </p>
                      <p className="text-xs text-default-400">
                        {tx.transactionDate}
                      </p>
                    </div>
                    <span
                      className={
                        tx.transactionType === "credit"
                          ? "text-success font-medium"
                          : "text-danger font-medium"
                      }
                    >
                      {tx.transactionType === "credit" ? "+" : "-"}$
                      {Math.abs(parseFloat(tx.amount)).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}
