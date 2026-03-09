import { useState } from "react";
import type { banking } from "~/lib/client";

interface TwoFaReadViewProps {
  config: banking.TwoFaConfigResponse | null;
}

export default function TwoFaReadView({ config }: TwoFaReadViewProps) {
  const [copied, setCopied] = useState(false);

  if (!config || !config.method) {
    return (
      <p className="text-sm text-default-400">No 2FA configured.</p>
    );
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-1 text-sm">
      <span className="text-default-500">Method</span>
      <span className="capitalize">{config.method}</span>
      {config.method === "sms" && (
        <>
          {config.smsProvider && (
            <>
              <span className="text-default-500">Provider</span>
              <span className="capitalize">{config.smsProvider}</span>
            </>
          )}
          {config.hasApiKey && (
            <>
              <span className="text-default-500">API Key</span>
              <span className="text-xs text-success">Configured</span>
            </>
          )}
          {config.phoneNumber && (
            <>
              <span className="text-default-500">Phone</span>
              <span>{config.phoneNumber}</span>
            </>
          )}
          {config.forwardTo && (
            <>
              <span className="text-default-500">Forward To</span>
              <span>{config.forwardTo}</span>
            </>
          )}
          {config.webhookUrl && (
            <>
              <span className="text-default-500">Webhook URL</span>
              <span className="flex items-center gap-2">
                <code className="text-xs font-mono break-all">
                  {config.webhookUrl}
                </code>
                <button
                  type="button"
                  onClick={() => copyUrl(config.webhookUrl!)}
                  className="shrink-0 text-xs text-accent hover:underline"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </span>
            </>
          )}
        </>
      )}
      {config.notificationEmail && (
        <>
          <span className="text-default-500">Email</span>
          <span>{config.notificationEmail}</span>
        </>
      )}
    </div>
  );
}
